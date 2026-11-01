use crate::bitboard::*;
use crate::board::Board;

pub const CORNER_MASK: u64 = 0x8100000000000081;

// X-squares: (x_sq, adjacent_corner_sq)
pub const X_SQUARES: [(u8, u8); 4] = [
    (9, 0),   // b2 -> a1
    (14, 7),  // g2 -> h1
    (49, 56), // b7 -> a8
    (54, 63), // g7 -> h8
];

// C-squares: (c_sq, adjacent_corner_sq)
pub const C_SQUARES: [(u8, u8); 8] = [
    (1, 0),   // b1 -> a1
    (8, 0),   // a2 -> a1
    (6, 7),   // g1 -> h1
    (15, 7),  // h2 -> h1
    (48, 56), // a7 -> a8
    (57, 56), // b8 -> a8
    (55, 63), // h7 -> h8
    (62, 63), // g8 -> h8
];

// Positional static weights
#[rustfmt::skip]
pub const STATIC_WEIGHTS: [i32; 64] = [
    120, -25,  20,   5,   5,  20, -25, 120,
    -25, -45,  -5,  -5,  -5,  -5, -45, -25,
     20,  -5,  15,   3,   3,  15,  -5,  20,
      5,  -5,   3,   3,   3,   3,  -5,   5,
      5,  -5,   3,   3,   3,   3,  -5,   5,
     20,  -5,  15,   3,   3,  15,  -5,  20,
    -25, -45,  -5,  -5,  -5,  -5, -45, -25,
    120, -25,  20,   5,   5,  20, -25, 120,
];

/// Computes a frontier disc mask (discs adjacent to at least one empty square)
#[inline]
pub fn get_frontier(discs: u64, empty: u64) -> u64 {
    let mut neighbors = 0u64;
    neighbors |= (empty & NOT_H) << 1;
    neighbors |= (empty & NOT_A) >> 1;
    neighbors |= empty << 8;
    neighbors |= empty >> 8;
    neighbors |= (empty & NOT_H) << 9;
    neighbors |= (empty & NOT_A) << 7;
    neighbors |= (empty & NOT_H) >> 7;
    neighbors |= (empty & NOT_A) >> 9;
    discs & neighbors
}

/// Evaluates position from perspective of the side to move.
pub fn evaluate(board: &Board) -> i32 {
    let my_discs = board.current_discs();
    let opp_discs = board.opponent_discs();

    let my_count = my_discs.count_ones() as i32;
    let opp_count = opp_discs.count_ones() as i32;
    let total_discs = my_count + opp_count;
    let empty_count = 64 - total_discs;

    // 1. If Game Over: return exact disc differential with massive win/loss bonus
    if board.is_game_over() || empty_count == 0 {
        let diff = my_count - opp_count;
        if diff > 0 {
            return 10000 + diff * 100;
        } else if diff < 0 {
            return -10000 + diff * 100;
        } else {
            return 0; // Draw
        }
    }

    // 2. Corner score
    let my_corners = (my_discs & CORNER_MASK).count_ones() as i32;
    let opp_corners = (opp_discs & CORNER_MASK).count_ones() as i32;
    let corner_score = (my_corners - opp_corners) * 450;

    // 3. X-squares and C-squares penalties (only apply if adjacent corner is empty)
    let occupied = my_discs | opp_discs;
    let mut x_score = 0i32;
    for &(x_sq, c_sq) in &X_SQUARES {
        if (occupied & (1u64 << c_sq)) == 0 {
            if (my_discs & (1u64 << x_sq)) != 0 {
                x_score -= 160;
            } else if (opp_discs & (1u64 << x_sq)) != 0 {
                x_score += 160;
            }
        }
    }

    let mut c_score = 0i32;
    for &(c_sq, corner_sq) in &C_SQUARES {
        if (occupied & (1u64 << corner_sq)) == 0 {
            if (my_discs & (1u64 << c_sq)) != 0 {
                c_score -= 60;
            } else if (opp_discs & (1u64 << c_sq)) != 0 {
                c_score += 60;
            }
        }
    }

    // 4. Mobility score (number of legal moves)
    let my_mob = board.legal_moves().count_ones() as i32;
    let opp_mob = board.opponent_legal_moves().count_ones() as i32;
    let mobility_score = if my_mob + opp_mob > 0 {
        ((my_mob - opp_mob) * 100) / (my_mob + opp_mob)
    } else {
        0
    } * 15;

    // 5. Frontier discs score (fewer frontier discs is better)
    let empty = !occupied;
    let my_frontier = get_frontier(my_discs, empty).count_ones() as i32;
    let opp_frontier = get_frontier(opp_discs, empty).count_ones() as i32;
    let frontier_score = (opp_frontier - my_frontier) * 10;

    // 6. Positional board weights
    let mut positional_score = 0i32;
    let mut my_bits = my_discs;
    while my_bits != 0 {
        let sq = my_bits.trailing_zeros() as usize;
        positional_score += STATIC_WEIGHTS[sq];
        my_bits &= my_bits - 1;
    }
    let mut opp_bits = opp_discs;
    while opp_bits != 0 {
        let sq = opp_bits.trailing_zeros() as usize;
        positional_score -= STATIC_WEIGHTS[sq];
        opp_bits &= opp_bits - 1;
    }

    // 7. Disc differential (scaled based on game phase)
    let disc_diff_weight = if empty_count > 32 {
        0
    } else if empty_count > 16 {
        (32 - empty_count) * 2
    } else {
        32 + (16 - empty_count) * 5
    };
    let disc_diff_score = (my_count - opp_count) * disc_diff_weight;

    corner_score
        + x_score
        + c_score
        + mobility_score
        + frontier_score
        + positional_score
        + disc_diff_score
}
