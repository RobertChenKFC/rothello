import React, { useEffect, useRef } from 'react';
import { GameState } from '../lib/types';
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  RotateCw,
  Copy,
  Check,
  RotateCcw,
} from 'lucide-react';
import { toGGF } from '../lib/othello';

interface MoveHistoryProps {
  gameState: GameState;
  onNavigate: (moveIndex: number) => void;
  onNewGame: () => void;
  onFlipBoard: () => void;
}

export const MoveHistory: React.FC<MoveHistoryProps> = ({
  gameState,
  onNavigate,
  onNewGame,
  onFlipBoard,
}) => {
  const [copied, setCopied] = React.useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Group moves into turns (Turn 1: Black, White)
  const turns: { turnNum: number; black?: string; white?: string; bIdx?: number; wIdx?: number }[] = [];
  for (let i = 0; i < gameState.moveHistory.length; i++) {
    const move = gameState.moveHistory[i];
    const turnIndex = Math.floor(i / 2);
    if (!turns[turnIndex]) {
      turns[turnIndex] = { turnNum: turnIndex + 1 };
    }
    if (i % 2 === 0) {
      turns[turnIndex].black = move.algebraic;
      turns[turnIndex].bIdx = i + 1;
    } else {
      turns[turnIndex].white = move.algebraic;
      turns[turnIndex].wIdx = i + 1;
    }
  }

  // Auto-scroll to current move
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [gameState.currentMoveIndex]);

  const handleCopyGGF = () => {
    const ggf = toGGF(gameState);
    navigator.clipboard.writeText(ggf);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-col h-full bg-[#211f1c] border border-[#312e29] rounded-lg overflow-hidden shadow-md">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-[#2b2824] border-b border-[#312e29]">
        <span className="font-semibold text-xs tracking-wider uppercase text-gray-300">
          Move History
        </span>
        <div className="flex items-center space-x-1">
          <button
            onClick={onFlipBoard}
            title="Flip Board"
            className="p-1 rounded hover:bg-[#3c3934] text-gray-300 transition"
          >
            <RotateCw size={14} />
          </button>
          <button
            onClick={handleCopyGGF}
            title="Copy GGF String"
            className="p-1 rounded hover:bg-[#3c3934] text-gray-300 transition"
          >
            {copied ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
          </button>
          <button
            onClick={onNewGame}
            title="New Game"
            className="p-1 rounded hover:bg-[#3c3934] text-gray-300 transition"
          >
            <RotateCcw size={14} />
          </button>
        </div>
      </div>

      {/* Move List */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-2 font-mono text-xs">
        {turns.length === 0 ? (
          <div className="text-gray-500 text-center py-8 italic font-sans">
            Standard starting position. Black plays first.
          </div>
        ) : (
          <table className="w-full border-collapse">
            <tbody>
              {turns.map((t) => (
                <tr key={t.turnNum} className="hover:bg-[#282622] transition-colors">
                  <td className="w-10 py-1 text-gray-500 font-sans text-right pr-2">
                    {t.turnNum}.
                  </td>
                  <td className="py-1 w-[45%]">
                    {t.black && (
                      <button
                        onClick={() => t.bIdx !== undefined && onNavigate(t.bIdx)}
                        className={`w-full text-left px-2 py-0.5 rounded transition ${
                          gameState.currentMoveIndex === t.bIdx
                            ? 'bg-[#3b3834] text-yellow-400 font-bold'
                            : 'text-gray-200 hover:bg-[#312e29]'
                        }`}
                      >
                        {t.black}
                      </button>
                    )}
                  </td>
                  <td className="py-1 w-[45%]">
                    {t.white && (
                      <button
                        onClick={() => t.wIdx !== undefined && onNavigate(t.wIdx)}
                        className={`w-full text-left px-2 py-0.5 rounded transition ${
                          gameState.currentMoveIndex === t.wIdx
                            ? 'bg-[#3b3834] text-yellow-400 font-bold'
                            : 'text-gray-200 hover:bg-[#312e29]'
                        }`}
                      >
                        {t.white}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Navigation Controls */}
      <div className="flex items-center justify-center space-x-2 py-2 bg-[#2b2824] border-t border-[#312e29]">
        <button
          onClick={() => onNavigate(0)}
          disabled={gameState.currentMoveIndex === 0}
          className="p-1.5 rounded hover:bg-[#3c3934] disabled:opacity-30 disabled:hover:bg-transparent text-gray-300"
        >
          <ChevronsLeft size={16} />
        </button>
        <button
          onClick={() => onNavigate(Math.max(0, gameState.currentMoveIndex - 1))}
          disabled={gameState.currentMoveIndex === 0}
          className="p-1.5 rounded hover:bg-[#3c3934] disabled:opacity-30 disabled:hover:bg-transparent text-gray-300"
        >
          <ChevronLeft size={16} />
        </button>
        <span className="text-xs font-mono text-gray-400 px-2">
          {gameState.currentMoveIndex} / {gameState.moveHistory.length}
        </span>
        <button
          onClick={() =>
            onNavigate(
              Math.min(gameState.moveHistory.length, gameState.currentMoveIndex + 1)
            )
          }
          disabled={gameState.currentMoveIndex >= gameState.moveHistory.length}
          className="p-1.5 rounded hover:bg-[#3c3934] disabled:opacity-30 disabled:hover:bg-transparent text-gray-300"
        >
          <ChevronRight size={16} />
        </button>
        <button
          onClick={() => onNavigate(gameState.moveHistory.length)}
          disabled={gameState.currentMoveIndex >= gameState.moveHistory.length}
          className="p-1.5 rounded hover:bg-[#3c3934] disabled:opacity-30 disabled:hover:bg-transparent text-gray-300"
        >
          <ChevronsRight size={16} />
        </button>
      </div>
    </div>
  );
};
