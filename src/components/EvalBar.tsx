import React from 'react';

interface EvalBarProps {
  score: number | null; // from Black's perspective (-64 to +64)
  flipped?: boolean; // if White is on bottom
}

export const EvalBar: React.FC<EvalBarProps> = ({ score, flipped = false }) => {
  // Sigmoid conversion to percentage (0% = White winning, 100% = Black winning)
  // At score = 0, 50%. At score = +10, ~80%. At score = +20, ~95%.
  const rawScore = score ?? 0;
  
  // Convert -64..+64 disc eval into 0..100%
  // Using logistic function: 1 / (1 + exp(-score * 0.15))
  const blackWinProb = 1 / (1 + Math.exp(-rawScore * 0.18));
  let blackPercent = Math.round(blackWinProb * 100);
  blackPercent = Math.max(5, Math.min(95, blackPercent));

  const displayPercent = flipped ? 100 - blackPercent : blackPercent;
  const isBlackLeading = rawScore > 0;
  const formattedScore = rawScore === 0 ? '0.0' : `${rawScore > 0 ? '+' : ''}${rawScore.toFixed(1)}`;

  return (
    <div className="w-7 h-[540px] bg-[#1a1917] rounded-sm border border-[#3c3934] flex flex-col justify-between overflow-hidden shadow-md relative select-none">
      {/* Top half (White by default, or Black if flipped) */}
      <div
        className="w-full bg-[#f0f0f0] transition-all duration-500 ease-out flex items-start justify-center pt-1"
        style={{ height: `${100 - displayPercent}%` }}
      >
        {!flipped && !isBlackLeading && rawScore !== 0 && (
          <span className="text-[10px] font-bold text-[#222222] font-mono leading-none">
            {formattedScore}
          </span>
        )}
      </div>

      {/* Bottom half (Black by default, or White if flipped) */}
      <div
        className="w-full bg-[#111111] transition-all duration-500 ease-out flex items-end justify-center pb-1"
        style={{ height: `${displayPercent}%` }}
      >
        {!flipped && isBlackLeading && (
          <span className="text-[10px] font-bold text-[#ffffff] font-mono leading-none">
            {formattedScore}
          </span>
        )}
      </div>

      {/* Midpoint line */}
      <div className="absolute top-1/2 left-0 right-0 h-[1px] bg-red-500/40 pointer-events-none" />
    </div>
  );
};
