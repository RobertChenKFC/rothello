import React, { useState } from 'react';
import { EngineStatus } from '../lib/types';
import { Cpu, Play, Terminal, Zap, Sliders, ChevronDown } from 'lucide-react';

interface EnginePanelProps {
  engineStatus: EngineStatus;
  availableEngines: { id: string; name: string; available: boolean; type: string }[];
  currentEngineId: string;
  onSwitchEngine: (id: string) => void;
  onRequestHint: () => void;
  onRequestEngineMove: () => void;
  onSetDepth: (depth: number) => void;
  currentDepth: number;
  rawLogs: string[];
  isBotMatch?: boolean;
  activeBotName?: string;
}

export const EnginePanel: React.FC<EnginePanelProps> = ({
  engineStatus,
  availableEngines,
  currentEngineId,
  onSwitchEngine,
  onRequestHint,
  onRequestEngineMove,
  onSetDepth,
  currentDepth,
  rawLogs,
  isBotMatch = false,
  activeBotName,
}) => {
  const [showConsole, setShowConsole] = useState(false);
  const [showEngineDropdown, setShowEngineDropdown] = useState(false);

  const getStatusBadge = () => {
    switch (engineStatus.state) {
      case 'thinking':
        return <span className="bg-yellow-900/60 text-yellow-300 text-xs px-2 py-0.5 rounded font-mono animate-pulse">Thinking</span>;
      case 'waiting':
      case 'idle':
        return <span className="bg-green-900/60 text-green-300 text-xs px-2 py-0.5 rounded font-mono">Ready</span>;
      case 'error':
        return <span className="bg-red-900/60 text-red-300 text-xs px-2 py-0.5 rounded font-mono">Error</span>;
      default:
        return <span className="bg-gray-800 text-gray-300 text-xs px-2 py-0.5 rounded font-mono">{engineStatus.state}</span>;
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#211f1c] border border-[#312e29] rounded-lg overflow-hidden shadow-md">
      {/* Header */}
      <div className="px-3 py-2 bg-[#2b2824] border-b border-[#312e29] flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Cpu size={16} className="text-yellow-500" />
          {isBotMatch ? (
            <div className="flex items-center space-x-1 font-semibold text-xs text-yellow-400">
              <span>{activeBotName || engineStatus.name}</span>
            </div>
          ) : (
            /* Engine Selector Dropdown */
            <div className="relative">
              <button
                onClick={() => setShowEngineDropdown(!showEngineDropdown)}
                className="flex items-center space-x-1 font-semibold text-xs text-gray-200 hover:text-white transition"
              >
                <span>{engineStatus.name || 'Select Engine'}</span>
                <ChevronDown size={12} />
              </button>
              {showEngineDropdown && (
                <div className="absolute top-full left-0 mt-1 w-56 bg-[#2b2824] border border-[#3c3934] rounded shadow-xl z-50 py-1">
                  {availableEngines.map((e) => (
                    <button
                      key={e.id}
                      onClick={() => {
                        onSwitchEngine(e.id);
                        setShowEngineDropdown(false);
                      }}
                      disabled={!e.available && e.type !== 'builtin'}
                      className={`w-full text-left px-3 py-1.5 text-xs flex items-center justify-between hover:bg-[#3c3934] transition ${
                        currentEngineId === e.id ? 'text-yellow-400 font-bold' : 'text-gray-300'
                      } ${!e.available && e.type !== 'builtin' ? 'opacity-40 cursor-not-allowed' : ''}`}
                    >
                      <span>{e.name}</span>
                      <span className="text-[10px] text-gray-400 uppercase font-mono">
                        {e.type}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
        <div className="flex items-center space-x-2">
          {getStatusBadge()}
          <button
            onClick={() => setShowConsole(!showConsole)}
            title="NBoard Protocol Console"
            className={`p-1 rounded transition ${
              showConsole ? 'bg-yellow-600/30 text-yellow-400' : 'hover:bg-[#3c3934] text-gray-400'
            }`}
          >
            <Terminal size={14} />
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {/* Telemetry Bar */}
        <div className="grid grid-cols-4 gap-2 bg-[#1b1916] p-2 rounded border border-[#2d2b27] text-center">
          <div>
            <div className="text-[10px] text-gray-500 uppercase">Depth</div>
            <div className="font-mono text-xs font-bold text-gray-200">
              {currentDepth}
            </div>
          </div>
          <div>
            <div className="text-[10px] text-gray-500 uppercase">Nodes</div>
            <div className="font-mono text-xs font-bold text-gray-200">
              {engineStatus.nodes ? engineStatus.nodes.toLocaleString() : '-'}
            </div>
          </div>
          <div>
            <div className="text-[10px] text-gray-500 uppercase">NPS</div>
            <div className="font-mono text-xs font-bold text-gray-200">
              {engineStatus.nps ? `${(engineStatus.nps / 1000).toFixed(1)}k` : '-'}
            </div>
          </div>
          <div>
            <div className="text-[10px] text-gray-500 uppercase">Time</div>
            <div className="font-mono text-xs font-bold text-gray-200">
              {engineStatus.timeSec ? `${engineStatus.timeSec.toFixed(2)}s` : '-'}
            </div>
          </div>
        </div>

        {/* Console Overlay (if active) */}
        {showConsole ? (
          <div className="bg-[#121110] border border-[#2d2b27] rounded p-2 h-44 overflow-y-auto font-mono text-[11px] text-green-400 space-y-0.5">
            <div className="text-gray-500 italic pb-1">
              --- NBoard Protocol Traffic (stdin / stdout) ---
            </div>
            {rawLogs.slice(-30).map((l, i) => (
              <div key={i} className="break-all whitespace-pre-wrap">
                {l}
              </div>
            ))}
          </div>
        ) : (
          /* MultiPV Candidate Moves */
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs text-gray-400 font-semibold px-1">
              <span>Candidate Moves</span>
              <span>Score / Depth</span>
            </div>

            {engineStatus.hints.length === 0 ? (
              <div className="text-center py-6 text-gray-500 text-xs italic">
                Request analysis or let engine think to view top variations.
              </div>
            ) : (
              engineStatus.hints.map((hint, idx) => {
                const formattedScore =
                  hint.score > 0 ? `+${hint.score.toFixed(1)}` : hint.score.toFixed(1);
                const isBest = idx === 0;

                return (
                  <div
                    key={idx}
                    className={`flex items-center justify-between px-2.5 py-1.5 rounded border transition ${
                      isBest
                        ? 'bg-[#2b271d] border-yellow-600/50 text-yellow-300'
                        : 'bg-[#1e1c18] border-[#2d2b27] text-gray-300 hover:bg-[#25231f]'
                    }`}
                  >
                    <div className="flex items-center space-x-2">
                      <span className="font-mono font-bold text-sm">{hint.move}</span>
                      {hint.isBook ? (
                        <span className="text-[9px] bg-blue-900/60 text-blue-300 px-1 py-0.2 rounded uppercase">
                          Book
                        </span>
                      ) : (
                        <span className="text-[10px] text-gray-500">d={hint.depth}</span>
                      )}
                      {hint.pv && hint.pv !== hint.move && (
                        <span className="text-[10px] text-gray-400 font-mono hidden sm:inline">
                          ({hint.pv})
                        </span>
                      )}
                    </div>
                    <div className="font-mono font-bold text-xs">{formattedScore}</div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* Depth Control (single-engine modes) or Bot Match Indicator */}
        {isBotMatch ? (
          <div className="pt-2 border-t border-[#312e29]">
            <div className="bg-[#161512] px-2.5 py-1.5 rounded border border-[#2d2a25] text-[11px] text-gray-400 flex items-center justify-between">
              <span className="flex items-center space-x-1.5">
                <Sliders size={12} className="text-yellow-500" />
                <span>Bot Match Active</span>
              </span>
              <span className="text-gray-500 text-[10px]">Depths set in match bar above</span>
            </div>
          </div>
        ) : (
          <div className="pt-2 border-t border-[#312e29] space-y-1">
            <div className="flex items-center justify-between text-xs text-gray-400">
              <span className="flex items-center space-x-1">
                <Sliders size={12} />
                <span>Search Depth</span>
              </span>
              <span className="font-mono font-bold text-gray-200">{currentDepth}</span>
            </div>
            <input
              type="range"
              min={2}
              max={24}
              step={2}
              value={currentDepth}
              onChange={(e) => onSetDepth(parseInt(e.target.value, 10))}
              className="w-full accent-yellow-500 bg-[#312e29] h-1.5 rounded cursor-pointer"
            />
          </div>
        )}
      </div>

      {/* Action Footer */}
      <div className="p-2 bg-[#2b2824] border-t border-[#312e29] flex items-center space-x-2">
        <button
          onClick={onRequestHint}
          className="flex-1 flex items-center justify-center space-x-1 bg-[#3c3934] hover:bg-[#4a4640] text-gray-200 text-xs font-semibold py-1.5 px-3 rounded transition"
        >
          <Zap size={14} className="text-yellow-400" />
          <span>Analyze</span>
        </button>
        <button
          onClick={onRequestEngineMove}
          className="flex-1 flex items-center justify-center space-x-1 bg-[#4a7c20] hover:bg-[#589226] text-white text-xs font-semibold py-1.5 px-3 rounded transition shadow"
        >
          <Play size={14} />
          <span>Engine Move</span>
        </button>
      </div>
    </div>
  );
};
