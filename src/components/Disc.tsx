import React from 'react';
import { Disc as DiscType } from '../lib/types';

interface DiscProps {
  color: DiscType;
  preview?: boolean;
}

export const Disc: React.FC<DiscProps> = ({ color, preview = false }) => {
  if (color === 0) return null;

  const isBlack = color === 1;

  return (
    <div
      className={`w-4/5 h-4/5 rounded-full relative transition-all duration-300 transform select-none ${
        preview ? 'opacity-40 scale-95' : 'scale-100'
      }`}
      style={{
        background: isBlack
          ? 'radial-gradient(circle at 35% 35%, #3a3a3a, #111111 70%, #000000 100%)'
          : 'radial-gradient(circle at 35% 35%, #ffffff, #f0f0f0 60%, #d8d8d8 100%)',
        boxShadow: isBlack
          ? 'inset 0 1px 2px rgba(255,255,255,0.35), inset 0 -3px 5px rgba(0,0,0,0.9), 0 3px 6px rgba(0,0,0,0.6)'
          : 'inset 0 1px 2px rgba(255,255,255,1), inset 0 -3px 5px rgba(0,0,0,0.25), 0 3px 6px rgba(0,0,0,0.45)',
        border: isBlack ? '1px solid #1a1a1a' : '1px solid #cccccc',
      }}
    >
      {/* Subtle radial sheen */}
      <div
        className="absolute inset-0 rounded-full pointer-events-none"
        style={{
          background: isBlack
            ? 'radial-gradient(circle at 30% 30%, rgba(255,255,255,0.18) 0%, transparent 60%)'
            : 'radial-gradient(circle at 30% 30%, rgba(255,255,255,0.8) 0%, transparent 50%)',
        }}
      />
    </div>
  );
};
