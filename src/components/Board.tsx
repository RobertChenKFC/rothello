import React, { useState } from 'react';
import { Disc } from './Disc';
import { GameState, EngineHint } from '../lib/types';
import { coordToIndex } from '../lib/othello';

interface BoardProps {
  gameState: GameState;
  onSquareClick: (row: number, col: number) => void;
  bestHint?: EngineHint;
  flipped?: boolean;
}

export const Board: React.FC<BoardProps> = ({
  gameState,
  onSquareClick,
  bestHint,
  flipped = false,
}) => {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
  const ranks = ['1', '2', '3', '4', '5', '6', '7', '8'];

  // In Othello standard notation, rank 1 is at the top, rank 8 is at the bottom
  const displayFiles = flipped ? [...files].reverse() : files;
  const displayRanks = flipped ? [...ranks].reverse() : ranks;

  // Find index of best hint move if any
  let bestHintIdx: number | null = null;
  if (bestHint && bestHint.move) {
    const alg = bestHint.move.toLowerCase();
    if (alg.length >= 2) {
      const c = alg.charCodeAt(0) - 97;
      const r = parseInt(alg[1], 10) - 1;
      if (r >= 0 && r < 8 && c >= 0 && c < 8) {
        bestHintIdx = coordToIndex(r, c);
      }
    }
  }

  const lastMoveIdx =
    gameState.lastMove && gameState.lastMove.row >= 0
      ? coordToIndex(gameState.lastMove.row, gameState.lastMove.col)
      : null;

  const hoveredFlips = new Set(
    hoveredIndex !== null && gameState.legalMoves[hoveredIndex]
      ? gameState.legalMoves[hoveredIndex]
      : []
  );

  return (
    <div className="relative p-3 bg-[#133020] rounded-lg shadow-2xl border-4 border-[#1b432d] select-none">
      {/* Board Grid */}
      <div
        className="w-[540px] h-[540px] grid grid-cols-8 grid-rows-8 bg-[#1e5838] border-2 border-[#0f271a] shadow-inner relative"
        onMouseLeave={() => setHoveredIndex(null)}
      >
        {/* 4 Tournament Grid Intersection Dots framing the 4x4 center area */}
        <div className="absolute top-[25%] left-[25%] -translate-x-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-[#0a1e13] border border-[#2a6645] pointer-events-none z-10 shadow-sm" />
        <div className="absolute top-[25%] left-[75%] -translate-x-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-[#0a1e13] border border-[#2a6645] pointer-events-none z-10 shadow-sm" />
        <div className="absolute top-[75%] left-[25%] -translate-x-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-[#0a1e13] border border-[#2a6645] pointer-events-none z-10 shadow-sm" />
        <div className="absolute top-[75%] left-[75%] -translate-x-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-[#0a1e13] border border-[#2a6645] pointer-events-none z-10 shadow-sm" />

        {Array.from({ length: 64 }).map((_, displayIdx) => {
          const displayRow = Math.floor(displayIdx / 8);
          const displayCol = displayIdx % 8;

          const r = flipped ? 7 - displayRow : displayRow;
          const c = flipped ? 7 - displayCol : displayCol;
          const idx = coordToIndex(r, c);

          const disc = gameState.board[idx];
          const isLegal = !!gameState.legalMoves[idx];
          const isLastMove = lastMoveIdx === idx;
          const isBestHint = bestHintIdx === idx;
          const isHovered = hoveredIndex === idx;
          const isFlippingPreview = hoveredFlips.has(idx);

          return (
            <div
              key={idx}
              onClick={() => isLegal && onSquareClick(r, c)}
              onMouseEnter={() => isLegal && setHoveredIndex(idx)}
              className={`relative flex items-center justify-center border border-[#16452c] transition-colors cursor-pointer ${
                isLegal ? 'hover:bg-[#256e46]' : 'cursor-default'
              }`}
            >
              {/* Coordinate label: Top-left of rank 1 or file a */}
              {displayCol === 0 && (
                <span className="absolute top-0.5 left-1 text-[9px] font-semibold text-[#8eb59c] pointer-events-none">
                  {displayRanks[displayRow]}
                </span>
              )}
              {displayRow === 7 && (
                <span className="absolute bottom-0.5 right-1 text-[9px] font-semibold text-[#8eb59c] pointer-events-none">
                  {displayFiles[displayCol]}
                </span>
              )}

              {/* Disc */}
              {disc !== 0 && (
                <div
                  className={`w-full h-full flex items-center justify-center transition-transform ${
                    isFlippingPreview ? 'opacity-70 scale-90' : ''
                  }`}
                >
                  <Disc color={disc} />
                </div>
              )}

              {/* Legal move marker dot */}
              {disc === 0 && isLegal && !isHovered && (
                <div
                  className={`rounded-full transition-all duration-200 ${
                    isBestHint
                      ? 'w-4 h-4 bg-yellow-400/90 shadow-[0_0_8px_rgba(250,204,21,0.9)] ring-2 ring-yellow-300/40'
                      : 'w-3 h-3 bg-white/30 hover:bg-white/50'
                  }`}
                />
              )}

              {/* Hover preview disc */}
              {disc === 0 && isLegal && isHovered && (
                <div className="w-full h-full flex items-center justify-center">
                  <Disc color={gameState.currentPlayer} preview />
                  <span className="absolute text-[11px] font-bold text-white font-mono bg-black/60 px-1 rounded pointer-events-none">
                    +{gameState.legalMoves[idx].length}
                  </span>
                </div>
              )}

              {/* Best move badge */}
              {isBestHint && disc === 0 && (
                <div className="absolute top-1 right-1 bg-yellow-500 text-black text-[9px] font-bold px-1 rounded-sm leading-tight shadow pointer-events-none">
                  {bestHint?.score !== undefined ? `${bestHint.score > 0 ? '+' : ''}${bestHint.score}` : 'BEST'}
                </div>
              )}

              {/* Last move indicator ring */}
              {isLastMove && (
                <div className="absolute inset-1 rounded-full border-2 border-yellow-400/70 pointer-events-none animate-pulse" />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
