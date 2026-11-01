pub mod bitboard;
pub mod board;
pub mod eval;
pub mod tt;
pub mod search;
pub mod nboard;

fn main() {
    let mut nboard = nboard::NBoardLoop::new();
    nboard.run();
}
