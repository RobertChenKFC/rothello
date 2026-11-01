import React, { useState } from 'react';
import { Zap, Play, Layers } from 'lucide-react';

export interface BenchmarkReport {
  timestamp: string;
  engineId: string;
  engineName: string;
  searchDepth: number;
  totalNodes: number;
  totalTimeSec: number;
  nps: number;
  ebf: number;
  moveAgreement: number;
  positions: {
    id: string;
    name: string;
    bestMove: string;
    score: number;
    nodes: number;
    timeSec: number;
  }[];
}

interface BenchmarkViewProps {
  availableEngines: { id: string; name: string; available: boolean; type: string }[];
  onRunBenchmark: (engineId: string, durationSec?: number) => Promise<BenchmarkReport>;
}

export const BenchmarkView: React.FC<BenchmarkViewProps> = ({
  availableEngines,
  onRunBenchmark,
}) => {
  const [runningEngineId, setRunningEngineId] = useState<string | null>(null);
  const [reports, setReports] = useState<Record<string, BenchmarkReport>>({});

  const handleBenchmarkSingle = async (engineId: string) => {
    setRunningEngineId(engineId);
    try {
      const rep = await onRunBenchmark(engineId, 10);
      setReports((prev) => ({ ...prev, [engineId]: rep }));
    } catch (err) {
      console.error('Benchmark failed for engine:', engineId, err);
    } finally {
      setRunningEngineId(null);
    }
  };

  const handleBenchmarkAll = async () => {
    for (const eng of availableEngines) {
      if (!eng.available) continue;
      await handleBenchmarkSingle(eng.id);
    }
  };

  // Find max NPS for relative scaling bar chart
  const maxNps = Object.values(reports).reduce((max, r) => (r.nps > max ? r.nps : max), 1);

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6">
      {/* Header Banner */}
      <div className="bg-[#1b1916] border border-[#312e29] rounded-xl p-5 shadow-lg flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <div className="p-2 bg-[#25221d] border border-[#38342e] rounded-lg text-yellow-400">
              <Zap size={22} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Engine Performance Benchmarks</h2>
              <p className="text-xs text-gray-400">
                10-second steady-state hardware throughput (NPS), branch factor, and tactical move agreement across engines.
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={handleBenchmarkAll}
          disabled={runningEngineId !== null}
          className="flex items-center space-x-2 px-4 py-2.5 bg-yellow-600 hover:bg-yellow-500 rounded-lg text-xs font-bold text-black transition shadow disabled:opacity-50"
        >
          <Play size={14} className={runningEngineId ? 'animate-spin' : ''} />
          <span>{runningEngineId ? 'Running Benchmarks...' : 'Benchmark All Engines (10s each)'}</span>
        </button>
      </div>

      {/* Engine Comparison Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {availableEngines.map((eng) => {
          const report = reports[eng.id];
          const isRunning = runningEngineId === eng.id;
          const relativePercent = report ? Math.round((report.nps / maxNps) * 100) : 0;

          return (
            <div
              key={eng.id}
              className={`bg-[#1b1916] border ${
                eng.id === 'rothello-rust'
                  ? 'border-yellow-600/50'
                  : 'border-[#312e29]'
              } rounded-xl p-4 shadow-lg flex flex-col justify-between space-y-4`}
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-bold text-sm text-white block">{eng.name}</span>
                    <span className="text-[10px] text-gray-500 font-mono">
                      Type: {eng.type} | ID: {eng.id}
                    </span>
                  </div>
                  {eng.id === 'rothello-rust' && (
                    <span className="text-[10px] font-mono font-bold bg-yellow-950/70 border border-yellow-700/50 text-yellow-400 px-2 py-0.5 rounded">
                      PRIMARY
                    </span>
                  )}
                </div>

                {report ? (
                  <div className="space-y-2.5 pt-1">
                    <div className="bg-[#141311] border border-[#2d2a25] p-3 rounded-lg text-center">
                      <div className="text-[10px] uppercase font-bold text-gray-500">
                        Steady-State NPS
                      </div>
                      <div className="text-2xl font-bold font-mono text-yellow-400 mt-0.5">
                        {report.nps >= 1_000_000
                          ? `${(report.nps / 1_000_000).toFixed(2)}M`
                          : `${(report.nps / 1000).toFixed(0)}k`}{' '}
                        <span className="text-xs text-gray-400 font-normal">NPS</span>
                      </div>
                      <div className="text-[11px] font-mono text-gray-400 mt-0.5">
                        {report.totalNodes.toLocaleString()} nodes in {report.totalTimeSec.toFixed(1)}s
                      </div>
                    </div>

                    {/* Relative throughput bar */}
                    <div>
                      <div className="flex justify-between text-[10px] font-mono text-gray-400 mb-1">
                        <span>Throughput Index</span>
                        <span className="text-yellow-400 font-bold">{relativePercent}%</span>
                      </div>
                      <div className="w-full h-2 bg-[#141311] rounded-full overflow-hidden border border-[#2d2a25]">
                        <div
                          className="h-full bg-gradient-to-r from-yellow-600 to-yellow-400 rounded-full transition-all duration-500"
                          style={{ width: `${relativePercent}%` }}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-center text-xs font-mono pt-1">
                      <div className="bg-[#141311] p-1.5 rounded border border-[#2d2a25]">
                        <div className="text-[9px] text-gray-500 uppercase">Branching Factor</div>
                        <div className="font-bold text-green-400">{report.ebf} EBF</div>
                      </div>
                      <div className="bg-[#141311] p-1.5 rounded border border-[#2d2a25]">
                        <div className="text-[9px] text-gray-500 uppercase">Agreement</div>
                        <div className="font-bold text-blue-400">{report.moveAgreement}%</div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="bg-[#141311] border border-[#2d2a25] rounded-lg p-6 text-center text-gray-500 text-xs">
                    No benchmark recorded yet.
                  </div>
                )}
              </div>

              <button
                onClick={() => handleBenchmarkSingle(eng.id)}
                disabled={runningEngineId !== null}
                className="w-full flex items-center justify-center space-x-1.5 px-3 py-2 bg-[#25221d] hover:bg-[#332f28] border border-[#38342e] rounded-lg text-xs font-semibold text-gray-200 transition disabled:opacity-50"
              >
                <Zap size={13} className={isRunning ? 'text-yellow-400 animate-spin' : 'text-yellow-400'} />
                <span>{isRunning ? 'Running (10s)...' : 'Run 10s Benchmark'}</span>
              </button>
            </div>
          );
        })}
      </div>

      {/* Position Breakdown Table (if any benchmark has run) */}
      {Object.keys(reports).length > 0 && (
        <div className="bg-[#1b1916] border border-[#312e29] rounded-xl p-5 shadow-lg space-y-4">
          <div className="flex items-center space-x-2 border-b border-[#2d2a25] pb-3">
            <Layers size={16} className="text-yellow-400" />
            <h3 className="text-sm font-bold text-white">
              Tactical Position Breakdown (10 Benchmark Positions)
            </h3>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead>
                <tr className="text-gray-500 border-b border-[#2d2a25]">
                  <th className="py-2 px-3">Position Name</th>
                  {Object.values(reports).map((r) => (
                    <th key={r.engineId} className="py-2 px-3 text-center">
                      {r.engineName}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#262420]">
                {reports[Object.keys(reports)[0]]?.positions.map((pos, idx) => (
                  <tr key={pos.id} className="hover:bg-[#25221d]/50 transition">
                    <td className="py-2.5 px-3 font-semibold text-gray-200">
                      {pos.name}
                    </td>
                    {Object.values(reports).map((r) => {
                      const p = r.positions[idx];
                      return (
                        <td key={r.engineId} className="py-2.5 px-3 text-center">
                          {p ? (
                            <div className="space-y-0.5">
                              <span className="font-bold text-yellow-400">{p.bestMove}</span>
                              <div className="text-[10px] text-gray-400">
                                {p.nodes.toLocaleString()} nodes ({(p.score).toFixed(1)})
                              </div>
                            </div>
                          ) : (
                            <span className="text-gray-600">-</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
