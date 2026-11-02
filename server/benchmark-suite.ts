/**
 * Benchmark Position Suite for rapid diagnostic evaluation.
 * Evaluates move agreement, NPS, and Effective Branching Factor (EBF).
 */

export interface BenchmarkPosition {
  id: string;
  name: string;
  ggf: string;
}

export const BENCHMARK_POSITIONS: BenchmarkPosition[] = [
  {
    id: 'pos-1',
    name: 'Opening Tiger',
    ggf: '(;GM[othello]B[f5]W[d6]B[c5]W[f4];)',
  },
  {
    id: 'pos-2',
    name: 'Opening Rose',
    ggf: '(;GM[othello]B[f5]W[f6]B[e6]W[f4];)',
  },
  {
    id: 'pos-3',
    name: 'Early Midgame Complex',
    ggf: '(;GM[othello]B[f5]W[d6]B[c3]W[d3]B[c4]W[f4]B[c5]W[b4]B[c6]W[b3];)',
  },
  {
    id: 'pos-4',
    name: 'X-Square Trap',
    ggf: '(;GM[othello]B[f5]W[d6]B[c5]W[f4]B[e3]W[c6]B[d3]W[b4]B[b5]W[a4];)',
  },
  {
    id: 'pos-5',
    name: 'Edge Battle West',
    ggf: '(;GM[othello]B[c4]W[c3]B[d3]W[c5]B[b3]W[c2]B[b4]W[a3]B[a4]W[b5];)',
  },
  {
    id: 'pos-6',
    name: 'Midgame Center Control',
    ggf: '(;GM[othello]B[f5]W[f6]B[e6]W[f4]B[d3]W[c5]B[e3]W[d6]B[c6]W[c4];)',
  },
  {
    id: 'pos-7',
    name: 'Corner Approach North',
    ggf: '(;GM[othello]B[d3]W[c5]B[f6]W[f5]B[b6]W[c3]B[e3]W[e2]B[f2]W[g7]B[e1];)',
  },
  {
    id: 'pos-8',
    name: 'Deep Midgame Tactical',
    ggf: '(;GM[othello]B[f5]W[d6]B[c5]W[f4]B[e3]W[c6]B[d3]W[f6]B[e6]W[f7]B[g6]W[g5]B[h6];)',
  },
  {
    id: 'pos-9',
    name: 'Mobility Squeeze',
    ggf: '(;GM[othello]B[c4]W[e3]B[f4]W[c5]B[d6]W[f5]B[e6]W[f6]B[c6]W[b5]B[d3]W[e7];)',
  },
  {
    id: 'pos-10',
    name: 'Late Midgame Edge Lock',
    ggf: '(;GM[othello]B[d3]W[c5]B[f6]W[f5]B[b6]W[c3]B[e3]W[e2]B[f2]W[g7]B[e1]W[c4]B[b3]W[c6]B[c7]W[g1]B[g5]W[d6];)',
  },
];

export interface BenchmarkReport {
  timestamp: string;
  engineId: string;
  engineName: string;
  searchDepth: number;
  totalNodes: number;
  totalTimeSec: number;
  nps: number;
  ebf: number;
  moveAgreement?: number;
  positions: {
    id: string;
    name: string;
    bestMove: string;
    score: number;
    nodes: number;
    timeSec: number;
  }[];
}
