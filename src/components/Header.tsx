import React from 'react';
import { GameMode, Player } from '../lib/types';
import {
  Sword,
  Compass,
  Users,
  Bot,
  CircleDot,
  BarChart2,
  GitCommit,
  Zap,
} from 'lucide-react';

interface HeaderProps {
  activeTab: 'dashboard' | 'benchmarks' | 'arena';
  onTabChange: (tab: 'dashboard' | 'benchmarks' | 'arena') => void;
  mode: GameMode;
  onModeChange: (mode: GameMode) => void;
  userColor: Player;
  onUserColorChange: (color: Player) => void;
  isGameOver: boolean;
  winner: Player | 0 | null;
  blackCount: number;
  whiteCount: number;
  gitCommit?: string;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  onTabChange,
  mode,
  onModeChange,
  userColor,
  onUserColorChange,
  isGameOver,
  winner,
  blackCount,
  whiteCount,
  gitCommit,
}) => {
  return (
    <header className="w-full bg-[#1e1c18] border-b border-[#312e29] px-6 py-2.5 flex items-center justify-between shadow-md">
      {/* Brand & Primary Navigation Switcher */}
      <div className="flex items-center space-x-6">
        <div className="flex items-center space-x-3 cursor-pointer" onClick={() => onTabChange('dashboard')}>
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-yellow-500 to-yellow-800 flex items-center justify-center border border-yellow-400/50 shadow">
            <CircleDot size={18} className="text-black" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-bold text-lg text-gray-100 tracking-tight">Rothello</span>
              <span className="bg-yellow-950/70 text-yellow-400 text-[10px] font-mono font-bold px-1.5 py-0.2 rounded border border-yellow-700/50">
                Fishtest & Engine
              </span>
            </div>
            <p className="text-[11px] text-gray-400 leading-none">Self-Play SPRT & Testing Lab</p>
          </div>
        </div>

        {/* Primary Tab Switcher */}
        <div className="flex items-center bg-[#141311] p-1 rounded-lg border border-[#2d2a25] space-x-1">
          <button
            onClick={() => onTabChange('dashboard')}
            className={`flex items-center space-x-1.5 px-3 py-1 rounded-md text-xs font-bold transition ${
              activeTab === 'dashboard'
                ? 'bg-yellow-600 text-black shadow'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <BarChart2 size={14} />
            <span>Dashboard</span>
          </button>
          <button
            onClick={() => onTabChange('benchmarks')}
            className={`flex items-center space-x-1.5 px-3 py-1 rounded-md text-xs font-bold transition ${
              activeTab === 'benchmarks'
                ? 'bg-yellow-600 text-black shadow'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <Zap size={14} />
            <span>Engine Benchmarks</span>
          </button>
          <button
            onClick={() => onTabChange('arena')}
            className={`flex items-center space-x-1.5 px-3 py-1 rounded-md text-xs font-bold transition ${
              activeTab === 'arena'
                ? 'bg-yellow-600 text-black shadow'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <CircleDot size={14} />
            <span>Arena / Board</span>
          </button>
        </div>
      </div>

      {/* Center & Right Contextual Controls */}
      {activeTab === 'arena' ? (
        <div className="flex items-center space-x-4">
          {/* Mode Selector */}
          <div className="flex items-center bg-[#161512] p-1 rounded-md border border-[#312e29] space-x-1">
            <button
              onClick={() => onModeChange('human_vs_engine')}
              className={`flex items-center space-x-1.5 px-2.5 py-1 rounded text-xs font-semibold transition ${
                mode === 'human_vs_engine'
                  ? 'bg-[#3c3934] text-white shadow'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              <Sword size={13} />
              <span>vs Engine</span>
            </button>
            <button
              onClick={() => onModeChange('analysis')}
              className={`flex items-center space-x-1.5 px-2.5 py-1 rounded text-xs font-semibold transition ${
                mode === 'analysis'
                  ? 'bg-[#3c3934] text-white shadow'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              <Compass size={13} />
              <span>Analysis</span>
            </button>
            <button
              onClick={() => onModeChange('engine_vs_engine')}
              className={`flex items-center space-x-1.5 px-2.5 py-1 rounded text-xs font-semibold transition ${
                mode === 'engine_vs_engine'
                  ? 'bg-[#3c3934] text-white shadow'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              <Bot size={13} />
              <span>Bot Match</span>
            </button>
            <button
              onClick={() => onModeChange('pass_and_play')}
              className={`flex items-center space-x-1.5 px-2.5 py-1 rounded text-xs font-semibold transition ${
                mode === 'pass_and_play'
                  ? 'bg-[#3c3934] text-white shadow'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              <Users size={13} />
              <span>2 Players</span>
            </button>
          </div>

          {/* Game Status Banner */}
          <div className="flex items-center space-x-3">
            {isGameOver ? (
              <div className="bg-yellow-900/40 border border-yellow-700/60 px-3 py-1 rounded text-xs font-bold text-yellow-300 animate-pulse">
                {winner === 0
                  ? 'Draw Game (32 - 32)!'
                  : winner === 1
                  ? `Black Wins! (${blackCount} - ${whiteCount})`
                  : `White Wins! (${whiteCount} - ${blackCount})`}
              </div>
            ) : (
              mode === 'human_vs_engine' && (
                <div className="flex items-center space-x-1 text-xs text-gray-400 bg-[#161512] px-2 py-1 rounded border border-[#312e29]">
                  <span>Play as:</span>
                  <button
                    onClick={() => onUserColorChange(1)}
                    className={`px-1.5 py-0.5 rounded font-semibold ${
                      userColor === 1 ? 'bg-black text-white' : 'text-gray-400'
                    }`}
                  >
                    Black
                  </button>
                  <button
                    onClick={() => onUserColorChange(-1)}
                    className={`px-1.5 py-0.5 rounded font-semibold ${
                      userColor === -1 ? 'bg-white text-black' : 'text-gray-400'
                    }`}
                  >
                    White
                  </button>
                </div>
              )
            )}
          </div>
        </div>
      ) : (
        /* Dashboard Mode Right Header: Git info pill */
        <div className="flex items-center space-x-3">
          {gitCommit && (
            <div className="flex items-center space-x-1.5 bg-[#141311] px-2.5 py-1 rounded border border-[#2d2a25] text-xs font-mono text-gray-400">
              <GitCommit size={13} className="text-yellow-400" />
              <span>HEAD:</span>
              <span className="font-bold text-yellow-400">{gitCommit}</span>
            </div>
          )}
        </div>
      )}
    </header>
  );
};
