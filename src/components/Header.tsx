import React from 'react';
import { GameMode, Player } from '../lib/types';
import { Sword, Compass, Users, Bot, CircleDot } from 'lucide-react';

interface HeaderProps {
  mode: GameMode;
  onModeChange: (mode: GameMode) => void;
  userColor: Player;
  onUserColorChange: (color: Player) => void;
  isGameOver: boolean;
  winner: Player | 0 | null;
  blackCount: number;
  whiteCount: number;
}

export const Header: React.FC<HeaderProps> = ({
  mode,
  onModeChange,
  userColor,
  onUserColorChange,
  isGameOver,
  winner,
  blackCount,
  whiteCount,
}) => {
  return (
    <header className="w-full bg-[#1e1c18] border-b border-[#312e29] px-6 py-2.5 flex items-center justify-between shadow-md select-none">
      {/* Brand */}
      <div className="flex items-center space-x-3">
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-green-700 to-green-950 flex items-center justify-center border border-green-600/50 shadow">
          <CircleDot size={20} className="text-yellow-400" />
        </div>
        <div>
          <div className="flex items-center space-x-2">
            <span className="font-bold text-lg text-gray-100 tracking-tight">Rothello</span>
            <span className="bg-green-900/60 text-green-400 text-[10px] font-mono font-bold px-1.5 py-0.2 rounded border border-green-700/50">
              NBoard Protocol
            </span>
          </div>
          <p className="text-[11px] text-gray-400 leading-none">Grandmaster Othello & Analysis</p>
        </div>
      </div>

      {/* Mode Selector */}
      <div className="flex items-center bg-[#161512] p-1 rounded-md border border-[#312e29] space-x-1">
        <button
          onClick={() => onModeChange('human_vs_engine')}
          className={`flex items-center space-x-1.5 px-3 py-1 rounded text-xs font-semibold transition ${
            mode === 'human_vs_engine'
              ? 'bg-[#3c3934] text-white shadow'
              : 'text-gray-400 hover:text-gray-200'
          }`}
        >
          <Sword size={14} />
          <span>vs Engine</span>
        </button>
        <button
          onClick={() => onModeChange('analysis')}
          className={`flex items-center space-x-1.5 px-3 py-1 rounded text-xs font-semibold transition ${
            mode === 'analysis'
              ? 'bg-[#3c3934] text-white shadow'
              : 'text-gray-400 hover:text-gray-200'
          }`}
        >
          <Compass size={14} />
          <span>Analysis</span>
        </button>
        <button
          onClick={() => onModeChange('engine_vs_engine')}
          className={`flex items-center space-x-1.5 px-3 py-1 rounded text-xs font-semibold transition ${
            mode === 'engine_vs_engine'
              ? 'bg-[#3c3934] text-white shadow'
              : 'text-gray-400 hover:text-gray-200'
          }`}
        >
          <Bot size={14} />
          <span>Bot Match</span>
        </button>
        <button
          onClick={() => onModeChange('pass_and_play')}
          className={`flex items-center space-x-1.5 px-3 py-1 rounded text-xs font-semibold transition ${
            mode === 'pass_and_play'
              ? 'bg-[#3c3934] text-white shadow'
              : 'text-gray-400 hover:text-gray-200'
          }`}
        >
          <Users size={14} />
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
    </header>
  );
};
