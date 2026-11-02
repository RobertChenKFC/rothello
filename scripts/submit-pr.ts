import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { Experiment } from '../server/runner';

function getGitOutput(cmd: string): string {
  try {
    return execSync(cmd, { encoding: 'utf-8' }).trim();
  } catch {
    return '';
  }
}

async function submitPr() {
  const projectRoot = path.resolve(__dirname, '..');

  console.log('===========================================================');
  console.log('🚀 Rothello Automated Pull Request Generator');
  console.log('===========================================================');

  // 1. Check current branch
  const currentBranch = getGitOutput('git branch --show-current');
  if (!currentBranch || currentBranch === 'master') {
    console.error('❌ Error: You are currently on branch "master".');
    console.error('   Please run experiments and submit PRs from a feature branch:');
    console.error('     git checkout -b feat/<feature-name>');
    process.exit(1);
  }

  console.log(`Current Feature Branch: ${currentBranch}`);

  // 2. Load latest experiment from ledger
  const ledgerPath = path.resolve(projectRoot, 'public/data/ledger.json');
  if (!fs.existsSync(ledgerPath)) {
    console.error('❌ Error: No experiment ledger found at public/data/ledger.json.');
    console.error('   Please run a local experiment first:');
    console.error('     npm run experiment');
    process.exit(1);
  }

  let experiments: Experiment[] = [];
  try {
    experiments = JSON.parse(fs.readFileSync(ledgerPath, 'utf-8'));
  } catch (err) {
    console.error('❌ Failed to parse experiment ledger:', err);
    process.exit(1);
  }

  if (experiments.length === 0) {
    console.error('❌ Experiment ledger is empty. Please run an experiment first.');
    process.exit(1);
  }

  const latestExp = experiments[0];
  console.log(`Latest Experiment: "${latestExp.name}" (${latestExp.id})`);

  // 3. Format PR Title & Description
  const eloDiff = latestExp.stats.elo;
  const eloError = latestExp.stats.eloError;
  const eloSign = eloDiff >= 0 ? '+' : '';
  const eloFormatted = `${eloSign}${eloDiff.toFixed(1)} ± ${eloError.toFixed(1)} Elo`;
  const isPositive = eloDiff > 0 && latestExp.stats.significance !== 'negative';

  // Merge qualification policy
  const isPassed = latestExp.status === 'passed' && eloDiff > 0;
  const isInconclusive =
    latestExp.status === 'inconclusive' ||
    latestExp.status === 'stopped' ||
    latestExp.stats.significance === 'inconclusive';

  let mergePolicyNotice = '';
  if (isPassed) {
    mergePolicyNotice = `> **✅ MERGE QUALIFIED**: This candidate demonstrates statistically significant positive Elo gain (**${eloFormatted}**) confirmed by SPRT H1 acceptance. Qualified to merge into \`master\`.`;
  } else if (isInconclusive) {
    mergePolicyNotice = `> **⚠️ INCONCLUSIVE / NOT QUALIFIED**: The candidate scored **${eloFormatted}**, but the 95% confidence interval spans across zero and SPRT significance bounds were not reached. **NOT qualified for merge to trunk**. Needs more games to prove statistical significance. Retaining PR for analysis.`;
  } else {
    mergePolicyNotice = `> **❌ REGRESSION DETECTED**: The candidate demonstrates negative Elo gain (**${eloFormatted}**). **NOT qualified for merge to trunk**. Retaining PR for analysis.`;
  }

  const branchClean = currentBranch.replace(/^(feat|fix|refactor|perf)\//, '');
  const title = `feat(${branchClean}): [SPRT ${eloSign}${eloDiff.toFixed(1)} Elo] ${latestExp.git.message || branchClean}`;

  const prBody = `## 🧪 Automated SPRT Experiment Benchmark

### 📌 Summary
Automated experiment run comparing candidate on \`${currentBranch}\` against Rothello Rust baseline (\`master\`).

- **Branch**: \`${currentBranch}\`
- **Candidate Commit**: \`${latestExp.git.commit}\`
- **Message**: "${latestExp.git.message}"
- **Tested At**: ${latestExp.createdAt}

---

### 📊 Benchmark Results
| Metric | Value |
|---|---|
| **SPRT Status** | **\`${latestExp.status.toUpperCase()}\`** |
| **Estimated Elo Diff** | **\`${eloFormatted}\`** |
| **Estimated Absolute Elo** | **\`${latestExp.stats.estimatedElo.toFixed(0)} Elo\`** (Baseline anchor: ${latestExp.baselineAnchorElo}) |
| **Score** | **${latestExp.stats.wins}W - ${latestExp.stats.draws}D - ${latestExp.stats.losses}L** / ${latestExp.stats.totalGames} games (${(latestExp.stats.winRate * 100).toFixed(1)}%) |
| **LLR** | \`${latestExp.stats.llr.toFixed(2)}\` (bounds: \`[${latestExp.sprtBounds.lowerBound.toFixed(2)}, ${latestExp.sprtBounds.upperBound.toFixed(2)}]\`) |
| **Pentanomial \`[ww, wd, dd/wl, ld, ll]\`** | \`[${latestExp.stats.pentanomial.ww}, ${latestExp.stats.pentanomial.wd}, ${latestExp.stats.pentanomial.wlOrDd}, ${latestExp.stats.pentanomial.ld}, ${latestExp.stats.pentanomial.ll}]\` |
| **Avg Search Speed** | Candidate **${latestExp.stats.candidateAvgNps.toLocaleString()} NPS** vs Baseline **${latestExp.stats.baselineAvgNps.toLocaleString()} NPS** |
| **Avg Disc Margin** | \`${latestExp.stats.avgDiscMargin > 0 ? '+' : ''}${latestExp.stats.avgDiscMargin} discs/game\` |

---

### 🌐 Live Static Dashboard
Track this experiment and historical comparisons live on the GitHub Pages dashboard:
👉 **https://robertchenkfc.github.io/rothello/**

---

### 🚦 Merge Qualification Policy
${mergePolicyNotice}
`;

  // 4. Save PR description locally
  const prFilePath = path.resolve(projectRoot, 'PR_DESCRIPTION.md');
  fs.writeFileSync(prFilePath, prBody, 'utf-8');
  console.log(`Saved PR description to: ${prFilePath}`);

  // 5. Stage ledger updates & docs if modified
  try {
    const status = getGitOutput('git status --porcelain');
    if (status.includes('ledger.json') || status.includes('docs/')) {
      console.log('Staging experiment ledger and dashboard updates...');
      execSync('git add public/data/ledger.json docs/ .experiments/ledger.json 2>/dev/null || true');
      try {
        execSync(`git commit -m "test: record SPRT experiment (${eloFormatted}) for ${currentBranch}"`, { stdio: 'ignore' });
        console.log('Committed experiment ledger updates.');
      } catch {}
    }
  } catch {}

  // 6. Push feature branch to origin
  console.log(`Pushing branch "${currentBranch}" to origin...`);
  try {
    execSync(`git push -u origin "${currentBranch}"`, { stdio: 'inherit' });
    console.log(`✅ Branch pushed successfully.`);
  } catch (err: any) {
    console.error(`❌ Error pushing branch to origin: ${err.message}`);
    process.exit(1);
  }

  // 7. Strictly enforce GitHub CLI (gh) installation and authentication
  const hasGh = getGitOutput('which gh');
  if (!hasGh) {
    console.error('❌ Error: GitHub CLI ("gh") is not installed on this system.');
    console.error('   Please install "gh" to automate Pull Request creation.');
    process.exit(1);
  }

  try {
    console.log('Verifying GitHub CLI authentication...');
    execSync('gh auth status', { stdio: 'pipe' });
  } catch (authErr: any) {
    console.error('❌ Error: GitHub CLI ("gh") is not authenticated.');
    console.error('   Please run "gh auth login" in your terminal first.');
    process.exit(1);
  }

  console.log('Creating Pull Request via gh CLI...');
  try {
    const ghOutput = execSync(
      `gh pr create --base master --head "${currentBranch}" --title "${title.replace(/"/g, '\\"')}" --body-file "${prFilePath}"`,
      { encoding: 'utf-8' }
    ).trim();

    console.log(`\n🎉 Pull Request successfully created!`);
    console.log(`👉 ${ghOutput}\n`);
  } catch (prErr: any) {
    const stderr = prErr.stderr ? prErr.stderr.toString() : prErr.message;
    // Check if PR already exists
    if (stderr.includes('already exists')) {
      console.log('ℹ️ Pull Request already exists for this branch. Updating PR description...');
      execSync(
        `gh pr edit "${currentBranch}" --title "${title.replace(/"/g, '\\"')}" --body-file "${prFilePath}"`,
        { stdio: 'inherit' }
      );
      const existingPr = execSync(`gh pr view "${currentBranch}" --json url --jq .url`, { encoding: 'utf-8' }).trim();
      console.log(`\n🎉 Pull Request successfully updated with new experiment benchmark!`);
      console.log(`👉 ${existingPr}\n`);
    } else {
      console.error(`❌ Failed to create Pull Request: ${stderr}`);
      process.exit(1);
    }
  }

  process.exit(0);
}

submitPr().catch((err) => {
  console.error('Fatal error in submit-pr:', err);
  process.exit(1);
});
