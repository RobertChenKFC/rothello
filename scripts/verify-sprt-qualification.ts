import fs from 'fs';
import path from 'path';

function verifyQualification() {
  const projectRoot = path.resolve(__dirname, '..');
  const ledgerPath = path.resolve(projectRoot, 'public/data/ledger.json');

  if (!fs.existsSync(ledgerPath)) {
    console.error('❌ SPRT Qualification Check FAILED: No ledger.json found at public/data/ledger.json.');
    console.error('   Every PR must run a local SPRT experiment before merging: npm run experiment');
    process.exit(1);
  }

  let experiments: any[] = [];
  try {
    experiments = JSON.parse(fs.readFileSync(ledgerPath, 'utf-8'));
  } catch (err) {
    console.error('❌ SPRT Qualification Check FAILED: Corrupted ledger.json:', err);
    process.exit(1);
  }

  if (experiments.length === 0) {
    console.error('❌ SPRT Qualification Check FAILED: Experiment ledger is empty.');
    process.exit(1);
  }

  const latest = experiments[0];
  console.log('===========================================================');
  console.log('🔍 SPRT Pull Request Qualification Check');
  console.log('===========================================================');
  console.log(`Experiment:    "${latest.name}" (${latest.id})`);
  console.log(`Candidate:     ${latest.candidate.name} (${latest.git?.commit || 'unknown'})`);
  console.log(`Baseline:      ${latest.baseline.name}`);
  console.log(`Score:         ${latest.stats.wins}W - ${latest.stats.draws}D - ${latest.stats.losses}L / ${latest.stats.totalGames} games`);
  console.log(`Elo Diff:      ${latest.stats.elo >= 0 ? '+' : ''}${latest.stats.elo.toFixed(1)} ± ${latest.stats.eloError.toFixed(1)} Elo`);
  console.log(`LLR:           ${latest.stats.llr.toFixed(2)} [${latest.sprtBounds?.lowerBound?.toFixed(2) ?? -2.94}, ${latest.sprtBounds?.upperBound?.toFixed(2) ?? 2.94}]`);
  console.log(`Status:        ${latest.status?.toUpperCase()}`);
  console.log('===========================================================');

  if (latest.status === 'passed' && latest.stats.elo > 0) {
    console.log('\n✅ QUALIFICATION PASSED!');
    console.log(`   Candidate demonstrated statistically significant positive Elo (+${latest.stats.elo.toFixed(1)} Elo).`);
    console.log('   PR is qualified to merge into master.\n');
    process.exit(0);
  }

  if (latest.status === 'inconclusive' || latest.status === 'stopped') {
    console.error('\n❌ QUALIFICATION BLOCKED: Inconclusive SPRT result.');
    console.error(`   The 95% confidence interval (±${latest.stats.eloError.toFixed(1)} Elo) crosses zero.`);
    console.error('   SPRT significance bounds were not reached. Merging to master is BLOCKED.');
    console.error('   Action: Run more game pairs using "npm run experiment" until SPRT decides (LLR >= 2.94).\n');
    process.exit(1);
  }

  if (latest.status === 'failed' || latest.stats.elo <= 0) {
    console.error('\n❌ QUALIFICATION BLOCKED: SPRT Regression Detected.');
    console.error(`   The candidate produced a negative or null Elo diff (${latest.stats.elo.toFixed(1)} Elo).`);
    console.error('   Merging to master is BLOCKED.\n');
    process.exit(1);
  }

  console.error(`\n❌ QUALIFICATION BLOCKED: Unrecognized experiment status "${latest.status}".`);
  process.exit(1);
}

verifyQualification();
