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
${
  isPositive
    ? `> **✅ MERGE QUALIFIED**: This candidate demonstrates positive Elo gain (**${eloFormatted}**). Qualified to merge into \`master\`.`
    : `> **⚠️ REGRESSION / INCONCLUSIVE**: This candidate demonstrates negative or neutral Elo gain (**${eloFormatted}**). The experiment is documented in the ledger and retained on this PR for analysis, but will not be merged into \`master\`.`
}
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
  } catch (err) {
    console.warn(`⚠️ Warning: git push encountered an error or network isolation.`);
    console.warn(`   Run "git push -u origin ${currentBranch}" manually if needed.`);
  }

  // 7. Attempt PR creation via GitHub REST API or GitHub CLI (gh)
  const remoteUrl = getGitOutput('git remote get-url origin');
  let repoName = 'RobertChenKFC/rothello';
  const match = remoteUrl.match(/github\.com[:/](.+?)(?:\.git)?$/);
  if (match) repoName = match[1];

  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  let prCreated = false;

  if (token) {
    try {
      console.log('Creating Pull Request via GitHub REST API...');
      const response = await fetch(`https://api.github.com/repos/${repoName}/pulls`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
          'User-Agent': 'Rothello-PR-Automation',
        },
        body: JSON.stringify({
          title,
          head: currentBranch,
          base: 'master',
          body: prBody,
        }),
      });

      const resData = (await response.json()) as any;
      if (response.ok && resData.html_url) {
        console.log(`\n🎉 Pull Request successfully created via GitHub API!`);
        console.log(`👉 ${resData.html_url}\n`);
        prCreated = true;
      } else {
        console.warn(`GitHub API notice: ${resData.message || response.statusText}`);
      }
    } catch (e: any) {
      console.warn(`Could not reach GitHub API: ${e.message}`);
    }
  }

  const hasGh = getGitOutput('which gh');
  if (!prCreated && hasGh) {
    try {
      console.log('Checking GitHub CLI authentication...');
      execSync('gh auth status', { stdio: 'ignore' });
      console.log('Creating Pull Request with gh CLI...');
      const ghOutput = execSync(
        `gh pr create --base master --head "${currentBranch}" --title "${title.replace(/"/g, '\\"')}" --body-file "${prFilePath}"`,
        { encoding: 'utf-8' }
      ).trim();
      console.log(`\n🎉 Pull Request successfully created!`);
      console.log(`👉 ${ghOutput}\n`);
      prCreated = true;
    } catch {
      // gh not logged in or failed
    }
  }

  if (!prCreated) {
    const prUrl = `https://github.com/${repoName}/compare/master...${currentBranch}?expand=1`;

    console.log('\n===========================================================');
    console.log('📋 Pull Request Details Ready');
    console.log('===========================================================');
    console.log(`Title: ${title}`);
    console.log(`Create PR directly in browser:`);
    console.log(`👉 ${prUrl}`);
    console.log(`\n💡 To create PRs automatically without opening the browser:`);
    console.log(`   Export a GitHub token: export GITHUB_TOKEN=ghp_...`);
    console.log(`   Or authenticate GitHub CLI: gh auth login`);
    console.log('===========================================================\n');
  }

  process.exit(0);
}

submitPr().catch((err) => {
  console.error('Fatal error in submit-pr:', err);
  process.exit(1);
});
