import React, { useState } from 'react';
import {
  FlaskConical,
  Play,
  Square,
  GitCommit,
  GitBranch,
  ExternalLink,
  CheckCircle2,
  XCircle,
  TrendingUp,
  Gauge,
  Zap,
  Layers,
  Award,
  Trash2,
} from 'lucide-react';
import { NewExperimentModal } from './NewExperimentModal';

export interface ExperimentStats {
  totalGames: number;
  wins: number;
  draws: number;
  losses: number;
  winRate: number;
  elo: number;
  estimatedElo?: number;
  eloError: number;
  llr: number;
  significance?: 'positive' | 'negative' | 'inconclusive';
  pentanomial: {
    ww: number;
    wd: number;
    wlOrDd: number;
    ld: number;
    ll: number;
  };
  candidateAvgNodes: number;
  candidateAvgNps: number;
  candidateEbf: number;
  baselineAvgNodes: number;
  baselineAvgNps: number;
  baselineEbf: number;
  avgDiscMargin: number;
}

export interface Experiment {
  id: string;
  name: string;
  createdAt: string;
  status: 'running' | 'paused' | 'passed' | 'failed' | 'stopped';
  type: 'sprt' | 'fixed_games' | 'diagnostic';
  git: {
    commit: string;
    message: string;
    branch: string;
    author: string;
    isDirty: boolean;
    githubUrl?: string;
  };
  candidate: {
    engineId: string;
    name: string;
    controlType?: 'depth' | 'time';
    depth?: number;
    timeMs?: number;
  };
  baseline: {
    engineId: string;
    name: string;
    controlType?: 'depth' | 'time';
    depth?: number;
    timeMs?: number;
  };
  sprtBounds: {
    elo0: number;
    elo1: number;
    lowerBound: number;
    upperBound: number;
  };
  stats: ExperimentStats;
  recentGames: any[];
}

export interface DashboardViewProps {
  isStaticViewer?: boolean;
  availableEngines: { id: string; name: string; available: boolean; type: string }[];
  experiments: Experiment[];
  activeExperiment: Experiment | null;
  gitInfo: any;
  onStartExperiment: (params: any) => void;
  onStopExperiment: () => void;
  onClearExperiments?: () => void;
  onReplayGame?: (ggf: string) => void;
  onRunBenchmark: (engineId: string, depth: number) => Promise<any>;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  isStaticViewer = false,
  availableEngines,
  experiments,
  activeExperiment,
  gitInfo,
  onStartExperiment,
  onStopExperiment,
  onClearExperiments,
  onReplayGame,
  onRunBenchmark,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedExpId, setSelectedExpId] = useState<string | null>(null);
  const [isBenchmarkRunning, setIsBenchmarkRunning] = useState(false);
  const [benchmarkReport, setBenchmarkReport] = useState<any | null>(null);

  // Selected experiment to display in the primary monitor card
  const displayExp =
    (selectedExpId ? experiments.find((e) => e.id === selectedExpId) : null) ||
    activeExperiment ||
    experiments[0] ||
    null;

  // Global aggregate stats
  const totalGamesPlayed = experiments.reduce((acc, e) => acc + e.stats.totalGames, 0);
  const bestElo = experiments.reduce(
    (max, e) => (e.stats.elo > max ? e.stats.elo : max),
    0
  );
  const bestEstimatedElo = experiments.reduce((max, e) => {
    const est = e.stats.estimatedElo ?? Math.round(1500 + e.stats.elo);
    return est > max ? est : max;
  }, 1500);

  const handleRunDiagnostic = async () => {
    setIsBenchmarkRunning(true);
    try {
      const report = await onRunBenchmark('rothello-rust', 6);
      setBenchmarkReport(report);
    } catch (err) {
      console.error('Benchmark failed:', err);
    } finally {
      setIsBenchmarkRunning(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'running':
        return (
          <span className="flex items-center space-x-1 bg-yellow-950/70 border border-yellow-700/50 text-yellow-300 text-xs px-2.5 py-0.5 rounded-full font-mono font-bold animate-pulse">
            <span className="w-2 h-2 rounded-full bg-yellow-400 animate-ping" />
            <span>RUNNING</span>
          </span>
        );
      case 'passed':
        return (
          <span className="flex items-center space-x-1 bg-green-950/70 border border-green-700/50 text-green-300 text-xs px-2.5 py-0.5 rounded-full font-mono font-bold">
            <CheckCircle2 size={12} />
            <span>PASSED (ELO GAIN)</span>
          </span>
        );
      case 'failed':
        return (
          <span className="flex items-center space-x-1 bg-red-950/70 border border-red-700/50 text-red-300 text-xs px-2.5 py-0.5 rounded-full font-mono font-bold">
            <XCircle size={12} />
            <span>FAILED (NO GAIN)</span>
          </span>
        );
      default:
        return (
          <span className="flex items-center space-x-1 bg-gray-800 border border-gray-700 text-gray-400 text-xs px-2.5 py-0.5 rounded-full font-mono">
            <span>STOPPED</span>
          </span>
        );
    }
  };

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6">
      {/* Static Public Viewer Mode Banner */}
      {isStaticViewer && (
        <div className="bg-[#1b1916] border border-blue-900/60 rounded-xl p-3 px-4 shadow-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-blue-200">
          <div className="flex items-center space-x-2.5">
            <span className="w-2 h-2 rounded-full bg-blue-400 shrink-0 animate-pulse" />
            <span>
              <strong>Rothello Public Testing Archive</strong> — Viewing committed test results and Elo progression. Game replays are interactive! To run live self-play tests with the native Rust engine on your machine, clone the repository and run <code className="bg-[#141311] px-1.5 py-0.5 rounded text-yellow-300 font-mono">npm run dev</code>.
            </span>
          </div>
          <a
            href="https://github.com/RobertChenKFC/rothello"
            target="_blank"
            rel="noreferrer"
            className="shrink-0 px-2.5 py-1 bg-blue-950 hover:bg-blue-900 border border-blue-700/60 rounded font-semibold text-blue-200 transition text-center"
          >
            GitHub Repo ↗
          </a>
        </div>
      )}

      {/* Top Banner: Global Stats & Action Bar */}
      <div className="bg-[#1b1916] border border-[#312e29] rounded-xl p-4 shadow-lg flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Metric Summary Cards */}
        <div className="flex items-center space-x-6">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-[#25221d] border border-[#38342e] rounded-lg text-yellow-400">
              <FlaskConical size={20} />
            </div>
            <div>
              <div className="text-[10px] uppercase font-bold text-gray-500">
                Experiments
              </div>
              <div className="text-lg font-bold font-mono text-white">
                {experiments.length}
              </div>
            </div>
          </div>

          <div className="h-8 w-px bg-[#2d2a25]" />

          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-[#25221d] border border-[#38342e] rounded-lg text-green-400">
              <TrendingUp size={20} />
            </div>
            <div>
              <div className="text-[10px] uppercase font-bold text-gray-500">
                Peak Estimated Elo
              </div>
              <div className="text-lg font-bold font-mono text-green-400">
                ~{bestEstimatedElo}
                <span className="text-xs text-gray-400 font-normal ml-1.5 font-mono">
                  ({bestElo > 0 ? `+${bestElo.toFixed(0)}` : '0'} ΔElo)
                </span>
              </div>
            </div>
          </div>

          <div className="h-8 w-px bg-[#2d2a25]" />

          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-[#25221d] border border-[#38342e] rounded-lg text-blue-400">
              <Layers size={20} />
            </div>
            <div>
              <div className="text-[10px] uppercase font-bold text-gray-500">
                Total Games
              </div>
              <div className="text-lg font-bold font-mono text-white">
                {totalGamesPlayed.toLocaleString()}
              </div>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center space-x-3">
          {experiments.length > 0 && onClearExperiments && (
            <button
              onClick={() => {
                if (window.confirm('Clear all recorded experiments and start with a fresh ledger?')) {
                  onClearExperiments();
                }
              }}
              className="flex items-center space-x-1.5 px-3 py-2 bg-[#25221d] hover:bg-red-950/60 border border-[#38342e] hover:border-red-800/60 rounded-lg text-xs font-semibold text-gray-400 hover:text-red-300 transition"
              title="Clear all recorded experiment runs"
            >
              <Trash2 size={13} />
              <span>Clear Runs</span>
            </button>
          )}

          <button
            onClick={handleRunDiagnostic}
            disabled={isBenchmarkRunning}
            className="flex items-center space-x-1.5 px-3 py-2 bg-[#25221d] hover:bg-[#332f28] border border-[#38342e] rounded-lg text-xs font-semibold text-gray-200 transition"
          >
            <Zap size={14} className={isBenchmarkRunning ? 'text-yellow-400 animate-spin' : 'text-yellow-400'} />
            <span>{isBenchmarkRunning ? 'Benchmarking...' : 'Quick Benchmark'}</span>
          </button>

          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center space-x-1.5 px-4 py-2 bg-yellow-600 hover:bg-yellow-500 rounded-lg text-xs font-bold text-black transition shadow"
          >
            <Play size={14} />
            <span>New Experiment</span>
          </button>
        </div>
      </div>

      {/* Diagnostic Benchmark Modal / Banner (if recently run) */}
      {benchmarkReport && (
        <div className="bg-[#1b1916] border border-[#312e29] rounded-xl p-4 shadow-lg space-y-3 animate-in fade-in">
          <div className="flex items-center justify-between border-b border-[#2d2a25] pb-2">
            <div className="flex items-center space-x-2">
              <Zap size={16} className="text-yellow-400" />
              <span className="font-bold text-sm text-white">
                Diagnostic Benchmark Report ({benchmarkReport.engineName})
              </span>
            </div>
            <button
              onClick={() => setBenchmarkReport(null)}
              className="text-gray-500 hover:text-white text-xs"
            >
              Close
            </button>
          </div>
          <div className="grid grid-cols-4 gap-3 text-center">
            <div className="bg-[#141311] p-2 rounded border border-[#2d2a25]">
              <div className="text-[10px] text-gray-500 uppercase">Throughput</div>
              <div className="text-sm font-bold font-mono text-yellow-400">
                {(benchmarkReport.nps / 1000).toFixed(0)}k NPS
              </div>
            </div>
            <div className="bg-[#141311] p-2 rounded border border-[#2d2a25]">
              <div className="text-[10px] text-gray-500 uppercase">Branching Factor</div>
              <div className="text-sm font-bold font-mono text-green-400">
                {benchmarkReport.ebf} EBF
              </div>
            </div>
            <div className="bg-[#141311] p-2 rounded border border-[#2d2a25]">
              <div className="text-[10px] text-gray-500 uppercase">Total Nodes</div>
              <div className="text-sm font-bold font-mono text-gray-200">
                {benchmarkReport.totalNodes.toLocaleString()}
              </div>
            </div>
            <div className="bg-[#141311] p-2 rounded border border-[#2d2a25]">
              <div className="text-[10px] text-gray-500 uppercase">Elapsed Time</div>
              <div className="text-sm font-bold font-mono text-gray-200">
                {benchmarkReport.totalTimeSec.toFixed(2)}s
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Experiment Monitor Card */}
      {displayExp ? (
        <div className="bg-[#1b1916] border border-[#312e29] rounded-xl p-5 shadow-xl space-y-5">
          {/* Card Header */}
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 border-b border-[#2d2a25] pb-4">
            <div className="space-y-1">
              <div className="flex items-center space-x-3">
                <h3 className="text-lg font-bold text-white">{displayExp.name}</h3>
                {getStatusBadge(displayExp.status)}
              </div>
              {/* Linked Git Commit Metadata */}
              <div className="flex items-center space-x-2 text-xs font-mono text-gray-400">
                <span className="flex items-center space-x-1 text-yellow-400 font-bold bg-[#24211d] px-2 py-0.5 rounded border border-[#38342e]">
                  <GitCommit size={12} />
                  <span>{displayExp.git.commit}</span>
                </span>
                <span className="flex items-center space-x-1 text-gray-400">
                  <GitBranch size={12} />
                  <span>{displayExp.git.branch}</span>
                </span>
                <span className="text-gray-400 truncate max-w-md">
                  {displayExp.git.message}
                </span>
                {displayExp.git.githubUrl && (
                  <a
                    href={displayExp.git.githubUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-blue-400 hover:underline flex items-center space-x-0.5"
                  >
                    <ExternalLink size={11} />
                  </a>
                )}
              </div>
            </div>

            {displayExp.status === 'running' && (
              <button
                onClick={onStopExperiment}
                className="flex items-center space-x-1 px-3 py-1.5 bg-red-950/60 hover:bg-red-900/80 border border-red-800/60 rounded text-xs font-bold text-red-300 transition"
              >
                <Square size={13} />
                <span>Stop Run</span>
              </button>
            )}
          </div>

          {/* SPRT Wald Gauge Bar */}
          <div className="bg-[#141311] border border-[#2d2a25] p-3 rounded-lg space-y-2">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center space-x-1.5 text-gray-400 font-semibold">
                <Gauge size={14} className="text-yellow-500" />
                <span>SPRT Log-Likelihood Ratio (LLR)</span>
              </div>
              <div className="font-mono text-xs">
                <span className="text-gray-500 mr-2">
                  Bounds: [{displayExp.sprtBounds.lowerBound.toFixed(2)}, {displayExp.sprtBounds.upperBound.toFixed(2)}]
                </span>
                <span className="font-bold text-yellow-400">
                  LLR: {displayExp.stats.llr.toFixed(2)}
                </span>
              </div>
            </div>

            {/* Visual SPRT Bar */}
            <div className="relative w-full h-3 bg-[#24211d] rounded-full overflow-hidden border border-[#38342e]">
              {/* Lower threshold marker (Fail) */}
              <div
                className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-10"
                style={{ left: '15%' }}
                title="Lower Bound (Fail)"
              />
              {/* Neutral zero marker */}
              <div
                className="absolute top-0 bottom-0 w-0.5 bg-gray-600 z-10"
                style={{ left: '50%' }}
                title="Zero LLR"
              />
              {/* Upper threshold marker (Pass) */}
              <div
                className="absolute top-0 bottom-0 w-0.5 bg-green-500 z-10"
                style={{ left: '85%' }}
                title="Upper Bound (Pass)"
              />
              {/* Dynamic LLR Position Needle */}
              {(() => {
                const norm = Math.max(
                  -3.5,
                  Math.min(3.5, displayExp.stats.llr)
                );
                const pct = ((norm + 3.5) / 7.0) * 100;
                return (
                  <div
                    className="absolute top-0 bottom-0 w-2.5 bg-yellow-400 rounded-full shadow-md -translate-x-1/2 transition-all duration-300"
                    style={{ left: `${pct}%` }}
                  />
                );
              })()}
            </div>
            <div className="flex items-center justify-between text-[10px] text-gray-500 font-mono">
              <span className="text-red-400 font-semibold">Fail Threshold (-2.94)</span>
              <span>0.00</span>
              <span className="text-green-400 font-semibold">Pass Threshold (+2.94)</span>
            </div>
          </div>

          {/* Elo & W-D-L Statistics Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Estimated Elo & Delta Elo Card */}
            <div className="bg-[#141311] border border-[#2d2a25] p-3 rounded-lg text-center flex flex-col justify-center">
              <div className="text-[10px] uppercase font-bold text-gray-500">
                Estimated Elo
              </div>
              <div className="text-2xl font-bold font-mono mt-1 text-white">
                ~{displayExp.stats.estimatedElo ?? Math.round(1500 + displayExp.stats.elo)}
              </div>
              <div className="text-[11px] font-mono mt-0.5">
                <span
                  className={
                    displayExp.stats.significance === 'positive'
                      ? 'text-green-400 font-bold'
                      : displayExp.stats.significance === 'negative'
                      ? 'text-red-400 font-bold'
                      : 'text-yellow-400'
                  }
                >
                  ΔElo: {displayExp.stats.elo > 0 ? `+${displayExp.stats.elo.toFixed(1)}` : displayExp.stats.elo.toFixed(1)}
                </span>{' '}
                <span className="text-gray-400">± {displayExp.stats.eloError.toFixed(1)} (95% CI)</span>
              </div>
              <div className="mt-1">
                {displayExp.stats.significance === 'positive' ? (
                  <span className="text-[10px] font-mono text-green-400 bg-green-950/60 border border-green-800/60 px-1.5 py-0.5 rounded">
                    ✓ Significant Gain
                  </span>
                ) : displayExp.stats.significance === 'negative' ? (
                  <span className="text-[10px] font-mono text-red-400 bg-red-950/60 border border-red-800/60 px-1.5 py-0.5 rounded">
                    ✗ Significant Loss
                  </span>
                ) : (
                  <span className="text-[10px] font-mono text-yellow-300/80 bg-yellow-950/40 border border-yellow-800/40 px-1.5 py-0.5 rounded">
                    ~ Inconclusive (CI spans 0)
                  </span>
                )}
              </div>
            </div>

            {/* Win / Draw / Loss Record */}
            <div className="bg-[#141311] border border-[#2d2a25] p-3 rounded-lg text-center flex flex-col justify-center">
              <div className="text-[10px] uppercase font-bold text-gray-500">
                Match Record ({displayExp.stats.totalGames} Games)
              </div>
              <div className="text-lg font-bold font-mono text-white mt-1">
                <span className="text-green-400">{displayExp.stats.wins} W</span> -{' '}
                <span className="text-gray-400">{displayExp.stats.draws} D</span> -{' '}
                <span className="text-red-400">{displayExp.stats.losses} L</span>
              </div>
              <div className="text-[11px] font-mono text-yellow-400 mt-0.5">
                Win Rate: {(displayExp.stats.winRate * 100).toFixed(1)}%
              </div>
            </div>

            {/* Pentanomial Pair Stats */}
            <div className="bg-[#141311] border border-[#2d2a25] p-3 rounded-lg flex flex-col justify-center">
              <div className="text-[10px] uppercase font-bold text-gray-500 text-center mb-1">
                Pentanomial Distribution (2-Game Pairs)
              </div>
              <div className="grid grid-cols-5 gap-1 text-center font-mono text-[11px]">
                <div className="bg-[#1e1c18] p-1 rounded">
                  <div className="text-[9px] text-green-400 font-bold">2-0</div>
                  <div className="font-bold text-white">
                    {displayExp.stats.pentanomial.ww}
                  </div>
                </div>
                <div className="bg-[#1e1c18] p-1 rounded">
                  <div className="text-[9px] text-green-300">1.5-0.5</div>
                  <div className="font-bold text-white">
                    {displayExp.stats.pentanomial.wd}
                  </div>
                </div>
                <div className="bg-[#1e1c18] p-1 rounded">
                  <div className="text-[9px] text-gray-400">1-1</div>
                  <div className="font-bold text-white">
                    {displayExp.stats.pentanomial.wlOrDd}
                  </div>
                </div>
                <div className="bg-[#1e1c18] p-1 rounded">
                  <div className="text-[9px] text-red-300">0.5-1.5</div>
                  <div className="font-bold text-white">
                    {displayExp.stats.pentanomial.ld}
                  </div>
                </div>
                <div className="bg-[#1e1c18] p-1 rounded">
                  <div className="text-[9px] text-red-400 font-bold">0-2</div>
                  <div className="font-bold text-white">
                    {displayExp.stats.pentanomial.ll}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Engine Setup Comparison Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Candidate Configuration */}
            <div className="bg-[#141311] border border-[#2d2a25] p-3 rounded-lg space-y-2">
              <div className="flex items-center justify-between pb-1 border-b border-[#262420]">
                <span className="font-bold text-xs text-yellow-400">
                  Candidate Engine
                </span>
                <span className="text-[10px] font-mono text-gray-400">
                  {displayExp.candidate.controlType === 'time'
                    ? `${displayExp.candidate.timeMs}ms/move`
                    : `d=${displayExp.candidate.depth}`}
                </span>
              </div>
              <div className="text-sm font-semibold text-white">
                {displayExp.candidate.name}
              </div>
              <div className="text-[11px] text-gray-500 font-mono">
                Engine ID: {displayExp.candidate.engineId}
              </div>
            </div>

            {/* Baseline Configuration */}
            <div className="bg-[#141311] border border-[#2d2a25] p-3 rounded-lg space-y-2">
              <div className="flex items-center justify-between pb-1 border-b border-[#262420]">
                <span className="font-bold text-xs text-gray-400">
                  Baseline Engine
                </span>
                <span className="text-[10px] font-mono text-gray-400">
                  {displayExp.baseline.controlType === 'time'
                    ? `${displayExp.baseline.timeMs}ms/move`
                    : `d=${displayExp.baseline.depth}`}
                </span>
              </div>
              <div className="text-sm font-semibold text-white">
                {displayExp.baseline.name}
              </div>
              <div className="text-[11px] text-gray-500 font-mono">
                Engine ID: {displayExp.baseline.engineId}
              </div>
            </div>
          </div>

          {/* Recent Game Pairs Feed */}
          {displayExp.recentGames && displayExp.recentGames.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-[#2d2a25]">
              <div className="flex items-center justify-between text-xs text-gray-400 font-semibold px-1">
                <span>Recent 2-Game Pairs Stream</span>
                <span>Pair Score</span>
              </div>
              <div className="space-y-1.5 max-h-52 overflow-y-auto font-mono text-xs">
                {displayExp.recentGames.map((pair, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between bg-[#141311] border border-[#262420] p-2 rounded hover:bg-[#1a1815] transition"
                  >
                    <div className="flex items-center space-x-3">
                      <span className="text-gray-500 font-bold">#{pair.pairId}</span>
                      <span className="text-gray-300 font-sans">{pair.openingName}</span>
                      <span className="text-[11px] text-gray-400">
                        G1: {pair.game1.candDiscs}-{pair.game1.baseDiscs} (
                        {pair.game1.winner === 'candidate'
                          ? 'Win'
                          : pair.game1.winner === 'baseline'
                          ? 'Loss'
                          : 'Draw'}
                        )
                      </span>
                      <span className="text-[11px] text-gray-400">
                        G2: {pair.game2.candDiscs}-{pair.game2.baseDiscs} (
                        {pair.game2.winner === 'candidate'
                          ? 'Win'
                          : pair.game2.winner === 'baseline'
                          ? 'Loss'
                          : 'Draw'}
                        )
                      </span>
                    </div>

                    <div className="flex items-center space-x-3">
                      <span
                        className={`font-bold ${
                          pair.candidatePairScore > 1
                            ? 'text-green-400'
                            : pair.candidatePairScore < 1
                            ? 'text-red-400'
                            : 'text-gray-300'
                        }`}
                      >
                        {pair.candidatePairScore} - {2 - pair.candidatePairScore}
                      </span>
                      {onReplayGame && (
                        <button
                          onClick={() => onReplayGame(pair.game1.ggf)}
                          title="Replay Game 1 in Arena"
                          className="text-[10px] text-yellow-400 hover:underline flex items-center space-x-0.5"
                        >
                          <span>Replay</span>
                          <ExternalLink size={10} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-[#1b1916] border border-[#312e29] rounded-xl p-12 text-center text-gray-400 space-y-3">
          <FlaskConical size={36} className="mx-auto text-yellow-500/70" />
          <h3 className="text-base font-bold text-white">No Experiments Run Yet</h3>
          <p className="text-xs text-gray-400 max-w-md mx-auto">
            Launch your first Fishtest-style SPRT self-play test to evaluate candidate changes against baseline.
          </p>
          <button
            onClick={() => setIsModalOpen(true)}
            className="px-4 py-2 bg-yellow-600 hover:bg-yellow-500 text-black font-bold text-xs rounded transition"
          >
            Launch First Experiment
          </button>
        </div>
      )}

      {/* Historical Experiment Ledger Table */}
      {experiments.length > 0 && (
        <div className="bg-[#1b1916] border border-[#312e29] rounded-xl p-4 shadow-lg space-y-3">
          <div className="flex items-center justify-between border-b border-[#2d2a25] pb-2">
            <span className="font-bold text-sm text-white flex items-center space-x-1.5">
              <Award size={15} className="text-yellow-400" />
              <span>Experiment History Ledger</span>
            </span>
            <span className="text-xs text-gray-500 font-mono">
              {experiments.length} runs recorded
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead>
                <tr className="text-gray-500 border-b border-[#2d2a25]">
                  <th className="py-2 px-3">Date</th>
                  <th className="py-2 px-3">Experiment</th>
                  <th className="py-2 px-3">Commit</th>
                  <th className="py-2 px-3">Candidate</th>
                  <th className="py-2 px-3">Baseline</th>
                  <th className="py-2 px-3 text-center">Games</th>
                  <th className="py-2 px-3 text-center">Estimated Elo</th>
                  <th className="py-2 px-3 text-center">ΔElo ± CI</th>
                  <th className="py-2 px-3 text-center">Status</th>
                  <th className="py-2 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#262420]">
                {experiments.map((exp) => (
                  <tr
                    key={exp.id}
                    className={`hover:bg-[#25221d] transition ${
                      displayExp?.id === exp.id ? 'bg-[#25221d]/70' : ''
                    }`}
                  >
                    <td className="py-2 px-3 text-gray-400">
                      {new Date(exp.createdAt).toLocaleDateString()}
                    </td>
                    <td className="py-2 px-3 font-sans font-semibold text-gray-200">
                      {exp.name}
                    </td>
                    <td className="py-2 px-3 text-yellow-400 font-bold">
                      {exp.git.commit}
                    </td>
                    <td className="py-2 px-3 text-gray-300">
                      {exp.candidate.name} (
                      {exp.candidate.controlType === 'time'
                        ? `${exp.candidate.timeMs}ms`
                        : `d=${exp.candidate.depth}`}
                      )
                    </td>
                    <td className="py-2 px-3 text-gray-400">
                      {exp.baseline.name} (
                      {exp.baseline.controlType === 'time'
                        ? `${exp.baseline.timeMs}ms`
                        : `d=${exp.baseline.depth}`}
                      )
                    </td>
                    <td className="py-2 px-3 text-center font-bold text-white">
                      {exp.stats.totalGames}
                    </td>
                    <td className="py-2 px-3 text-center font-bold text-yellow-400">
                      ~{exp.stats.estimatedElo ?? Math.round(1500 + exp.stats.elo)}
                    </td>
                    <td className="py-2 px-3 text-center font-bold">
                      <span
                        className={
                          exp.stats.significance === 'positive'
                            ? 'text-green-400 font-bold'
                            : exp.stats.significance === 'negative'
                            ? 'text-red-400 font-bold'
                            : 'text-yellow-300/80 font-normal'
                        }
                      >
                        {exp.stats.elo > 0
                          ? `+${exp.stats.elo.toFixed(1)}`
                          : exp.stats.elo.toFixed(1)}{' '}
                        ± {exp.stats.eloError.toFixed(1)}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-center">
                      {getStatusBadge(exp.status)}
                    </td>
                    <td className="py-2 px-3 text-right">
                      <button
                        onClick={() => setSelectedExpId(exp.id)}
                        className="text-yellow-400 hover:underline text-xs"
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* New Experiment Modal */}
      <NewExperimentModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        availableEngines={availableEngines}
        gitInfo={gitInfo}
        onStartExperiment={onStartExperiment}
      />
    </div>
  );
};
