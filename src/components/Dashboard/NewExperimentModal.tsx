import React, { useState } from 'react';
import { GitCommit, GitBranch, AlertCircle, Play, X } from 'lucide-react';

interface NewExperimentModalProps {
  isOpen: boolean;
  onClose: () => void;
  availableEngines: { id: string; name: string; available: boolean; type: string }[];
  gitInfo: {
    commit: string;
    message: string;
    branch: string;
    author: string;
    isDirty: boolean;
    githubUrl?: string;
  } | null;
  onStartExperiment: (params: {
    name: string;
    controlType: 'depth' | 'time';
    candidateEngineId: string;
    candidateDepth: number;
    candidateTimeMs: number;
    baselineEngineId: string;
    baselineDepth: number;
    baselineTimeMs: number;
    baselineAnchorElo: number;
    elo0: number;
    elo1: number;
    type: 'sprt' | 'fixed_games';
    maxGames: number;
  }) => void;
}

export const NewExperimentModal: React.FC<NewExperimentModalProps> = ({
  isOpen,
  onClose,
  availableEngines,
  gitInfo,
  onStartExperiment,
}) => {
  const [name, setName] = useState('');
  const [controlType, setControlType] = useState<'depth' | 'time'>('depth');
  const [candidateEngineId, setCandidateEngineId] = useState('rothello-rust');
  const [candidateDepth, setCandidateDepth] = useState(6);
  const [candidateTimeMs, setCandidateTimeMs] = useState(100);
  const [baselineEngineId, setBaselineEngineId] = useState('rothello-rust');
  const [baselineDepth, setBaselineDepth] = useState(4);
  const [baselineTimeMs, setBaselineTimeMs] = useState(100);
  const [baselineAnchorElo, setBaselineAnchorElo] = useState(1500);
  const [testType, setTestType] = useState<'sprt' | 'fixed_games'>('sprt');
  const [elo0, setElo0] = useState(0.0);
  const [elo1, setElo1] = useState(5.0);
  const [maxGames, setMaxGames] = useState(100);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const defaultName =
      controlType === 'time'
        ? `Time Control: Rust ${candidateTimeMs}ms vs ${baselineEngineId === 'rothello-rust' ? `Rust ${baselineTimeMs}ms` : baselineEngineId}`
        : `Self-Play: Rust d=${candidateDepth} vs ${baselineEngineId === 'rothello-rust' ? `Rust d=${baselineDepth}` : baselineEngineId}`;

    onStartExperiment({
      name: name.trim() || defaultName,
      controlType,
      candidateEngineId,
      candidateDepth,
      candidateTimeMs,
      baselineEngineId,
      baselineDepth,
      baselineTimeMs,
      baselineAnchorElo,
      elo0,
      elo1,
      type: testType,
      maxGames,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#1f1d19] border border-[#3c3831] rounded-xl shadow-2xl max-w-xl w-full p-6 text-gray-200 space-y-5 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#312e29] pb-3">
          <div>
            <h2 className="text-base font-bold text-white flex items-center space-x-2">
              <span>Launch Self-Play Experiment (Fishtest / SPRT)</span>
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">
              Statistically test candidate improvements using 2-game color-alternating pairs.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-[#312e29] text-gray-400 hover:text-white transition"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {/* Git Commit Metadata Banner */}
          {gitInfo && (
            <div className="bg-[#171614] border border-[#2d2a25] rounded-lg p-2.5 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase font-bold text-gray-500">
                  Target Candidate Git Commit
                </span>
                {gitInfo.isDirty && (
                  <span className="flex items-center space-x-1 text-yellow-400 text-[10px] font-semibold bg-yellow-950/50 px-1.5 py-0.5 rounded border border-yellow-800/40">
                    <AlertCircle size={10} />
                    <span>Uncommitted changes</span>
                  </span>
                )}
              </div>
              <div className="flex items-center space-x-3 text-gray-300 font-mono text-[11px]">
                <span className="flex items-center space-x-1 text-yellow-400 font-bold bg-[#24211d] px-1.5 py-0.5 rounded border border-[#38342e]">
                  <GitCommit size={12} />
                  <span>{gitInfo.commit}</span>
                </span>
                <span className="flex items-center space-x-1 text-gray-400">
                  <GitBranch size={12} />
                  <span>{gitInfo.branch}</span>
                </span>
                <span className="text-gray-400 truncate max-w-xs">{gitInfo.message}</span>
              </div>
            </div>
          )}

          {/* Experiment Name */}
          <div className="space-y-1">
            <label className="font-semibold text-gray-300">Experiment Name / Description</label>
            <input
              type="text"
              placeholder={`e.g. Corner mobility weight increase (${gitInfo?.commit || 'cand'})`}
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-[#171614] border border-[#38342e] rounded px-3 py-2 text-white focus:outline-none focus:border-yellow-500"
            />
          </div>

          {/* Resource Control Mode: Fixed Depth vs Fixed Time Control */}
          <div className="bg-[#171614] border border-[#2d2a25] p-3 rounded-lg space-y-2">
            <span className="font-semibold text-gray-300 block">Test Resource Control</span>
            <div className="grid grid-cols-2 gap-3">
              <label
                className={`flex items-start space-x-2 p-2 rounded border cursor-pointer transition ${
                  controlType === 'depth'
                    ? 'bg-[#25221d] border-yellow-500/70 text-white'
                    : 'bg-[#1b1916] border-[#312e29] text-gray-400'
                }`}
              >
                <input
                  type="radio"
                  name="controlType"
                  checked={controlType === 'depth'}
                  onChange={() => setControlType('depth')}
                  className="accent-yellow-500 mt-0.5"
                />
                <div>
                  <div className="font-bold text-xs">Fixed Depth Mode</div>
                  <div className="text-[10px] text-gray-500">
                    Tests pruning & evaluation heuristics per ply
                  </div>
                </div>
              </label>

              <label
                className={`flex items-start space-x-2 p-2 rounded border cursor-pointer transition ${
                  controlType === 'time'
                    ? 'bg-[#25221d] border-yellow-500/70 text-white'
                    : 'bg-[#1b1916] border-[#312e29] text-gray-400'
                }`}
              >
                <input
                  type="radio"
                  name="controlType"
                  checked={controlType === 'time'}
                  onChange={() => setControlType('time')}
                  className="accent-yellow-500 mt-0.5"
                />
                <div>
                  <div className="font-bold text-xs">Fixed Time Control (TC)</div>
                  <div className="text-[10px] text-gray-500">
                    Measures raw NPS speedups via iterative deepening
                  </div>
                </div>
              </label>
            </div>
          </div>

          {/* Engines and Depths / Time Selection */}
          <div className="grid grid-cols-2 gap-3">
            {/* Candidate */}
            <div className="bg-[#171614] border border-[#2d2a25] p-3 rounded-lg space-y-2">
              <span className="font-bold text-yellow-400 block">Candidate (New)</span>
              <div>
                <label className="text-[10px] text-gray-500 block mb-1">Engine</label>
                <select
                  value={candidateEngineId}
                  onChange={(e) => setCandidateEngineId(e.target.value)}
                  className="w-full bg-[#24211d] text-white font-semibold rounded px-2 py-1.5 border border-[#38342e]"
                >
                  {availableEngines.map((e) => (
                    <option key={e.id} value={e.id} disabled={!e.available}>
                      {e.name}
                    </option>
                  ))}
                </select>
              </div>
              {controlType === 'depth' ? (
                <div>
                  <label className="text-[10px] text-gray-500 block mb-1">Search Depth (Plies)</label>
                  <input
                    type="number"
                    min={2}
                    max={20}
                    value={candidateDepth}
                    onChange={(e) => setCandidateDepth(parseInt(e.target.value, 10) || 6)}
                    className="w-full bg-[#24211d] text-white font-mono rounded px-2 py-1 border border-[#38342e]"
                  />
                </div>
              ) : (
                <div>
                  <label className="text-[10px] text-gray-500 block mb-1">Time Limit (ms / move)</label>
                  <input
                    type="number"
                    min={10}
                    max={5000}
                    step={25}
                    value={candidateTimeMs}
                    onChange={(e) => setCandidateTimeMs(parseInt(e.target.value, 10) || 100)}
                    className="w-full bg-[#24211d] text-yellow-400 font-mono rounded px-2 py-1 border border-[#38342e]"
                  />
                </div>
              )}
            </div>

            {/* Baseline */}
            <div className="bg-[#171614] border border-[#2d2a25] p-3 rounded-lg space-y-2">
              <span className="font-bold text-gray-400 block">Baseline (Reference)</span>
              <div>
                <label className="text-[10px] text-gray-500 block mb-1">Engine / Baseline</label>
                <select
                  value={baselineEngineId}
                  onChange={(e) => setBaselineEngineId(e.target.value)}
                  className="w-full bg-[#24211d] text-white font-semibold rounded px-2 py-1.5 border border-[#38342e]"
                >
                  {availableEngines.map((e) => (
                    <option key={e.id} value={e.id} disabled={!e.available}>
                      {e.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {controlType === 'depth' ? (
                  <div>
                    <label className="text-[10px] text-gray-500 block mb-1">Depth</label>
                    <input
                      type="number"
                      min={2}
                      max={20}
                      value={baselineDepth}
                      onChange={(e) => setBaselineDepth(parseInt(e.target.value, 10) || 6)}
                      className="w-full bg-[#24211d] text-white font-mono rounded px-2 py-1 border border-[#38342e]"
                    />
                  </div>
                ) : (
                  <div>
                    <label className="text-[10px] text-gray-500 block mb-1">Time (ms)</label>
                    <input
                      type="number"
                      min={10}
                      max={5000}
                      step={25}
                      value={baselineTimeMs}
                      onChange={(e) => setBaselineTimeMs(parseInt(e.target.value, 10) || 100)}
                      className="w-full bg-[#24211d] text-yellow-400 font-mono rounded px-2 py-1 border border-[#38342e]"
                    />
                  </div>
                )}
                <div>
                  <label className="text-[10px] text-gray-500 block mb-1">Anchor Elo</label>
                  <input
                    type="number"
                    min={100}
                    max={4000}
                    step={50}
                    value={baselineAnchorElo}
                    onChange={(e) => setBaselineAnchorElo(parseInt(e.target.value, 10) || 1500)}
                    className="w-full bg-[#24211d] text-yellow-400 font-mono rounded px-2 py-1 border border-[#38342e]"
                    title="Reference baseline rating to estimate absolute candidate Elo"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Test Type & SPRT Settings */}
          <div className="bg-[#171614] border border-[#2d2a25] p-3 rounded-lg space-y-3">
            <div className="flex items-center space-x-4">
              <label className="flex items-center space-x-1.5 cursor-pointer">
                <input
                  type="radio"
                  name="testType"
                  checked={testType === 'sprt'}
                  onChange={() => setTestType('sprt')}
                  className="accent-yellow-500"
                />
                <span className="font-bold text-gray-200">SPRT Test (Fishtest Bounds)</span>
              </label>
              <label className="flex items-center space-x-1.5 cursor-pointer">
                <input
                  type="radio"
                  name="testType"
                  checked={testType === 'fixed_games'}
                  onChange={() => setTestType('fixed_games')}
                  className="accent-yellow-500"
                />
                <span className="text-gray-400">Fixed Games Count</span>
              </label>
            </div>

            {testType === 'sprt' ? (
              <div className="grid grid-cols-2 gap-3 pt-1 border-t border-[#262420]">
                <div>
                  <label className="text-[10px] text-gray-500 block mb-0.5">
                    H0 Elo Bound (Null: no gain)
                  </label>
                  <input
                    type="number"
                    step={0.5}
                    value={elo0}
                    onChange={(e) => setElo0(parseFloat(e.target.value) || 0)}
                    className="w-full bg-[#24211d] text-white font-mono rounded px-2 py-1 border border-[#38342e]"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-gray-500 block mb-0.5">
                    H1 Elo Bound (Target gain)
                  </label>
                  <input
                    type="number"
                    step={0.5}
                    value={elo1}
                    onChange={(e) => setElo1(parseFloat(e.target.value) || 5)}
                    className="w-full bg-[#24211d] text-white font-mono rounded px-2 py-1 border border-[#38342e]"
                  />
                </div>
              </div>
            ) : (
              <div className="pt-1 border-t border-[#262420]">
                <label className="text-[10px] text-gray-500 block mb-0.5">Game Count Limit</label>
                <input
                  type="number"
                  min={10}
                  max={1000}
                  step={10}
                  value={maxGames}
                  onChange={(e) => setMaxGames(parseInt(e.target.value, 10) || 100)}
                  className="w-full bg-[#24211d] text-white font-mono rounded px-2 py-1 border border-[#38342e]"
                />
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end space-x-2 pt-2 border-t border-[#312e29]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded bg-[#2b2824] hover:bg-[#38342e] text-gray-300 font-semibold transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex items-center space-x-1.5 px-4 py-2 rounded bg-yellow-600 hover:bg-yellow-500 text-black font-bold transition shadow"
            >
              <Play size={14} />
              <span>Start Experiment</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
