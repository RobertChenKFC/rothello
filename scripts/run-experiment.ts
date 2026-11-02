import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { NBoardEngineBridge } from '../server/nboard-bridge';
import { SprtCalculator } from '../server/sprt';
import { STANDARD_OPENINGS, getOpening } from '../server/openings';
import {
  createInitialGameState,
  makeMove,
  makePass,
  algebraicToCoord,
  toGGF,
} from '../src/lib/othello';
import { Experiment, GitInfo, GamePairResult } from '../server/runner';

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const options: {
    games: number;
    depth: number;
    timeMs?: number;
    name?: string;
    elo0: number;
    elo1: number;
  } = {
    games: 20, // default 20 games (10 pairs)
    depth: 6,
    elo0: 0.0,
    elo1: 5.0,
  };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--games' && args[i + 1]) {
      options.games = parseInt(args[++i], 10);
      if (options.games % 2 !== 0) options.games += 1; // ensure pairs
    } else if (args[i] === '--depth' && args[i + 1]) {
      options.depth = parseInt(args[++i], 10);
    } else if (args[i] === '--time' && args[i + 1]) {
      options.timeMs = parseInt(args[++i], 10);
    } else if (args[i] === '--name' && args[i + 1]) {
      options.name = args[++i];
    } else if (args[i] === '--elo0' && args[i + 1]) {
      options.elo0 = parseFloat(args[++i]);
    } else if (args[i] === '--elo1' && args[i + 1]) {
      options.elo1 = parseFloat(args[++i]);
    }
  }

  return options;
}

function getGitInfo(): GitInfo {
  try {
    const commit = execSync('git rev-parse --short HEAD', { encoding: 'utf-8' }).trim();
    const message = execSync('git log -1 --pretty=%s', { encoding: 'utf-8' }).trim();
    const author = execSync('git log -1 --pretty=%an', { encoding: 'utf-8' }).trim();
    const branch = execSync('git branch --show-current', { encoding: 'utf-8' }).trim() || 'master';
    const statusOutput = execSync('git status --porcelain', { encoding: 'utf-8' }).trim();
    const isDirty = statusOutput.length > 0;

    let githubUrl: string | undefined = undefined;
    try {
      const remote = execSync('git remote get-url origin', { encoding: 'utf-8' }).trim();
      if (remote.includes('github.com')) {
        const match = remote.match(/github\.com[:/](.+?)(?:\.git)?$/);
        if (match) {
          githubUrl = `https://github.com/${match[1]}/commit/${commit}`;
        }
      }
    } catch {
      // Remote not found
    }

    return { commit, message, branch, author, isDirty, githubUrl };
  } catch {
    return {
      commit: 'unknown',
      message: 'Unknown commit',
      branch: 'unknown',
      author: 'Unknown',
      isDirty: false,
    };
  }
}

function ensureBaselineEngine(projectRoot: string) {
  const baselinePath = path.resolve(projectRoot, 'engine/target/release/rothello-baseline');
  if (fs.existsSync(baselinePath)) {
    return baselinePath;
  }

  console.log('⚡ Baseline engine binary not found. Compiling baseline from master...');
  const currentBranch = execSync('git branch --show-current', { encoding: 'utf-8' }).trim();

  if (currentBranch === 'master' || currentBranch === '') {
    execSync('cargo build --release --manifest-path engine/Cargo.toml', { stdio: 'inherit' });
    fs.copyFileSync(path.resolve(projectRoot, 'engine/target/release/rothello'), baselinePath);
  } else {
    const tmpWorktree = path.resolve(projectRoot, '.baseline-worktree-temp');
    try {
      if (fs.existsSync(tmpWorktree)) {
        execSync(`git worktree remove --force "${tmpWorktree}"`, { stdio: 'ignore' });
      }
      execSync(`git worktree add --detach "${tmpWorktree}" master`, { stdio: 'inherit' });
      execSync(`cargo build --release --manifest-path "${path.resolve(tmpWorktree, 'engine/Cargo.toml')}"`, { stdio: 'inherit' });
      fs.copyFileSync(path.resolve(tmpWorktree, 'engine/target/release/rothello'), baselinePath);
    } finally {
      try {
        execSync(`git worktree remove --force "${tmpWorktree}"`, { stdio: 'ignore' });
      } catch {}
    }
  }

  console.log('✅ Baseline binary created at:', baselinePath);
  return baselinePath;
}

function ensureCandidateEngine(projectRoot: string) {
  console.log('⚡ Compiling candidate engine from current branch...');
  execSync('cargo build --release --manifest-path engine/Cargo.toml', { stdio: 'inherit' });
  const candPath = path.resolve(projectRoot, 'engine/target/release/rothello');
  console.log('✅ Candidate binary ready at:', candPath);
  return candPath;
}

async function playSingleGame(
  blackBridge: NBoardEngineBridge,
  whiteBridge: NBoardEngineBridge,
  isCandBlack: boolean,
  depth: number,
  timeMs?: number,
  openingMoves: string[] = []
): Promise<{
  winner: 'candidate' | 'baseline' | 'draw';
  candDiscs: number;
  baseDiscs: number;
  candNodes: number;
  baseNodes: number;
  candTimeMs: number;
  baseTimeMs: number;
  movesCount: number;
  ggf: string;
}> {
  let state = createInitialGameState();
  for (const m of openingMoves) {
    const coord = algebraicToCoord(m);
    if (coord && coord.row >= 0) {
      const next = makeMove(state, coord.row, coord.col);
      if (next) state = next;
    }
  }

  let candTotalNodes = 0;
  let baseTotalNodes = 0;
  let candTotalTime = 0;
  let baseTotalTime = 0;
  let movesPlayed = 0;

  while (!state.isGameOver && movesPlayed < 60) {
    if (Object.keys(state.legalMoves).length === 0) {
      state = makePass(state);
      continue;
    }

    const isBlackTurn = state.currentPlayer === 1;
    const isCandTurn = isBlackTurn ? isCandBlack : !isCandBlack;
    const activeBridge = isBlackTurn ? blackBridge : whiteBridge;

    const ggf = toGGF(state);
    activeBridge.setGame(ggf);

    const timeLimitSec = timeMs ? timeMs / 1000 : undefined;
    if (timeLimitSec) {
      activeBridge.setTimeLimit(timeLimitSec);
    } else {
      activeBridge.setTimeLimit(0);
      activeBridge.setDepth(depth);
    }

    const timeoutMs = timeLimitSec ? Math.max(timeLimitSec * 2500, 3000) : 5000;
    const startT = Date.now();
    let moveNodes = 0;

    const nodeListener = (data: any) => {
      if (data && typeof data.nodes === 'number') {
        moveNodes = data.nodes;
      }
    };
    activeBridge.on('nodestats', nodeListener);

    const moveStr = await new Promise<string>((resolve) => {
      const timeout = setTimeout(() => {
        const legals = Object.keys(state.legalMoves);
        resolve(legals[0] || 'pa');
      }, timeoutMs);

      const onMove = (data: any) => {
        clearTimeout(timeout);
        activeBridge.off('move', onMove);
        resolve(data.move || 'pa');
      };
      activeBridge.on('move', onMove);
      activeBridge.requestMove();
    });

    activeBridge.off('nodestats', nodeListener);
    const elapsed = Date.now() - startT;

    if (isCandTurn) {
      candTotalNodes += moveNodes;
      candTotalTime += elapsed;
    } else {
      baseTotalNodes += moveNodes;
      baseTotalTime += elapsed;
    }

    const isPass = moveStr.toLowerCase() === 'pa' || moveStr.toLowerCase() === 'pass' || moveStr === '--';
    if (isPass) {
      state = makePass(state);
    } else {
      const coord = algebraicToCoord(moveStr);
      if (coord && coord.row >= 0) {
        const nextState = makeMove(state, coord.row, coord.col);
        if (nextState) {
          state = nextState;
        } else {
          const fallback = Object.keys(state.legalMoves)[0];
          const fbCoord = fallback ? algebraicToCoord(fallback) : null;
          if (fbCoord && fbCoord.row >= 0) {
            state = makeMove(state, fbCoord.row, fbCoord.col) || state;
          } else {
            state = makePass(state);
          }
        }
      } else {
        state = makePass(state);
      }
    }
    movesPlayed++;
  }

  const bScore = state.blackCount;
  const wScore = state.whiteCount;

  let winner: 'candidate' | 'baseline' | 'draw' = 'draw';
  if (bScore > wScore) {
    winner = isCandBlack ? 'candidate' : 'baseline';
  } else if (wScore > bScore) {
    winner = isCandBlack ? 'baseline' : 'candidate';
  }

  return {
    winner,
    candDiscs: isCandBlack ? bScore : wScore,
    baseDiscs: isCandBlack ? wScore : bScore,
    candNodes: candTotalNodes,
    baseNodes: baseTotalNodes,
    candTimeMs: candTotalTime,
    baseTimeMs: baseTotalTime,
    movesCount: movesPlayed,
    ggf: toGGF(state),
  };
}

async function runExperiment() {
  const options = parseArgs();
  const projectRoot = path.resolve(__dirname, '..');

  console.log('===========================================================');
  console.log('🤖 Rothello Automated Local SPRT Match Runner');
  console.log('===========================================================');
  console.log(`Planned Games: ${options.games} (${options.games / 2} color-alternating pairs)`);
  console.log(`Control: ${options.timeMs ? `${options.timeMs}ms/move` : `Depth ${options.depth}`}`);
  console.log(`SPRT Hypotheses: H0: ${options.elo0} Elo, H1: ${options.elo1} Elo`);
  console.log('-----------------------------------------------------------');

  const baselinePath = ensureBaselineEngine(projectRoot);
  const candPath = ensureCandidateEngine(projectRoot);
  const gitInfo = getGitInfo();

  console.log(`Git Context: ${gitInfo.branch} @ ${gitInfo.commit} - "${gitInfo.message}"`);
  console.log('-----------------------------------------------------------');

  // Spawn engines
  const candBridge = new NBoardEngineBridge({
    id: 'rothello-rust',
    name: 'Rothello Engine (Rust)',
    type: 'external',
    path: candPath,
    args: ['--nboard'],
    depth: options.depth,
  });

  const baseBridge = new NBoardEngineBridge({
    id: 'rothello-baseline',
    name: 'Rothello Baseline (Master)',
    type: 'external',
    path: baselinePath,
    args: ['--nboard'],
    depth: options.depth,
  });

  // Wait for engines to initialize
  await new Promise((r) => setTimeout(r, 1000));

  const sprt = new SprtCalculator({
    elo0: options.elo0,
    elo1: options.elo1,
  });
  const sprtBounds = sprt.getBounds();

  const id = `exp-${Date.now()}`;
  const expName = options.name || `SPRT: ${gitInfo.branch} (${gitInfo.commit}) vs master`;

  const experiment: Experiment = {
    id,
    name: expName,
    createdAt: new Date().toISOString(),
    status: 'running',
    type: 'sprt',
    git: gitInfo,
    candidate: {
      engineId: 'rothello-rust',
      name: 'Rothello Candidate',
      controlType: options.timeMs ? 'time' : 'depth',
      depth: options.depth,
      timeMs: options.timeMs,
    },
    baseline: {
      engineId: 'rothello-baseline',
      name: 'Rothello Baseline (Master)',
      controlType: options.timeMs ? 'time' : 'depth',
      depth: options.depth,
      timeMs: options.timeMs,
    },
    sprtBounds: {
      elo0: options.elo0,
      elo1: options.elo1,
      lowerBound: sprtBounds.lowerBound,
      upperBound: sprtBounds.upperBound,
    },
    baselineAnchorElo: 1500,
    stats: {
      totalGames: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      winRate: 0.5,
      elo: 0,
      estimatedElo: 1500,
      eloError: 0,
      llr: 0,
      significance: 'inconclusive',
      pentanomial: { ww: 0, wd: 0, wlOrDd: 0, ld: 0, ll: 0 },
      candidateAvgNodes: 0,
      candidateAvgNps: 0,
      candidateEbf: 0,
      baselineAvgNodes: 0,
      baselineAvgNps: 0,
      baselineEbf: 0,
      avgDiscMargin: 0,
    },
    recentGames: [],
  };

  const totalPairs = options.games / 2;
  let totalCandNodes = 0;
  let totalBaseNodes = 0;
  let totalCandTime = 0;
  let totalBaseTime = 0;
  let totalDiscMargin = 0;

  console.log(`Starting ${totalPairs} game pairs...\n`);

  for (let p = 0; p < totalPairs; p++) {
    const opening = getOpening(p);

    // Game 1: Cand is Black, Base is White
    const g1 = await playSingleGame(
      candBridge,
      baseBridge,
      true,
      options.depth,
      options.timeMs,
      opening.moves
    );

    // Game 2: Base is Black, Cand is White
    const g2 = await playSingleGame(
      baseBridge,
      candBridge,
      false,
      options.depth,
      options.timeMs,
      opening.moves
    );

    let pairScore = 0;
    let pairCandWins = 0;
    let pairBaseWins = 0;

    if (g1.winner === 'candidate') {
      experiment.stats.wins++;
      pairScore += 1;
      pairCandWins++;
    } else if (g1.winner === 'baseline') {
      experiment.stats.losses++;
      pairBaseWins++;
    } else {
      experiment.stats.draws++;
      pairScore += 0.5;
    }

    if (g2.winner === 'candidate') {
      experiment.stats.wins++;
      pairScore += 1;
      pairCandWins++;
    } else if (g2.winner === 'baseline') {
      experiment.stats.losses++;
      pairBaseWins++;
    } else {
      experiment.stats.draws++;
      pairScore += 0.5;
    }

    experiment.stats.totalGames += 2;

    // Pentanomial stats
    if (pairCandWins === 2) experiment.stats.pentanomial.ww++;
    else if (pairCandWins === 1 && pairBaseWins === 0) experiment.stats.pentanomial.wd++;
    else if (pairCandWins === 1 && pairBaseWins === 1) experiment.stats.pentanomial.wlOrDd++;
    else if (pairCandWins === 0 && pairBaseWins === 0) experiment.stats.pentanomial.wlOrDd++;
    else if (pairCandWins === 0 && pairBaseWins === 1) experiment.stats.pentanomial.ld++;
    else if (pairBaseWins === 2) experiment.stats.pentanomial.ll++;

    // Aggregate nodes & times
    totalCandNodes += g1.candNodes + g2.candNodes;
    totalBaseNodes += g1.baseNodes + g2.baseNodes;
    totalCandTime += g1.candTimeMs + g2.candTimeMs;
    totalBaseTime += g1.baseTimeMs + g2.baseTimeMs;
    totalDiscMargin += (g1.candDiscs - g1.baseDiscs) + (g2.candDiscs - g2.baseDiscs);

    // SPRT update
    const sprtRes = sprt.calculate(
      experiment.stats.wins,
      experiment.stats.draws,
      experiment.stats.losses,
      experiment.baselineAnchorElo
    );

    experiment.stats.llr = sprtRes.llr;
    experiment.stats.elo = sprtRes.elo;
    experiment.stats.estimatedElo = sprtRes.estimatedElo;
    experiment.stats.eloError = sprtRes.eloError;
    experiment.stats.winRate = sprtRes.winRate;
    experiment.stats.significance = sprtRes.significance;

    const candNps = totalCandTime > 0 ? Math.round((totalCandNodes / totalCandTime) * 1000) : 0;
    const baseNps = totalBaseTime > 0 ? Math.round((totalBaseNodes / totalBaseTime) * 1000) : 0;
    experiment.stats.candidateAvgNps = candNps;
    experiment.stats.baselineAvgNps = baseNps;
    experiment.stats.candidateAvgNodes = Math.round(totalCandNodes / experiment.stats.totalGames);
    experiment.stats.baselineAvgNodes = Math.round(totalBaseNodes / experiment.stats.totalGames);
    experiment.stats.avgDiscMargin = parseFloat((totalDiscMargin / experiment.stats.totalGames).toFixed(1));

    const pairResult: GamePairResult = {
      pairId: p + 1,
      openingName: opening.name,
      game1: {
        blackId: 'rothello-rust',
        whiteId: 'rothello-baseline',
        winner: g1.winner,
        candDiscs: g1.candDiscs,
        baseDiscs: g1.baseDiscs,
        movesCount: g1.movesCount,
        ggf: g1.ggf,
      },
      game2: {
        blackId: 'rothello-baseline',
        whiteId: 'rothello-rust',
        winner: g2.winner,
        candDiscs: g2.candDiscs,
        baseDiscs: g2.baseDiscs,
        movesCount: g2.movesCount,
        ggf: g2.ggf,
      },
      candidatePairScore: pairScore,
    };
    experiment.recentGames.unshift(pairResult);
    if (experiment.recentGames.length > 50) experiment.recentGames.pop();

    const sign = experiment.stats.elo >= 0 ? '+' : '';
    console.log(
      `[Pair ${(p + 1).toString().padStart(2, '0')}/${totalPairs}] ` +
      `Score: ${pairScore}/2 (${opening.name}) | ` +
      `Tot: ${experiment.stats.wins}W-${experiment.stats.draws}D-${experiment.stats.losses}L | ` +
      `Elo: ${sign}${experiment.stats.elo.toFixed(1)} ± ${experiment.stats.eloError.toFixed(1)} | ` +
      `LLR: ${experiment.stats.llr.toFixed(2)} [${sprtBounds.lowerBound.toFixed(2)}, ${sprtBounds.upperBound.toFixed(2)}]`
    );

    if (sprtRes.status === 'passed') {
      experiment.status = 'passed';
      console.log('\n🎉 SPRT H1 Accepted (Statistically significant positive Elo)!');
      break;
    } else if (sprtRes.status === 'failed') {
      experiment.status = 'failed';
      console.log('\n❌ SPRT H0 Accepted (Regression detected).');
      break;
    }
  }

  if (experiment.status === 'running') {
    experiment.status = experiment.stats.elo > 0 ? 'passed' : 'stopped';
  }

  // Cleanup bridges
  candBridge.destroy();
  baseBridge.destroy();

  // Save experiment into ledger
  saveExperimentToLedger(projectRoot, experiment);

  console.log('\n===========================================================');
  console.log('📊 Final Experiment Summary');
  console.log('===========================================================');
  console.log(`Status:         ${experiment.status.toUpperCase()}`);
  console.log(`Games:          ${experiment.stats.totalGames} (${experiment.stats.wins}W - ${experiment.stats.draws}D - ${experiment.stats.losses}L, ${(experiment.stats.winRate * 100).toFixed(1)}%)`);
  const eloSign = experiment.stats.elo >= 0 ? '+' : '';
  console.log(`Elo Diff:       ${eloSign}${experiment.stats.elo.toFixed(1)} ± ${experiment.stats.eloError.toFixed(1)} (Estimated Elo: ${experiment.stats.estimatedElo.toFixed(0)})`);
  console.log(`LLR:            ${experiment.stats.llr.toFixed(2)} (Bounds: [${sprtBounds.lowerBound.toFixed(2)}, ${sprtBounds.upperBound.toFixed(2)}])`);
  console.log(`Pentanomial:    [WW: ${experiment.stats.pentanomial.ww}, WD: ${experiment.stats.pentanomial.wd}, DD/WL: ${experiment.stats.pentanomial.wlOrDd}, LD: ${experiment.stats.pentanomial.ld}, LL: ${experiment.stats.pentanomial.ll}]`);
  console.log(`Avg NPS:        Cand ${experiment.stats.candidateAvgNps.toLocaleString()} vs Base ${experiment.stats.baselineAvgNps.toLocaleString()}`);
  console.log('===========================================================');
  console.log('\n💡 Next steps:');
  console.log('  To submit a Pull Request with these experiment results, run:');
  console.log('    npm run submit-pr\n');

  process.exit(0);
}

function saveExperimentToLedger(projectRoot: string, experiment: Experiment) {
  const paths = [
    path.resolve(projectRoot, '.experiments/ledger.json'),
    path.resolve(projectRoot, 'public/data/ledger.json'),
    path.resolve(projectRoot, 'docs/data/ledger.json'),
  ];

  for (const ledgerPath of paths) {
    try {
      const dir = path.dirname(ledgerPath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

      let list: Experiment[] = [];
      if (fs.existsSync(ledgerPath)) {
        try {
          list = JSON.parse(fs.readFileSync(ledgerPath, 'utf-8'));
          if (!Array.isArray(list)) list = [];
        } catch {
          list = [];
        }
      }

      // Upsert
      const existingIdx = list.findIndex((e) => e.id === experiment.id);
      if (existingIdx >= 0) {
        list[existingIdx] = experiment;
      } else {
        list.unshift(experiment);
      }

      fs.writeFileSync(ledgerPath, JSON.stringify(list, null, 2), 'utf-8');
    } catch (err) {
      console.warn(`Could not write ledger at ${ledgerPath}:`, err);
    }
  }

  // Also sync git-info.json
  const gitInfo = experiment.git;
  const gitPaths = [
    path.resolve(projectRoot, 'public/data/git-info.json'),
    path.resolve(projectRoot, 'docs/data/git-info.json'),
  ];
  for (const gitPath of gitPaths) {
    try {
      const dir = path.dirname(gitPath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(gitPath, JSON.stringify(gitInfo, null, 2), 'utf-8');
    } catch {}
  }
}

runExperiment().catch((err) => {
  console.error('Fatal error running experiment:', err);
  process.exit(1);
});
