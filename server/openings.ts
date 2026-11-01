/**
 * Standard Othello Opening Suite for balanced self-play testing.
 * Provides classical 4-ply and 6-ply starting positions.
 */

export interface Opening {
  name: string;
  moves: string[]; // e.g. ["f5", "d6", "c3", "d3"]
}

export const STANDARD_OPENINGS: Opening[] = [
  // Rose / Chimney lines
  { name: 'Rose (Parallel)', moves: ['f5', 'f6', 'e6', 'f4'] },
  { name: 'Rose-Heath', moves: ['f5', 'f6', 'e6', 'd6'] },
  { name: 'Rose-Peacock', moves: ['f5', 'f6', 'd6', 'c5'] },
  { name: 'Rose-Cow', moves: ['f5', 'f6', 'e6', 'f7'] },
  
  // Diagonal lines
  { name: 'Tiger (Diagonal)', moves: ['f5', 'd6', 'c5', 'f4'] },
  { name: 'Tiger-Shaku', moves: ['f5', 'd6', 'c5', 'f6'] },
  { name: 'Tiger-Brighton', moves: ['f5', 'd6', 'c3', 'd3'] },
  { name: 'Tiger-Draw', moves: ['f5', 'd6', 'c3', 'c4'] },
  { name: 'Tiger-Soshi', moves: ['f5', 'd6', 'c4', 'd3'] },
  
  // Perpendicular lines
  { name: 'Cat (Perpendicular)', moves: ['f5', 'd6', 'c4', 'c5'] },
  { name: 'Cat-Bat', moves: ['f5', 'd6', 'c4', 'd3'] },
  { name: 'Cat-Sailor', moves: ['f5', 'd6', 'c4', 'b4'] },
  { name: 'Cat-Maru', moves: ['f5', 'd6', 'c4', 'f4'] },
  { name: 'Cat-Rose', moves: ['f5', 'd6', 'c4', 'e3'] },

  // Cow lines
  { name: 'Cow', moves: ['f5', 'd6', 'c5', 'f6'] },
  { name: 'Cow-Buffalo', moves: ['f5', 'd6', 'c5', 'd3'] },
  { name: 'Cow-Snake', moves: ['f5', 'd6', 'c5', 'b4'] },

  // Diverse 4-ply variants
  { name: 'Variant A-1', moves: ['c4', 'e3', 'f4', 'c5'] },
  { name: 'Variant A-2', moves: ['c4', 'e3', 'f5', 'e6'] },
  { name: 'Variant A-3', moves: ['c4', 'e3', 'f6', 'c5'] },
  { name: 'Variant B-1', moves: ['c4', 'c5', 'd6', 'e3'] },
  { name: 'Variant B-2', moves: ['c4', 'c5', 'e6', 'f4'] },
  { name: 'Variant B-3', moves: ['c4', 'c5', 'f6', 'e6'] },
  { name: 'Variant C-1', moves: ['d3', 'c3', 'c4', 'c5'] },
  { name: 'Variant C-2', moves: ['d3', 'c3', 'e3', 'f4'] },
  { name: 'Variant C-3', moves: ['d3', 'c5', 'f6', 'f5'] },
  { name: 'Variant D-1', moves: ['d3', 'e3', 'f4', 'g5'] },
  { name: 'Variant D-2', moves: ['d3', 'e3', 'f5', 'f6'] },
  { name: 'Variant D-3', moves: ['d3', 'e3', 'c4', 'b3'] },
  { name: 'Variant E-1', moves: ['e6', 'f6', 'f5', 'f4'] },
  { name: 'Variant E-2', moves: ['e6', 'f6', 'd6', 'c6'] },
  { name: 'Variant E-3', moves: ['e6', 'f4', 'c5', 'd6'] },
  { name: 'Variant F-1', moves: ['e6', 'd6', 'c5', 'c4'] },
  { name: 'Variant F-2', moves: ['e6', 'd6', 'f5', 'g5'] },
];

export function getOpening(index: number): Opening {
  return STANDARD_OPENINGS[index % STANDARD_OPENINGS.length];
}
