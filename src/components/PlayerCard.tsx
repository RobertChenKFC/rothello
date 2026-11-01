import React from 'react';
import { Player } from '../lib/types';
import { Disc } from './Disc';

interface PlayerCardProps {
  player: Player;
  name: string;
  count: number;
  isTurn: boolean;
  isEngine?: boolean;
}

export const PlayerCard: React.FC<PlayerCardProps> = ({
  player,
  name,
  count,
  isTurn,
  isEngine = false,
}) => {
  const isBlack = player === 1;

  return (
    <div
      className={`flex items-center justify-between px-3 py-2 rounded-md transition-all duration-200 border ${
        isTurn
          ? 'bg-[#2b2824] border-[#4a4640] shadow-md'
          : 'bg-[#211f1c] border-[#312e29] opacity-80'
      }`}
    >
      <div className="flex items-center space-x-3">
        {/* Disc Icon */}
        <div className="w-6 h-6 flex items-center justify-center">
          <Disc color={player} />
        </div>

        {/* Player Name & Tag */}
        <div className="flex flex-col">
          <div className="flex items-center space-x-2">
            <span className="font-semibold text-sm text-gray-200">{name}</span>
            {isEngine && (
              <span className="bg-[#3c3934] text-[10px] text-yellow-500 font-bold px-1.5 py-0.5 rounded uppercase">
                BOT
              </span>
            )}
            <span className="text-xs text-gray-400">
              ({isBlack ? 'Black' : 'White'})
            </span>
          </div>
          {isTurn && (
            <span className="text-[11px] text-green-400 font-medium animate-pulse">
              To move
            </span>
          )}
        </div>
      </div>

      {/* Disc Count Badge */}
      <div
        className={`px-3 py-1 rounded font-mono font-bold text-base ${
          isBlack ? 'bg-black text-white border border-[#333]' : 'bg-white text-black border border-[#ddd]'
        }`}
      >
        {count}
      </div>
    </div>
  );
};
