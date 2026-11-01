/**
 * Built-in reference Othello Engine implementing the NBoard protocol.
 * Provides instant out-of-the-box opponent and analysis capabilities.
 */

const POSITIONAL_WEIGHTS = [
  100, -20,  10,   5,   5,  10, -20, 100,
  -20, -50,  -2,  -2,  -2,  -2, -50, -20,
   10,  -2,  -1,  -1,  -1,  -1,  -2,  10,
    5,  -2,  -1,   0,   0,  -1,  -2,   5,
    5,  -2,  -1,   0,   0,  -1,  -2,   5,
   10,  -2,  -1,  -1,  -1,  -1,  -2,  10,
  -20, -50,  -2,  -2,  -2,  -2, -50, -20,
  100, -20,  10,   5,   5,  10, -20, 100,
];

interface EngineBoard {
  squares: number[]; // 1 = Black, -1 = White, 0 = Empty
  turn: number; // 1 or -1
}

function coordToAlg(row: number, col: number): string {
  return String.fromCharCode(97 + col) + (row + 1);
}

function algToCoord(alg: string): { r: number; c: number } | null {
  if (!alg || alg.length < 2) return null;
  const c = alg.charCodeAt(0) - 97;
  const r = parseInt(alg[1], 10) - 1;
  if (r >= 0 && r < 8 && c >= 0 && c < 8) return { r, c };
  return null;
}

const DIRS = [
  [-1, -1], [-1, 0], [-1, 1],
  [0, -1],          [0, 1],
  [1, -1],  [1, 0],  [1, 1],
];

function getFlips(board: number[], r: number, c: number, player: number): number[] {
  const idx = r * 8 + c;
  if (board[idx] !== 0) return [];
  const opponent = -player;
  const flips: number[] = [];

  for (const [dr, dc] of DIRS) {
    let cr = r + dr;
    let cc = c + dc;
    const dirFlips: number[] = [];
    while (cr >= 0 && cr < 8 && cc >= 0 && cc < 8) {
      const piece = board[cr * 8 + cc];
      if (piece === opponent) {
        dirFlips.push(cr * 8 + cc);
      } else if (piece === player) {
        if (dirFlips.length > 0) flips.push(...dirFlips);
        break;
      } else {
        break;
      }
      cr += dr;
      cc += dc;
    }
  }
  return flips;
}

function generateMoves(board: number[], player: number): { r: number; c: number; flips: number[] }[] {
  const moves = [];
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const flips = getFlips(board, r, c, player);
      if (flips.length > 0) {
        moves.push({ r, c, flips });
      }
    }
  }
  return moves;
}

export class BuiltinNBoardEngine {
  private board: number[] = new Array(64).fill(0);
  private turn: number = 1;
  private depth: number = 6;
  private name: string = 'Rothello-Eval';
  private nodes: number = 0;
  private sendOutput: (line: string) => void;

  constructor(outputCb: (line: string) => void) {
    this.sendOutput = outputCb;
    this.resetBoard();
  }

  private resetBoard() {
    this.board.fill(0);
    this.board[3 * 8 + 3] = -1;
    this.board[3 * 8 + 4] = 1;
    this.board[4 * 8 + 3] = 1;
    this.board[4 * 8 + 4] = -1;
    this.turn = 1;
  }

  public handleCommand(rawLine: string) {
    const line = rawLine.trim();
    if (!line) return;

    const parts = line.split(/\s+/);
    const cmd = parts[0];
    const param = parts.slice(1).join(' ');

    switch (cmd) {
      case 'nboard': {
        this.sendOutput(`set myname ${this.name} ${this.depth}`);
        break;
      }
      case 'depth':
      case 'set': {
        if (cmd === 'depth' || parts[1] === 'depth') {
          const d = parseInt(cmd === 'depth' ? parts[1] : parts[2], 10);
          if (!isNaN(d) && d > 0) {
            this.depth = Math.min(d, 12);
            this.sendOutput(`set myname ${this.name} ${this.depth}`);
          }
        } else if (parts[1] === 'game') {
          this.parseGGF(parts.slice(2).join(' '));
        }
        break;
      }
      case 'game': {
        this.parseGGF(param);
        break;
      }
      case 'move': {
        this.applyMove(param);
        break;
      }
      case 'ping': {
        this.sendOutput(`pong ${param}`);
        break;
      }
      case 'hint': {
        const nHints = parseInt(param, 10) || 5;
        this.sendOutput(`status ${this.name} is thinking`);
        this.runHints(nHints);
        this.sendOutput(`status ${this.name} is waiting`);
        break;
      }
      case 'go': {
        this.sendOutput(`status ${this.name} is thinking`);
        const { bestMove, bestScore, timeSec } = this.searchBestMove();
        this.sendOutput(`=== ${bestMove || 'pass'} ${bestScore.toFixed(2)} ${timeSec.toFixed(3)}`);
        this.sendOutput(`status ${this.name} is waiting`);
        break;
      }
      case 'quit': {
        break;
      }
      default: {
        // Maybe algebraic coordinate directly (e.g. "c4")
        if (line.length === 2 && algToCoord(line)) {
          this.applyMove(line);
        }
        break;
      }
    }
  }

  private applyMove(alg: string) {
    const coord = algToCoord(alg);
    if (!coord) return;
    const flips = getFlips(this.board, coord.r, coord.c, this.turn);
    if (flips.length > 0) {
      this.board[coord.r * 8 + coord.c] = this.turn;
      for (const f of flips) this.board[f] = this.turn;
      const nextTurn = -this.turn;
      const nextMoves = generateMoves(this.board, nextTurn);
      if (nextMoves.length > 0) {
        this.turn = nextTurn;
      } else {
        const sameTurnMoves = generateMoves(this.board, this.turn);
        if (sameTurnMoves.length > 0) {
          // Opponent passes
        }
      }
    }
  }

  private parseGGF(ggf: string) {
    this.resetBoard();
    if (!ggf) return;

    // Matches B[c4] or ;B[c4] or W[d3] or ;W[d3]
    const moveRegex = /;?([BW])\[([a-h][1-8]|pass|pa|--)\]/gi;
    let match;
    while ((match = moveRegex.exec(ggf)) !== null) {
      const colorChar = match[1].toUpperCase();
      const alg = match[2].toLowerCase();
      const player = colorChar === 'B' ? 1 : -1;
      this.turn = player;
      if (alg !== 'pass' && alg !== 'pa' && alg !== '--') {
        const coord = algToCoord(alg);
        if (coord) {
          const flips = getFlips(this.board, coord.r, coord.c, player);
          this.board[coord.r * 8 + coord.c] = player;
          for (const f of flips) this.board[f] = player;
        }
      }
      this.turn = -player;
    }

    // Determine current turn based on legal moves
    const currentMoves = generateMoves(this.board, this.turn);
    if (currentMoves.length === 0) {
      const oppMoves = generateMoves(this.board, -this.turn);
      if (oppMoves.length > 0) {
        this.turn = -this.turn;
      }
    }
  }

  private evaluate(board: number[], player: number): number {
    let score = 0;
    let myCount = 0;
    let oppCount = 0;

    for (let i = 0; i < 64; i++) {
      const p = board[i];
      if (p === player) {
        myCount++;
        score += POSITIONAL_WEIGHTS[i];
      } else if (p === -player) {
        oppCount++;
        score -= POSITIONAL_WEIGHTS[i];
      }
    }

    // Mobility difference
    const myMob = generateMoves(board, player).length;
    const oppMob = generateMoves(board, -player).length;
    score += (myMob - oppMob) * 15;

    // Disc difference normalized to standard Othello score (-64..+64)
    const discDiff = myCount - oppCount;
    return score / 20 + discDiff * 0.5;
  }

  private alphaBeta(
    board: number[],
    depth: number,
    alpha: number,
    beta: number,
    player: number,
    passedBefore: boolean
  ): number {
    this.nodes++;
    if (depth <= 0) {
      return this.evaluate(board, player);
    }

    const moves = generateMoves(board, player);
    if (moves.length === 0) {
      if (passedBefore) {
        // Game Over: exact disc count
        let diff = 0;
        for (let i = 0; i < 64; i++) {
          diff += board[i] * player;
        }
        return diff * 10;
      }
      // Pass
      return -this.alphaBeta(board, depth - 1, -beta, -alpha, -player, true);
    }

    // Sort moves by position weight
    moves.sort((a, b) => POSITIONAL_WEIGHTS[b.r * 8 + b.c] - POSITIONAL_WEIGHTS[a.r * 8 + a.c]);

    let maxEval = -Infinity;
    for (const m of moves) {
      const newBoard = [...board];
      newBoard[m.r * 8 + m.c] = player;
      for (const f of m.flips) newBoard[f] = player;

      const evalVal = -this.alphaBeta(newBoard, depth - 1, -beta, -alpha, -player, false);
      if (evalVal > maxEval) maxEval = evalVal;
      alpha = Math.max(alpha, evalVal);
      if (beta <= alpha) break;
    }

    return maxEval;
  }

  private runHints(maxHints: number) {
    const startTime = Date.now();
    this.nodes = 0;
    const moves = generateMoves(this.board, this.turn);
    if (moves.length === 0) return;

    const evaluatedMoves: { alg: string; score: number }[] = [];
    const searchDepth = Math.min(this.depth, 7);

    for (const m of moves) {
      const newBoard = [...this.board];
      newBoard[m.r * 8 + m.c] = this.turn;
      for (const f of m.flips) newBoard[f] = this.turn;

      const score = -this.alphaBeta(newBoard, searchDepth - 1, -10000, 10000, -this.turn, false);
      evaluatedMoves.push({
        alg: coordToAlg(m.r, m.c),
        score: Math.max(-64, Math.min(64, score)),
      });
    }

    evaluatedMoves.sort((a, b) => b.score - a.score);
    const timeSec = (Date.now() - startTime) / 1000;

    for (let i = 0; i < Math.min(maxHints, evaluatedMoves.length); i++) {
      const item = evaluatedMoves[i];
      // Format matches NBoard standard: "search <pv> <score> 0 <depth>"
      this.sendOutput(`search ${item.alg} ${item.score.toFixed(1)} 0 ${searchDepth}`);
    }

    this.sendOutput(`nodestats ${this.nodes} ${timeSec.toFixed(2)}`);
  }

  private searchBestMove(): { bestMove: string; bestScore: number; timeSec: number } {
    const startTime = Date.now();
    this.nodes = 0;
    const moves = generateMoves(this.board, this.turn);

    if (moves.length === 0) {
      return { bestMove: 'pass', bestScore: 0, timeSec: 0 };
    }

    let bestMove = coordToAlg(moves[0].r, moves[0].c);
    let bestScore = -Infinity;
    const searchDepth = Math.min(this.depth, 8);

    moves.sort((a, b) => POSITIONAL_WEIGHTS[b.r * 8 + b.c] - POSITIONAL_WEIGHTS[a.r * 8 + a.c]);

    for (const m of moves) {
      const newBoard = [...this.board];
      newBoard[m.r * 8 + m.c] = this.turn;
      for (const f of m.flips) newBoard[f] = this.turn;

      const score = -this.alphaBeta(newBoard, searchDepth - 1, -10000, 10000, -this.turn, false);
      if (score > bestScore) {
        bestScore = score;
        bestMove = coordToAlg(m.r, m.c);
      }
    }

    const timeSec = (Date.now() - startTime) / 1000;
    this.sendOutput(`nodestats ${this.nodes} ${timeSec.toFixed(2)}`);
    return {
      bestMove,
      bestScore: Math.max(-64, Math.min(64, bestScore)),
      timeSec,
    };
  }
}
