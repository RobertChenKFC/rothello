use std::time::Instant;
use crate::bitboard::*;
use crate::board::Board;
use crate::eval::{evaluate, CORNER_MASK, STATIC_WEIGHTS, X_SQUARES};
use crate::tt::{TTFlag, TranspositionTable};

pub const INFINITY: i32 = 30000;

pub struct SearchResult {
    pub best_move: Option<u8>,
    pub score: i32,
    pub depth: u8,
    pub nodes: u64,
    pub time_sec: f64,
    pub pv: Vec<u8>,
}

pub struct Searcher {
    pub tt: TranspositionTable,
    pub nodes: u64,
    pub start_time: Instant,
    pub time_limit_sec: Option<f64>,
    pub stop: bool,
}

impl Searcher {
    pub fn new() -> Self {
        Self {
            tt: TranspositionTable::new(1048576), // ~1M entries
            nodes: 0,
            start_time: Instant::now(),
            time_limit_sec: None,
            stop: false,
        }
    }

    #[inline]
    fn check_time(&mut self) -> bool {
        if let Some(limit) = self.time_limit_sec {
            if self.nodes & 4095 == 0 {
                if self.start_time.elapsed().as_secs_f64() >= limit {
                    self.stop = true;
                }
            }
        }
        self.stop
    }

    /// Orders legal moves to maximize early alpha-beta cutoffs.
    fn order_moves(&self, legal_mask: u64, tt_move: u8) -> Vec<u8> {
        let mut moves = Vec::with_capacity(legal_mask.count_ones() as usize);
        let mut bits = legal_mask;
        while bits != 0 {
            let sq = bits.trailing_zeros() as u8;
            moves.push(sq);
            bits &= bits - 1;
        }

        moves.sort_by_cached_key(|&sq| {
            if sq == tt_move {
                return i32::MIN; // Search TT move first!
            }
            let is_corner = (CORNER_MASK & (1u64 << sq)) != 0;
            if is_corner {
                return -10000;
            }

            // Penalty for X-squares if corner empty
            let is_x = X_SQUARES.iter().any(|&(x, _)| x == sq);
            let mut score = -STATIC_WEIGHTS[sq as usize];
            if is_x {
                score += 500;
            }
            score
        });

        moves
    }

    /// Core Negamax alpha-beta search with Transposition Table and PVS.
    pub fn negamax(
        &mut self,
        board: &Board,
        depth: u8,
        mut alpha: i32,
        beta: i32,
        passed_before: bool,
    ) -> i32 {
        self.nodes += 1;

        if self.check_time() {
            return 0;
        }

        let key = self.tt.zobrist.hash(board);

        // TT Probe
        let (tt_score, tt_move) = self.tt.probe(key, depth, alpha, beta);
        if let Some(score) = tt_score {
            return score;
        }

        if depth == 0 || board.is_game_over() {
            let eval = evaluate(board);
            self.tt.store(key, depth, eval, TTFlag::Exact, 255);
            return eval;
        }

        let legal_mask = board.legal_moves();
        if legal_mask == 0 {
            // Pass
            if passed_before {
                // Consecutive passes -> Game Over
                return evaluate(board);
            }
            let mut passed_board = board.clone();
            passed_board.pass();
            let score = -self.negamax(&passed_board, depth, -beta, -alpha, true);
            return score;
        }

        let moves = self.order_moves(legal_mask, tt_move);
        let mut best_score = -INFINITY;
        let mut best_move = 255u8;
        let original_alpha = alpha;

        for (i, &sq) in moves.iter().enumerate() {
            let mut next_board = board.clone();
            next_board.make_move(sq);

            let score = if i == 0 {
                // Search first move with full window
                -self.negamax(&next_board, depth - 1, -beta, -alpha, false)
            } else {
                // Principal Variation Search (null window test)
                let mut s = -self.negamax(&next_board, depth - 1, -alpha - 1, -alpha, false);
                if s > alpha && s < beta {
                    // Re-search with full window
                    s = -self.negamax(&next_board, depth - 1, -beta, -alpha, false);
                }
                s
            };

            if self.stop {
                return 0;
            }

            if score > best_score {
                best_score = score;
                best_move = sq;
            }
            if score > alpha {
                alpha = score;
            }
            if alpha >= beta {
                break; // Beta cutoff
            }
        }

        // Store result in TT
        let flag = if best_score <= original_alpha {
            TTFlag::UpperBound
        } else if best_score >= beta {
            TTFlag::LowerBound
        } else {
            TTFlag::Exact
        };
        self.tt.store(key, depth, best_score, flag, best_move);

        best_score
    }

    /// Iterative deepening search up to target depth.
    pub fn search(
        &mut self,
        board: &Board,
        target_depth: u8,
        time_limit_sec: Option<f64>,
        mut info_callback: Option<&mut dyn FnMut(u8, i32, u8, u64, f64)>,
    ) -> SearchResult {
        self.nodes = 0;
        self.start_time = Instant::now();
        self.time_limit_sec = time_limit_sec;
        self.stop = false;

        let legal_mask = board.legal_moves();
        if legal_mask == 0 {
            // Must pass
            return SearchResult {
                best_move: None,
                score: 0,
                depth: 0,
                nodes: 1,
                time_sec: 0.0,
                pv: vec![],
            };
        }

        let mut overall_best_move = None;
        let mut overall_score = 0;
        let max_depth = target_depth.max(1);

        for d in 1..=max_depth {
            let score = self.negamax(board, d, -INFINITY, INFINITY, false);
            if self.stop && d > 1 {
                break;
            }

            let key = self.tt.zobrist.hash(board);
            if let Some(entry) = self.tt.get(key) {
                if entry.best_move < 64 {
                    overall_best_move = Some(entry.best_move);
                }
            }
            overall_score = score;

            let elapsed = self.start_time.elapsed().as_secs_f64();
            if let Some(ref mut cb) = info_callback {
                if let Some(bm) = overall_best_move {
                    cb(d, score, bm, self.nodes, elapsed);
                }
            }
        }

        let elapsed = self.start_time.elapsed().as_secs_f64();
        SearchResult {
            best_move: overall_best_move,
            score: overall_score,
            depth: target_depth,
            nodes: self.nodes,
            time_sec: elapsed,
            pv: overall_best_move.map(|m| vec![m]).unwrap_or_default(),
        }
    }

    /// MultiPV analysis: evaluates all legal moves at the given depth and returns ranked candidates.
    pub fn analyze_candidates(
        &mut self,
        board: &Board,
        depth: u8,
        count: usize,
    ) -> Vec<(u8, f64)> {
        let legal_mask = board.legal_moves();
        if legal_mask == 0 {
            return vec![];
        }

        let mut candidates = Vec::new();
        let mut bits = legal_mask;
        while bits != 0 {
            let sq = bits.trailing_zeros() as u8;
            bits &= bits - 1;

            let mut next_board = board.clone();
            next_board.make_move(sq);
            let score = -self.negamax(&next_board, depth.saturating_sub(1), -INFINITY, INFINITY, false);
            // Convert internal score to approximate disc differential for NBoard
            let disc_diff = (score as f64) / 100.0;
            candidates.push((sq, disc_diff));
        }

        candidates.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap_or(std::cmp::Ordering::Equal));
        candidates.truncate(count);
        candidates
    }
}
