import React from 'react';
import { Play, Pause, StepForward, RotateCcw } from 'lucide-react';

interface EngineOption {
  id: string;
  name: string;
  available: boolean;
  type: string;
}

interface BotMatchControlsProps {
  availableEngines: EngineOption[];
  blackEngineId: string;
  whiteEngineId: string;
  blackDepth: number;
  whiteDepth: number;
  onSelectBlackEngine: (id: string) => void;
  onSelectWhiteEngine: (id: string) => void;
  onSelectBlackDepth: (depth: number) => void;
  onSelectWhiteDepth: (depth: number) => void;
  isRunning: boolean;
  onToggleRunning: () => void;
  onStepMove: () => void;
  onResetMatch: () => void;
  moveDelay: number;
  onMoveDelayChange: (delay: number) => void;
}

export const BotMatchControls: React.FC<BotMatchControlsProps> = ({
  availableEngines,
  blackEngineId,
  whiteEngineId,
  blackDepth,
  whiteDepth,
  onSelectBlackEngine,
  onSelectWhiteEngine,
  onSelectBlackDepth,
  onSelectWhiteDepth,
  isRunning,
  onToggleRunning,
  onStepMove,
  onResetMatch,
  moveDelay,
  onMoveDelayChange,
}) => {
  return (
    <div className="w-full bg-[#1e1c18] border border-[#312e29] rounded-lg p-3 shadow-md flex flex-col md:flex-row items-center justify-between gap-3 text-xs select-none">
      {/* Bot Selectors */}
      <div className="flex items-center space-x-4">
        {/* Black Bot */}
        <div className="flex items-center space-x-2 bg-[#161512] px-3 py-1.5 rounded border border-[#2d2a25]">
          <div className="w-3.5 h-3.5 rounded-full bg-black border border-gray-600 shadow-sm" />
          <span className="font-bold text-gray-300">Black:</span>
          <select
            value={blackEngineId}
            onChange={(e) => onSelectBlackEngine(e.target.value)}
            className="bg-[#24211d] text-yellow-400 font-semibold rounded px-2 py-1 border border-[#3c3934] focus:outline-none"
          >
            {availableEngines.map((e) => (
              <option key={e.id} value={e.id} disabled={!e.available}>
                {e.name} {!e.available ? '(unavailable)' : ''}
              </option>
            ))}
          </select>
          <div className="flex items-center space-x-1 pl-1">
            <span className="text-gray-500 text-[10px]">d=</span>
            <input
              type="number"
              min={2}
              max={24}
              value={blackDepth}
              onChange={(e) => onSelectBlackDepth(parseInt(e.target.value, 10) || 10)}
              className="w-10 bg-[#24211d] text-white font-mono text-center rounded py-0.5 border border-[#3c3934]"
            />
          </div>
        </div>

        <span className="text-gray-500 font-bold uppercase text-[11px]">vs</span>

        {/* White Bot */}
        <div className="flex items-center space-x-2 bg-[#161512] px-3 py-1.5 rounded border border-[#2d2a25]">
          <div className="w-3.5 h-3.5 rounded-full bg-white border border-gray-300 shadow-sm" />
          <span className="font-bold text-gray-300">White:</span>
          <select
            value={whiteEngineId}
            onChange={(e) => onSelectWhiteEngine(e.target.value)}
            className="bg-[#24211d] text-yellow-400 font-semibold rounded px-2 py-1 border border-[#3c3934] focus:outline-none"
          >
            {availableEngines.map((e) => (
              <option key={e.id} value={e.id} disabled={!e.available}>
                {e.name} {!e.available ? '(unavailable)' : ''}
              </option>
            ))}
          </select>
          <div className="flex items-center space-x-1 pl-1">
            <span className="text-gray-500 text-[10px]">d=</span>
            <input
              type="number"
              min={2}
              max={24}
              value={whiteDepth}
              onChange={(e) => onSelectWhiteDepth(parseInt(e.target.value, 10) || 10)}
              className="w-10 bg-[#24211d] text-white font-mono text-center rounded py-0.5 border border-[#3c3934]"
            />
          </div>
        </div>
      </div>

      {/* Speed & Controls */}
      <div className="flex items-center space-x-3">
        {/* Delay Slider */}
        <div className="flex items-center space-x-2">
          <span className="text-gray-400 text-[11px]">Delay:</span>
          <input
            type="range"
            min={50}
            max={2000}
            step={50}
            value={moveDelay}
            onChange={(e) => onMoveDelayChange(parseInt(e.target.value, 10))}
            className="w-20 accent-yellow-500 cursor-pointer"
          />
          <span className="font-mono text-gray-300 text-[10px] w-12 text-right">
            {moveDelay}ms
          </span>
        </div>

        {/* Play / Pause */}
        <button
          onClick={onToggleRunning}
          className={`flex items-center space-x-1.5 px-3 py-1.5 rounded font-bold transition shadow ${
            isRunning
              ? 'bg-yellow-600 hover:bg-yellow-500 text-black'
              : 'bg-green-700 hover:bg-green-600 text-white'
          }`}
        >
          {isRunning ? <Pause size={13} /> : <Play size={13} />}
          <span>{isRunning ? 'Pause' : 'Start'}</span>
        </button>

        {/* Step */}
        <button
          onClick={onStepMove}
          disabled={isRunning}
          title="Make 1 move"
          className="p-1.5 bg-[#2b2824] hover:bg-[#3c3934] disabled:opacity-40 rounded text-gray-300 transition"
        >
          <StepForward size={14} />
        </button>

        {/* Reset */}
        <button
          onClick={onResetMatch}
          title="Restart match"
          className="p-1.5 bg-[#2b2824] hover:bg-[#3c3934] rounded text-gray-300 transition"
        >
          <RotateCcw size={14} />
        </button>
      </div>
    </div>
  );
};
