import { Disc, Player, Move, GameState } from './types';

export const BOARD_SIZE = 8;
export const TOTAL_SQUARES = 64;

// Directions [dRow, dCol]
const DIRECTIONS: [number, number][] = [
  [-1, -1], [-1, 0], [-1, 1],
  [0, -1],           [0, 1],
  [1, -1],  [1, 0],  [1, 1],
];

export function coordToAlgebraic(row: number, col: number): string {
  if (row < 0 || row >= BOARD_SIZE || col < 0 || col >= BOARD_SIZE) return '--';
  const file = String.fromCharCode('a'.charCodeAt(0) + col);
  const rank = (row + 1).toString();
  return `${file}${rank}`;
}

export function algebraicToCoord(alg: string): { row: number; col: number } | null {
  if (!alg || alg.length < 2) return null;
  const lower = alg.toLowerCase();
  if (lower === 'pass' || lower === '--') return { row: -1, col: -1 };
  const col = lower.charCodeAt(0) - 'a'.charCodeAt(0);
  const row = parseInt(lower[1], 10) - 1;
  if (row >= 0 && row < BOARD_SIZE && col >= 0 && col < BOARD_SIZE) {
    return { row, col };
  }
  return null;
}

export function indexToCoord(idx: number): { row: number; col: number } {
  return {
    row: Math.floor(idx / BOARD_SIZE),
    col: idx % BOARD_SIZE,
  };
}

export function coordToIndex(row: number, col: number): number {
  return row * BOARD_SIZE + col;
}

export function createInitialBoard(): Disc[] {
  const board: Disc[] = new Array(TOTAL_SQUARES).fill(0);
  // Standard Othello starting setup:
  // d4 (3,3): White, e4 (3,4): Black
  // d5 (4,3): Black, e5 (4,4): White
  board[coordToIndex(3, 3)] = -1; // White
  board[coordToIndex(3, 4)] = 1;  // Black
  board[coordToIndex(4, 3)] = 1;  // Black
  board[coordToIndex(4, 4)] = -1; // White
  return board;
}

export function getFlipsForMove(board: Disc[], row: number, col: number, player: Player): number[] {
  const idx = coordToIndex(row, col);
  if (board[idx] !== 0) return [];

  const opponent = -player as Player;
  const flips: number[] = [];

  for (const [dr, dc] of DIRECTIONS) {
    let r = row + dr;
    let c = col + dc;
    const directionFlips: number[] = [];

    while (r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE) {
      const currentDisc = board[coordToIndex(r, c)];
      if (currentDisc === opponent) {
        directionFlips.push(coordToIndex(r, c));
      } else if (currentDisc === player) {
        // Enclosed opponent pieces
        if (directionFlips.length > 0) {
          flips.push(...directionFlips);
        }
        break;
      } else {
        // Empty square, breaks continuity
        break;
      }
      r += dr;
      c += dc;
    }
  }

  return flips;
}

export function getLegalMoves(board: Disc[], player: Player): { [index: number]: number[] } {
  const legalMoves: { [index: number]: number[] } = {};

  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      const flips = getFlipsForMove(board, r, c, player);
      if (flips.length > 0) {
        legalMoves[coordToIndex(r, c)] = flips;
      }
    }
  }

  return legalMoves;
}

export function countDiscs(board: Disc[]): { black: number; white: number; empty: number } {
  let black = 0;
  let white = 0;
  let empty = 0;

  for (let i = 0; i < TOTAL_SQUARES; i++) {
    if (board[i] === 1) black++;
    else if (board[i] === -1) white++;
    else empty++;
  }

  return { black, white, empty };
}

export function createInitialGameState(): GameState {
  const board = createInitialBoard();
  const counts = countDiscs(board);
  const legalMoves = getLegalMoves(board, 1);

  return {
    board,
    currentPlayer: 1, // Black always moves first
    moveHistory: [],
    currentMoveIndex: 0,
    isGameOver: false,
    winner: null,
    blackCount: counts.black,
    whiteCount: counts.white,
    legalMoves,
    lastMove: null,
    mode: 'human_vs_engine',
    userColor: 1, // User is Black by default
    engineDepth: 12,
  };
}

export function makeMove(
  state: GameState,
  row: number,
  col: number
): GameState | null {
  const targetIdx = coordToIndex(row, col);
  const flips = state.legalMoves[targetIdx];
  if (!flips || flips.length === 0) return null;

  const newBoard = [...state.board];
  newBoard[targetIdx] = state.currentPlayer;
  for (const flipIdx of flips) {
    newBoard[flipIdx] = state.currentPlayer;
  }

  const move: Move = {
    row,
    col,
    algebraic: coordToAlgebraic(row, col),
    player: state.currentPlayer,
    flips,
  };

  // Truncate future moves if we played from an earlier move in history
  const newHistory = state.moveHistory.slice(0, state.currentMoveIndex);
  newHistory.push(move);

  const nextPlayer = -state.currentPlayer as Player;
  let nextLegalMoves = getLegalMoves(newBoard, nextPlayer);
  let activePlayer = nextPlayer;
  let isGameOver = false;

  // Check if opponent has legal moves; if not, check if current player can move again (pass)
  if (Object.keys(nextLegalMoves).length === 0) {
    const originalPlayerMoves = getLegalMoves(newBoard, state.currentPlayer);
    if (Object.keys(originalPlayerMoves).length === 0) {
      // Both players have no moves -> game over
      isGameOver = true;
    } else {
      // Opponent passes, current player moves again
      activePlayer = state.currentPlayer;
      nextLegalMoves = originalPlayerMoves;
    }
  }

  const counts = countDiscs(newBoard);
  if (counts.empty === 0 || counts.black === 0 || counts.white === 0) {
    isGameOver = true;
  }

  let winner: Player | 0 | null = null;
  if (isGameOver) {
    if (counts.black > counts.white) winner = 1;
    else if (counts.white > counts.black) winner = -1;
    else winner = 0; // Draw
  }

  return {
    ...state,
    board: newBoard,
    currentPlayer: activePlayer,
    moveHistory: newHistory,
    currentMoveIndex: newHistory.length,
    isGameOver,
    winner,
    blackCount: counts.black,
    whiteCount: counts.white,
    legalMoves: isGameOver ? {} : nextLegalMoves,
    lastMove: move,
  };
}

/**
 * Replays history up to targetIndex to support scrubbing / reviewing past positions.
 */
export function replayToMove(initialState: GameState, targetIndex: number): GameState {
  if (targetIndex < 0 || targetIndex > initialState.moveHistory.length) {
    return initialState;
  }

  let board = createInitialBoard();
  let currentPlayer: Player = 1;
  let lastMove: Move | null = null;

  for (let i = 0; i < targetIndex; i++) {
    const m = initialState.moveHistory[i];
    const targetIdx = coordToIndex(m.row, m.col);
    const flips = getFlipsForMove(board, m.row, m.col, m.player);

    board[targetIdx] = m.player;
    for (const f of flips) {
      board[f] = m.player;
    }
    lastMove = m;

    const nextP = -m.player as Player;
    const nextMoves = getLegalMoves(board, nextP);
    if (Object.keys(nextMoves).length > 0) {
      currentPlayer = nextP;
    } else {
      currentPlayer = m.player;
    }
  }

  const counts = countDiscs(board);
  const legalMoves = getLegalMoves(board, currentPlayer);
  const isGameOver = targetIndex === initialState.moveHistory.length 
    ? initialState.isGameOver 
    : Object.keys(legalMoves).length === 0;

  return {
    ...initialState,
    board,
    currentPlayer,
    currentMoveIndex: targetIndex,
    blackCount: counts.black,
    whiteCount: counts.white,
    legalMoves: isGameOver ? {} : legalMoves,
    lastMove,
    isGameOver,
    winner: isGameOver ? initialState.winner : null,
  };
}

/**
 * Formats game into standard GGF string recognized by NBoard / Edax.
 * Format: (;GM[Othello]PC[NBoard]PB[Black]PW[White]RE[?]TI[15:00]TY[8];B[c4];W[c3]...)
 */
export function toGGF(state: GameState): string {
  let ggf = '(;GM[Othello]PC[Rothello]PB[Black]PW[White]RE[?]TI[15:00]TY[8]';
  const historyToExport = state.moveHistory.slice(0, state.currentMoveIndex);

  for (const move of historyToExport) {
    const colorTag = move.player === 1 ? 'B' : 'W';
    ggf += `;${colorTag}[${move.algebraic}]`;
  }
  ggf += ';)';
  return ggf;
}
