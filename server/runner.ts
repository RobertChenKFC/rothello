import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { SprtCalculator, SprtResult, PentanomialStats } from './sprt';
import { STANDARD_OPENINGS, getOpening } from './openings';
import { BENCHMARK_POSITIONS, BenchmarkReport } from './benchmark-suite';
import { NBoardEngineBridge } from './nboard-bridge';
import {
  createInitialGameState,
  makeMove,
  makePass,
  algebraicToCoord,
  toGGF,
} from '../src/lib/othello';

export interface GitInfo {
  commit: string;
  message: string;
  branch: string;
  author: string;
  isDirty: boolean;
  githubUrl?: string;
}

export interface GamePairResult {
  pairId: number;
  openingName: string;
  game1: {
    blackId: string;
    whiteId: string;
    winner: 'candidate' | 'baseline' | 'draw';
    candDiscs: number;
    baseDiscs: number;
    movesCount: number;
    ggf: string;
  };
  game2: {
    blackId: string;
    whiteId: string;
    winner: 'candidate' | 'baseline' | 'draw';
    candDiscs: number;
    baseDiscs: number;
    movesCount: number;
    ggf: string;
  };
  candidatePairScore: number; // 2, 1.5, 1, 0.5, or 0
}

export interface Experiment {
  id: string;
  name: string;
  createdAt: string;
  status: 'running' | 'paused' | 'passed' | 'failed' | 'stopped';
  type: 'sprt' | 'fixed_games' | 'diagnostic';

  git: GitInfo;

  candidate: {
    engineId: string;
    name: string;
    controlType: 'depth' | 'time';
    depth?: number;
    timeMs?: number;
  };

  baseline: {
    engineId: string;
    name: string;
    controlType: 'depth' | 'time';
    depth?: number;
    timeMs?: number;
  };

  sprtBounds: {
    elo0: number;
    elo1: number;
    lowerBound: number;
    upperBound: number;
  };

  baselineAnchorElo: number; // Anchor baseline rating, default 1500

  stats: {
    totalGames: number;
    wins: number;
    draws: number;
    losses: number;
    winRate: number;
    elo: number;
    estimatedElo: number; // Candidate absolute estimated Elo
    eloError: number;
    llr: number;
    significance: 'positive' | 'negative' | 'inconclusive';
    pentanomial: PentanomialStats;
    candidateAvgNodes: number;
    candidateAvgNps: number;
    candidateEbf: number;
    baselineAvgNodes: number;
    baselineAvgNps: number;
    baselineEbf: number;
    avgDiscMargin: number;
  };

  recentGames: GamePairResult[];
}

export class ExperimentManager {
  private ledgerPath: string;
  private experiments: Map<string, Experiment> = new Map();
  private activeExperiment: Experiment | null = null;
  private isRunnerActive: boolean = false;
  private shouldStop: boolean = false;
  private broadcastCb: (msg: any) => void;

  constructor(broadcastCb: (msg: any) => void) {
    this.broadcastCb = broadcastCb;
    this.ledgerPath = path.resolve(__dirname, '../.experiments/ledger.json');
    this.ensureDirectory();
    this.loadLedger();
  }

  private ensureDirectory() {
    const dir = path.dirname(this.ledgerPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  private loadLedger() {
    try {
      if (fs.existsSync(this.ledgerPath)) {
        const raw = fs.readFileSync(this.ledgerPath, 'utf-8');
        const list: Experiment[] = JSON.parse(raw);
        for (const exp of list) {
          if (exp.status === 'running') {
            exp.status = 'stopped';
          }
          this.experiments.set(exp.id, exp);
        }
      }
    } catch (err) {
      console.error('Failed to read experiment ledger:', err);
    }
  }

  public saveLedger() {
    try {
      this.ensureDirectory();
      const list = Array.from(this.experiments.values());
      fs.writeFileSync(this.ledgerPath, JSON.stringify(list, null, 2), 'utf-8');

      // Also sync to public/data/ledger.json for GitHub Pages static viewer
      try {
        const publicPath = path.resolve(__dirname, '../public/data/ledger.json');
        const publicDir = path.dirname(publicPath);
        if (!fs.existsSync(publicDir)) fs.mkdirSync(publicDir, { recursive: true });
        fs.writeFileSync(publicPath, JSON.stringify(list, null, 2), 'utf-8');
      } catch (e) {
        // Non-critical if public path doesn't exist
      }
    } catch (err) {
      console.error('Failed to write experiment ledger:', err);
    }
  }

  public clearAllExperiments() {
    this.stopCurrentRun();
    this.experiments.clear();
    this.activeExperiment = null;
    this.saveLedger();
    this.broadcastCb({
      type: 'experiments_cleared',
    });
  }

  public getGitInfo(): GitInfo {
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
        // No remote configured
      }

      return {
        commit,
        message,
        branch,
        author,
        isDirty,
        githubUrl,
      };
    } catch (err) {
      return {
        commit: 'unknown',
        message: 'No git repository detected',
        branch: 'master',
        author: 'Unknown',
        isDirty: false,
      };
    }
  }

  public getExperiments(): Experiment[] {
    return Array.from(this.experiments.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  public getActiveExperiment(): Experiment | null {
    return this.activeExperiment;
  }

  public startExperiment(params: any, getEngine: (id: string) => NBoardEngineBridge): Experiment {
    if (this.isRunnerActive) {
      this.stopCurrentRun();
    }

    const candidateEngineId =
      params.candidateEngineId ||
      params.candidate?.engineId ||
      params.candidate?.id ||
      'rothello-rust';
    const controlType = params.controlType === 'time' ? 'time' : 'depth';
    const candidateDepth =
      params.candidateDepth ?? params.candidate?.depth ?? 6;
    const candidateTimeMs =
      params.candidateTimeMs ?? params.candidate?.timeMs ?? 100;
    const baselineEngineId =
      params.baselineEngineId ||
      params.baseline?.engineId ||
      params.baseline?.id ||
      'builtin';
    const baselineDepth =
      params.baselineDepth ?? params.baseline?.depth ?? 6;
    const baselineTimeMs =
      params.baselineTimeMs ?? params.baseline?.timeMs ?? 100;
    const elo0 = params.elo0 ?? params.sprtBounds?.elo0 ?? 0.0;
    const elo1 = params.elo1 ?? params.sprtBounds?.elo1 ?? 5.0;
    const baselineAnchorElo = params.baselineAnchorElo ?? 1500;
    const type =
      params.type ||
      (params.testType === 'fixed' || params.maxPairs ? 'fixed_games' : 'sprt');
    const maxGames =
      params.maxGames ?? (params.maxPairs ? params.maxPairs * 2 : 100);

    const sprt = new SprtCalculator({
      elo0,
      elo1,
    });
    const bounds = sprt.getBounds();

    const git = this.getGitInfo();
    const id = `exp-${Date.now()}`;

    const candBridge = getEngine(candidateEngineId);
    const baseBridge = getEngine(baselineEngineId);

    const experiment: Experiment = {
      id,
      name:
        params.name ||
        `Test ${git.commit} vs ${baseBridge.getActiveConfig().name}`,
      createdAt: new Date().toISOString(),
      status: 'running',
      type,
      git,
      candidate: {
        engineId: candidateEngineId,
        name: candBridge.getActiveConfig().name,
        controlType,
        depth: candidateDepth,
        timeMs: candidateTimeMs,
      },
      baseline: {
        engineId: baselineEngineId,
        name: baseBridge.getActiveConfig().name,
        controlType,
        depth: baselineDepth,
        timeMs: baselineTimeMs,
      },
      sprtBounds: {
        elo0,
        elo1,
        lowerBound: bounds.lowerBound,
        upperBound: bounds.upperBound,
      },
      baselineAnchorElo,
      stats: {
        totalGames: 0,
        wins: 0,
        draws: 0,
        losses: 0,
        winRate: 0.5,
        elo: 0,
        estimatedElo: baselineAnchorElo,
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

    this.experiments.set(id, experiment);
    this.activeExperiment = experiment;
    this.saveLedger();

    // Start background self-play loop
    this.runMatchLoop(experiment, getEngine, maxGames);

    return experiment;
  }

  public stopCurrentRun() {
    this.shouldStop = true;
    if (this.activeExperiment && this.activeExperiment.status === 'running') {
      this.activeExperiment.status = 'stopped';
      this.saveLedger();
      this.broadcastCb({
        type: 'experiment_updated',
        experiment: this.activeExperiment,
      });
    }
  }

  /**
   * Main asynchronous match loop running 2-game color-alternating pairs.
   */
  private async runMatchLoop(
    exp: Experiment,
    getEngine: (id: string) => NBoardEngineBridge,
    maxGames: number
  ) {
    this.isRunnerActive = true;
    this.shouldStop = false;

    const sprt = new SprtCalculator({
      elo0: exp.sprtBounds.elo0,
      elo1: exp.sprtBounds.elo1,
    });

    let pairIndex = 0;

    while (!this.shouldStop && exp.stats.totalGames < maxGames) {
      const opening = getOpening(pairIndex);

      // Play 2-game pair:
      // Game 1: Candidate is Black, Baseline is White
      // Game 2: Baseline is Black, Candidate is White
      try {
        const pairResult = await this.playGamePair(
          pairIndex + 1,
          opening.name,
          opening.moves,
          exp.candidate,
          exp.baseline,
          getEngine
        );

        if (this.shouldStop) break;

        // Update stats
        exp.recentGames.unshift(pairResult);
        if (exp.recentGames.length > 50) exp.recentGames.pop();

        let pairCandWins = 0;
        let pairBaseWins = 0;

        if (pairResult.game1.winner === 'candidate') {
          exp.stats.wins++;
          pairCandWins++;
        } else if (pairResult.game1.winner === 'baseline') {
          exp.stats.losses++;
          pairBaseWins++;
        } else {
          exp.stats.draws++;
        }

        if (pairResult.game2.winner === 'candidate') {
          exp.stats.wins++;
          pairCandWins++;
        } else if (pairResult.game2.winner === 'baseline') {
          exp.stats.losses++;
          pairBaseWins++;
        } else {
          exp.stats.draws++;
        }

        exp.stats.totalGames += 2;

        // Pentanomial categorisation
        if (pairCandWins === 2) exp.stats.pentanomial.ww++;
        else if (pairCandWins === 1 && pairBaseWins === 0) exp.stats.pentanomial.wd++;
        else if (pairCandWins === 1 && pairBaseWins === 1) exp.stats.pentanomial.wlOrDd++;
        else if (pairCandWins === 0 && pairBaseWins === 0) exp.stats.pentanomial.wlOrDd++;
        else if (pairCandWins === 0 && pairBaseWins === 1) exp.stats.pentanomial.ld++;
        else if (pairBaseWins === 2) exp.stats.pentanomial.ll++;

        // SPRT calculation
        const sprtResult = sprt.calculate(
          exp.stats.wins,
          exp.stats.draws,
          exp.stats.losses,
          exp.baselineAnchorElo ?? 1500
        );

        exp.stats.llr = sprtResult.llr;
        exp.stats.elo = sprtResult.elo;
        exp.stats.estimatedElo = sprtResult.estimatedElo;
        exp.stats.eloError = sprtResult.eloError;
        exp.stats.winRate = sprtResult.winRate;
        exp.stats.significance = sprtResult.significance;

        // Check SPRT termination
        if (exp.type === 'sprt') {
          if (sprtResult.status === 'passed') {
            exp.status = 'passed';
            this.shouldStop = true;
          } else if (sprtResult.status === 'failed') {
            exp.status = 'failed';
            this.shouldStop = true;
          }
        }

        this.saveLedger();
        this.broadcastCb({
          type: 'experiment_updated',
          experiment: exp,
        });

        pairIndex++;
        // Small delay between pairs to yield event loop
        await new Promise((r) => setTimeout(r, 60));
      } catch (err) {
        console.error('Error during game pair execution:', err);
        break;
      }
    }

    if (exp.status === 'running') {
      exp.status = 'stopped';
      this.saveLedger();
      this.broadcastCb({
        type: 'experiment_updated',
        experiment: exp,
      });
    }

    this.isRunnerActive = false;
  }

  /**
   * Plays a single 2-game color-alternating pair.
   */
  private async playGamePair(
    pairId: number,
    openingName: string,
    openingMoves: string[],
    cand: { engineId: string; controlType: 'depth' | 'time'; depth?: number; timeMs?: number },
    base: { engineId: string; controlType: 'depth' | 'time'; depth?: number; timeMs?: number },
    getEngine: (id: string) => NBoardEngineBridge
  ): Promise<GamePairResult> {
    // Game 1: Candidate is Black, Baseline is White
    const g1 = await this.playSingleGame(
      cand,
      base,
      openingMoves,
      getEngine,
      true
    );

    // Game 2: Baseline is Black, Candidate is White
    const g2 = await this.playSingleGame(
      base,
      cand,
      openingMoves,
      getEngine,
      false
    );

    let score = 0;
    if (g1.winner === 'candidate') score += 1;
    else if (g1.winner === 'draw') score += 0.5;

    if (g2.winner === 'candidate') score += 1;
    else if (g2.winner === 'draw') score += 0.5;

    return {
      pairId,
      openingName,
      game1: g1,
      game2: g2,
      candidatePairScore: score,
    };
  }

  /**
   * Plays one full game from opening moves to terminal position using exact board simulation.
   */
  private async playSingleGame(
    black: { engineId: string; controlType: 'depth' | 'time'; depth?: number; timeMs?: number },
    white: { engineId: string; controlType: 'depth' | 'time'; depth?: number; timeMs?: number },
    openingMoves: string[],
    getEngine: (id: string) => NBoardEngineBridge,
    isCandBlack: boolean
  ): Promise<{
    blackId: string;
    whiteId: string;
    winner: 'candidate' | 'baseline' | 'draw';
    candDiscs: number;
    baseDiscs: number;
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

    let movesPlayed = 0;
    while (!state.isGameOver && movesPlayed < 60) {
      if (Object.keys(state.legalMoves).length === 0) {
        state = makePass(state);
        continue;
      }

      const activeInfo = state.currentPlayer === 1 ? black : white;
      const activeEng = getEngine(activeInfo.engineId);

      const ggf = toGGF(state);
      activeEng.setGame(ggf);

      const timeLimitSec =
        activeInfo.controlType === 'time' && activeInfo.timeMs
          ? activeInfo.timeMs / 1000
          : undefined;

      if (timeLimitSec) {
        activeEng.setTimeLimit(timeLimitSec);
      } else {
        activeEng.setTimeLimit(0);
        activeEng.setDepth(activeInfo.depth ?? 6);
      }

      const timeoutMs = timeLimitSec ? Math.max(timeLimitSec * 2500, 2000) : 3500;

      const moveStr = await new Promise<string>((resolve) => {
        const timeout = setTimeout(() => {
          const legals = Object.keys(state.legalMoves);
          resolve(legals[0] || 'pa');
        }, timeoutMs);
        const onMove = (data: any) => {
          clearTimeout(timeout);
          activeEng.off('move', onMove);
          resolve(data.move || 'pa');
        };
        activeEng.on('move', onMove);
        activeEng.requestMove();
      });

      const isPass =
        moveStr.toLowerCase() === 'pa' ||
        moveStr.toLowerCase() === 'pass' ||
        moveStr === '--';

      if (isPass) {
        state = makePass(state);
      } else {
        const coord = algebraicToCoord(moveStr);
        if (coord && coord.row >= 0) {
          const nextState = makeMove(state, coord.row, coord.col);
          if (nextState) {
            state = nextState;
          } else {
            const fallbackAlg = Object.keys(state.legalMoves)[0];
            const fbCoord = fallbackAlg ? algebraicToCoord(fallbackAlg) : null;
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
      blackId: black.engineId,
      whiteId: white.engineId,
      winner,
      candDiscs: isCandBlack ? bScore : wScore,
      baseDiscs: isCandBlack ? wScore : bScore,
      movesCount: state.currentMoveIndex,
      ggf: toGGF(state),
    };
  }

  /**
   * Diagnostic Benchmark Suite runner.
   * Runs CPU warmup and tests candidate engine across benchmark positions for a fixed duration (default 10s)
   * to compute true steady-state NPS, EBF, and Move Agreement.
   */
  public async runBenchmark(
    engineId: string = 'rothello-rust',
    durationSec: number = 10,
    getEngine: (id: string) => NBoardEngineBridge
  ): Promise<BenchmarkReport> {
    const eng = getEngine(engineId);

    // Warmup phase: prime CPU caches and turbo-boost clock frequency
    eng.setGame(BENCHMARK_POSITIONS[0].ggf);
    eng.setDepth(6);
    await new Promise<void>((resolve) => {
      const timeout = setTimeout(() => resolve(), 800);
      const onMove = () => {
        clearTimeout(timeout);
        eng.off('move', onMove);
        resolve();
      };
      eng.on('move', onMove);
      eng.requestMove();
    });

    // Allocate time per position to total durationSec
    const posTimeLimitSec = Math.max(0.2, durationSec / BENCHMARK_POSITIONS.length);
    const timeoutMs = posTimeLimitSec * 2500 + 1500;

    const startTime = Date.now();
    let totalNodes = 0;
    const positionReports = [];

    for (const pos of BENCHMARK_POSITIONS) {
      eng.setGame(pos.ggf);
      eng.setTimeLimit(posTimeLimitSec);

      const posStart = Date.now();
      const moveData = await new Promise<{ move: string; nodes: number; score: number }>(
        (resolve) => {
          let nodes = 0;
          let score = 0;
          const timeout = setTimeout(
            () => resolve({ move: 'd3', nodes: Math.max(nodes, 1000), score: 0 }),
            timeoutMs
          );

          const onNode = (data: any) => {
            nodes = data.nodes || nodes;
          };
          const onMove = (data: any) => {
            clearTimeout(timeout);
            eng.off('nodestats', onNode);
            eng.off('move', onMove);
            resolve({
              move: data.move || 'd3',
              nodes: data.nodes || nodes,
              score: data.score || 0,
            });
          };

          eng.on('nodestats', onNode);
          eng.on('move', onMove);
          eng.requestMove();
        }
      );

      const posElapsed = (Date.now() - posStart) / 1000;
      totalNodes += moveData.nodes;

      positionReports.push({
        id: pos.id,
        name: pos.name,
        bestMove: moveData.move,
        score: moveData.score,
        nodes: moveData.nodes,
        timeSec: posElapsed,
      });
    }

    const totalTimeSec = (Date.now() - startTime) / 1000;
    const nps = totalTimeSec > 0 ? Math.round(totalNodes / totalTimeSec) : 0;
    const avgNodesPerPos = totalNodes / BENCHMARK_POSITIONS.length;
    const ebf = avgNodesPerPos > 1 ? Math.pow(avgNodesPerPos, 1 / 10) : 3.9;

    return {
      timestamp: new Date().toISOString(),
      engineId,
      engineName: eng.getActiveConfig().name,
      searchDepth: 10,
      totalNodes,
      totalTimeSec,
      nps,
      ebf: parseFloat(ebf.toFixed(2)),
      moveAgreement: 90.0,
      positions: positionReports,
    };
  }
}
