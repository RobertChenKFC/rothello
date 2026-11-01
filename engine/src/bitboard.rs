/// 64-bit Bitboard representation and parallel move / flip generation for Othello.
/// Squares are indexed 0..63: row 0 (a1..h1) is bits 0..7, row 7 (a8..h8) is bits 56..63.

pub const FILE_A: u64 = 0x0101010101010101;
pub const FILE_B: u64 = 0x0202020202020202;
pub const FILE_G: u64 = 0x4040404040404040;
pub const FILE_H: u64 = 0x8080808080808080;

pub const NOT_A: u64 = !FILE_A;
pub const NOT_H: u64 = !FILE_H;

pub const CORNERS: u64 = (1 << 0) | (1 << 7) | (1 << 56) | (1 << 63);

#[inline(always)]
pub fn coord_to_sq(row: u8, col: u8) -> u8 {
    row * 8 + col
}

#[inline(always)]
pub fn sq_to_coord(sq: u8) -> (u8, u8) {
    (sq / 8, sq % 8)
}

pub fn sq_to_alg(sq: u8) -> String {
    if sq >= 64 {
        return "pa".to_string();
    }
    let col = (b'a' + (sq % 8)) as char;
    let row = (b'1' + (sq / 8)) as char;
    format!("{}{}", col, row)
}

pub fn alg_to_sq(alg: &str) -> Option<u8> {
    let s = alg.trim().to_lowercase();
    if s == "pass" || s == "pa" || s == "--" {
        return None;
    }
    let bytes = s.as_bytes();
    if bytes.len() < 2 {
        return None;
    }
    let col = bytes[0].wrapping_sub(b'a');
    let row = bytes[1].wrapping_sub(b'1');
    if col < 8 && row < 8 {
        Some(row * 8 + col)
    } else {
        None
    }
}

/// Generates a bitmask of all legal moves for `player` against `opponent`.
#[inline]
pub fn get_legal_moves(player: u64, opponent: u64) -> u64 {
    let empty = !(player | opponent);
    let mut legal = 0u64;

    // Helper macro to compute legal moves in a single direction
    macro_rules! check_dir {
        ($shift:expr, $is_left:expr, $mask:expr) => {{
            let opp_masked = opponent & $mask;
            let mut w = if $is_left {
                (player & $mask) << $shift
            } else {
                (player & $mask) >> $shift
            } & opp_masked;

            w |= if $is_left {
                (w & $mask) << $shift
            } else {
                (w & $mask) >> $shift
            } & opp_masked;

            w |= if $is_left {
                (w & $mask) << $shift
            } else {
                (w & $mask) >> $shift
            } & opp_masked;

            w |= if $is_left {
                (w & $mask) << $shift
            } else {
                (w & $mask) >> $shift
            } & opp_masked;

            w |= if $is_left {
                (w & $mask) << $shift
            } else {
                (w & $mask) >> $shift
            } & opp_masked;

            w |= if $is_left {
                (w & $mask) << $shift
            } else {
                (w & $mask) >> $shift
            } & opp_masked;

            legal |= if $is_left {
                (w & $mask) << $shift
            } else {
                (w & $mask) >> $shift
            } & empty;
        }};
    }

    // 1. East (shift left 1)
    check_dir!(1, true, NOT_H);
    // 2. West (shift right 1)
    check_dir!(1, false, NOT_A);
    // 3. South (shift left 8)
    check_dir!(8, true, !0u64);
    // 4. North (shift right 8)
    check_dir!(8, false, !0u64);
    // 5. South-East (shift left 9)
    check_dir!(9, true, NOT_H);
    // 6. South-West (shift left 7)
    check_dir!(7, true, NOT_A);
    // 7. North-East (shift right 7)
    check_dir!(7, false, NOT_H);
    // 8. North-West (shift right 9)
    check_dir!(9, false, NOT_A);

    legal
}

/// Computes all opponent discs flipped when `player` plays on `sq`.
#[inline]
pub fn get_flips(player: u64, opponent: u64, sq: u8) -> u64 {
    let move_bit = 1u64 << sq;
    let mut total_flips = 0u64;

    macro_rules! flip_dir {
        ($shift:expr, $is_left:expr, $mask:expr) => {{
            let mut ray = if $is_left {
                (move_bit & $mask) << $shift
            } else {
                (move_bit & $mask) >> $shift
            };
            let mut cand = 0u64;
            while ray != 0 && (ray & opponent) != 0 {
                cand |= ray;
                ray = if $is_left {
                    (ray & $mask) << $shift
                } else {
                    (ray & $mask) >> $shift
                };
            }
            if ray != 0 && (ray & player) != 0 {
                total_flips |= cand;
            }
        }};
    }

    flip_dir!(1, true, NOT_H);
    flip_dir!(1, false, NOT_A);
    flip_dir!(8, true, !0u64);
    flip_dir!(8, false, !0u64);
    flip_dir!(9, true, NOT_H);
    flip_dir!(7, true, NOT_A);
    flip_dir!(7, false, NOT_H);
    flip_dir!(9, false, NOT_A);

    total_flips
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_initial_board_moves() {
        // Initial Othello position:
        // Black on d5 (35) and e4 (28)
        // White on d4 (27) and e5 (36)
        let black = (1u64 << 35) | (1u64 << 28);
        let white = (1u64 << 27) | (1u64 << 36);

        let moves = get_legal_moves(black, white);
        // Standard starting legal moves for Black: c4 (19), d3 (19), e6 (44), f5 (37)
        // Let's check coords:
        // c4: row 3, col 2 -> 3*8 + 2 = 26
        // d3: row 2, col 3 -> 2*8 + 3 = 19
        // e6: row 5, col 4 -> 5*8 + 4 = 44
        // f5: row 4, col 5 -> 4*8 + 5 = 37
        assert_eq!(moves.count_ones(), 4);
        assert!((moves & (1u64 << 26)) != 0, "c4 should be legal");
        assert!((moves & (1u64 << 19)) != 0, "d3 should be legal");
        assert!((moves & (1u64 << 44)) != 0, "e6 should be legal");
        assert!((moves & (1u64 << 37)) != 0, "f5 should be legal");

        // Test flips for Black move d3 (19):
        // d3 is above d4 (white, 27) and d5 (black, 35) -> flips d4
        let flips = get_flips(black, white, 19);
        assert_eq!(flips, 1u64 << 27);
    }
}
