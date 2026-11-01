use crate::board::{Board, Color};

#[derive(Copy, Clone, Debug, PartialEq, Eq, Default)]
pub enum TTFlag {
    #[default]
    None,
    Exact,
    LowerBound,
    UpperBound,
}

#[derive(Copy, Clone, Debug, Default)]
pub struct TTEntry {
    pub key: u64,
    pub score: i32,
    pub depth: u8,
    pub flag: TTFlag,
    pub best_move: u8, // 0..63, or 255 for none
}

pub struct Zobrist {
    pub pieces: [[u64; 64]; 2], // [0 for Black, 1 for White][square]
    pub side: u64,              // applied if White to move
}

impl Zobrist {
    pub fn new() -> Self {
        // Fast deterministic PRNG (SplitMix64) to initialize keys without external crates
        let mut seed = 0x853c49e6748fea9bu64;
        let mut next_u64 = || {
            seed = seed.wrapping_add(0x9e3779b97f4a7c15);
            let mut z = seed;
            z = (z ^ (z >> 30)).wrapping_mul(0xbf58476d1ce4e5b9);
            z = (z ^ (z >> 27)).wrapping_mul(0x94d049bb133111eb);
            z ^ (z >> 31)
        };

        let mut pieces = [[0u64; 64]; 2];
        for color in 0..2 {
            for sq in 0..64 {
                pieces[color][sq] = next_u64();
            }
        }
        let side = next_u64();

        Self { pieces, side }
    }

    #[inline]
    pub fn hash(&self, board: &Board) -> u64 {
        let mut h = 0u64;
        let mut black = board.black;
        while black != 0 {
            let sq = black.trailing_zeros() as usize;
            h ^= self.pieces[0][sq];
            black &= black - 1;
        }

        let mut white = board.white;
        while white != 0 {
            let sq = white.trailing_zeros() as usize;
            h ^= self.pieces[1][sq];
            white &= white - 1;
        }

        if board.side_to_move == Color::White {
            h ^= self.side;
        }

        h
    }
}

pub struct TranspositionTable {
    entries: Vec<TTEntry>,
    mask: usize,
    pub zobrist: Zobrist,
}

impl TranspositionTable {
    /// Creates a Transposition Table with a power-of-two size (e.g. 1,048,576 entries = ~16MB).
    pub fn new(num_entries: usize) -> Self {
        let size = num_entries.next_power_of_two();
        Self {
            entries: vec![TTEntry::default(); size],
            mask: size - 1,
            zobrist: Zobrist::new(),
        }
    }

    #[inline(always)]
    pub fn get(&self, key: u64) -> Option<&TTEntry> {
        let entry = &self.entries[(key as usize) & self.mask];
        if entry.key == key && entry.flag != TTFlag::None {
            Some(entry)
        } else {
            None
        }
    }

    #[inline(always)]
    pub fn probe(&self, key: u64, depth: u8, alpha: i32, beta: i32) -> (Option<i32>, u8) {
        if let Some(entry) = self.get(key) {
            let best_move = entry.best_move;
            if entry.depth >= depth {
                match entry.flag {
                    TTFlag::Exact => return (Some(entry.score), best_move),
                    TTFlag::LowerBound => {
                        if entry.score >= beta {
                            return (Some(entry.score), best_move);
                        }
                    }
                    TTFlag::UpperBound => {
                        if entry.score <= alpha {
                            return (Some(entry.score), best_move);
                        }
                    }
                    TTFlag::None => {}
                }
            }
            (None, best_move)
        } else {
            (None, 255)
        }
    }

    #[inline(always)]
    pub fn store(&mut self, key: u64, depth: u8, score: i32, flag: TTFlag, best_move: u8) {
        let idx = (key as usize) & self.mask;
        let entry = &mut self.entries[idx];
        // Replace if deeper, or if new search at same/greater depth
        if entry.flag == TTFlag::None || depth >= entry.depth || entry.key != key {
            entry.key = key;
            entry.depth = depth;
            entry.score = score;
            entry.flag = flag;
            entry.best_move = best_move;
        }
    }

    pub fn clear(&mut self) {
        for e in self.entries.iter_mut() {
            *e = TTEntry::default();
        }
    }
}
