use crate::bitboard::*;
use crate::tt::ZOBRIST;

#[derive(Copy, Clone, Debug, PartialEq, Eq)]
pub enum Color {
    Black = 1,
    White = -1,
}

impl Color {
    #[inline(always)]
    pub fn opponent(self) -> Color {
        match self {
            Color::Black => Color::White,
            Color::White => Color::Black,
        }
    }
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Board {
    pub black: u64,
    pub white: u64,
    pub side_to_move: Color,
    pub hash: u64,
}

impl Board {
    pub fn new() -> Self {
        // Standard starting Othello position:
        // Black on d5 (35) and e4 (28)
        // White on d4 (27) and e5 (36)
        let black = (1u64 << 35) | (1u64 << 28);
        let white = (1u64 << 27) | (1u64 << 36);
        let mut board = Self {
            black,
            white,
            side_to_move: Color::Black,
            hash: 0,
        };
        board.hash = board.compute_full_hash();
        board
    }

    /// Computes full Zobrist hash from scratch.
    pub fn compute_full_hash(&self) -> u64 {
        let mut h = 0u64;
        let mut b = self.black;
        while b != 0 {
            let sq = b.trailing_zeros() as usize;
            h ^= ZOBRIST.pieces[0][sq];
            b &= b - 1;
        }
        let mut w = self.white;
        while w != 0 {
            let sq = w.trailing_zeros() as usize;
            h ^= ZOBRIST.pieces[1][sq];
            w &= w - 1;
        }
        if self.side_to_move == Color::White {
            h ^= ZOBRIST.side;
        }
        h
    }

    #[inline(always)]
    pub fn current_discs(&self) -> u64 {
        match self.side_to_move {
            Color::Black => self.black,
            Color::White => self.white,
        }
    }

    #[inline(always)]
    pub fn opponent_discs(&self) -> u64 {
        match self.side_to_move {
            Color::Black => self.white,
            Color::White => self.black,
        }
    }

    #[inline(always)]
    pub fn legal_moves(&self) -> u64 {
        get_legal_moves(self.current_discs(), self.opponent_discs())
    }

    #[inline(always)]
    pub fn opponent_legal_moves(&self) -> u64 {
        get_legal_moves(self.opponent_discs(), self.current_discs())
    }

    /// Plays a move at `sq`. Returns true if the move was legal and played, false otherwise.
    pub fn make_move(&mut self, sq: u8) -> bool {
        if sq >= 64 {
            return false;
        }
        let move_bit = 1u64 << sq;
        let legal = self.legal_moves();
        if (legal & move_bit) == 0 {
            return false;
        }

        let player = self.current_discs();
        let opponent = self.opponent_discs();
        let flips = get_flips(player, opponent, sq);

        let new_player = player | move_bit | flips;
        let new_opp = opponent ^ flips;

        let player_idx = if self.side_to_move == Color::Black { 0 } else { 1 };
        self.hash ^= ZOBRIST.pieces[player_idx][sq as usize];
        let mut f = flips;
        while f != 0 {
            let flip_sq = f.trailing_zeros() as usize;
            self.hash ^= ZOBRIST.flip[flip_sq];
            f &= f - 1;
        }
        self.hash ^= ZOBRIST.side;

        match self.side_to_move {
            Color::Black => {
                self.black = new_player;
                self.white = new_opp;
            }
            Color::White => {
                self.white = new_player;
                self.black = new_opp;
            }
        }

        // Advance turn to opponent
        self.side_to_move = self.side_to_move.opponent();
        true
    }

    /// Passes the turn to the opponent. Returns true if passing is required/allowed.
    pub fn pass(&mut self) -> bool {
        if self.legal_moves() == 0 {
            self.side_to_move = self.side_to_move.opponent();
            self.hash ^= ZOBRIST.side;
            true
        } else {
            false
        }
    }

    pub fn is_game_over(&self) -> bool {
        (self.black | self.white) == !0u64
            || (self.legal_moves() == 0 && self.opponent_legal_moves() == 0)
    }

    pub fn disc_count(&self) -> (u32, u32) {
        (self.black.count_ones(), self.white.count_ones())
    }

    /// Parses a GGF string (e.g. "(;GM[othello]B[c4]W[e3]...;)") and reconstructs the board position.
    pub fn from_ggf(ggf: &str) -> Result<Self, String> {
        let mut board = Board::new();
        let bytes = ggf.as_bytes();
        let mut i = 0;
        let n = bytes.len();

        while i < n {
            // Find next move token like B[...] or W[...]
            if (bytes[i] == b'B' || bytes[i] == b'W' || bytes[i] == b'b' || bytes[i] == b'w')
                && i + 1 < n
                && bytes[i + 1] == b'['
            {
                let is_black = bytes[i] == b'B' || bytes[i] == b'b';
                let end_bracket = match ggf[i + 2..].find(']') {
                    Some(idx) => i + 2 + idx,
                    None => break,
                };
                let move_str = &ggf[i + 2..end_bracket];

                let target_color = if is_black { Color::Black } else { Color::White };
                // If board turn doesn't match, check if current side must pass
                if board.side_to_move != target_color {
                    if board.legal_moves() == 0 {
                        board.pass();
                    }
                }

                if let Some(sq) = alg_to_sq(move_str) {
                    if !board.make_move(sq) {
                        // If standard make_move failed, try forcing pass if turn was swapped
                        if board.legal_moves() == 0 {
                            board.pass();
                            board.make_move(sq);
                        }
                    }
                } else if move_str.eq_ignore_ascii_case("pa") || move_str.eq_ignore_ascii_case("pass") || move_str == "--" {
                    board.pass();
                }

                i = end_bracket + 1;
            } else {
                i += 1;
            }
        }

        // Final check: if current side has no moves, advance to opponent
        if board.legal_moves() == 0 && board.opponent_legal_moves() > 0 {
            board.pass();
        }

        Ok(board)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_ggf_parse_and_play() {
        let ggf = "(;GM[othello]B[c4]W[e3]B[f6];)";
        let board = Board::from_ggf(ggf).expect("Valid GGF");
        assert_eq!(board.side_to_move, Color::White);
        let (b, w) = board.disc_count();
        assert_eq!(b + w, 7);
        assert_eq!(board.hash, board.compute_full_hash());
    }

    #[test]
    fn test_incremental_zobrist() {
        let mut board = Board::new();
        assert_eq!(board.hash, board.compute_full_hash());
        let moves = [19, 18, 26, 21, 20]; // some typical squares
        for &m in &moves {
            if board.make_move(m) {
                assert_eq!(board.hash, board.compute_full_hash(), "Hash mismatch after move {}", m);
            }
        }
    }
}
