export type Disc = 1 | -1 | 0; // 1 = Black, -1 = White, 0 = Empty
export type Player = 1 | -1;

export interface Move {
  row: number; // 0..7
  col: number; // 0..7
  algebraic: string; // e.g. "c4"
  player: Player;
  flips: number[]; // indices of flipped discs
}

export interface EngineHint {
  move: string;
  score: number; // disc differential from current player perspective
  depth: number;
  nGames?: number;
  isBook?: boolean;
  pv?: string;
}

export interface EngineStatus {
  name: string;
  connected: boolean;
  state: 'idle' | 'thinking' | 'waiting' | 'analyzing' | 'learning' | 'error';
  statusText: string;
  nps?: number;
  nodes?: number;
  depth?: number;
  timeSec?: number;
  hints: EngineHint[];
  bestMove?: string;
  bestScore?: number;
}

export type GameMode = 'human_vs_engine' | 'engine_vs_engine' | 'analysis' | 'pass_and_play';

export interface GameState {
  board: Disc[]; // 64 entries
  currentPlayer: Player;
  moveHistory: Move[];
  currentMoveIndex: number; // for scrubbing history
  isGameOver: boolean;
  winner: Player | 0 | null; // 1: Black, -1: White, 0: Draw, null: in progress
  blackCount: number;
  whiteCount: number;
  legalMoves: { [index: number]: number[] }; // index -> flipped indices
  lastMove: Move | null;
  mode: GameMode;
  userColor: Player; // for human_vs_engine
  engineDepth: number;
}
