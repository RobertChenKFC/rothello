use std::io::{self, BufRead, Write};
use crate::bitboard::*;
use crate::board::Board;
use crate::search::Searcher;

pub struct NBoardLoop {
    board: Board,
    searcher: Searcher,
    depth: u8,
    time_limit_sec: Option<f64>,
    name: String,
}

impl NBoardLoop {
    pub fn new() -> Self {
        Self {
            board: Board::new(),
            searcher: Searcher::new(),
            depth: 10,
            time_limit_sec: None,
            name: "Rothello-Rust".to_string(),
        }
    }

    pub fn run(&mut self) {
        let stdin = io::stdin();
        let mut stdout = io::stdout();

        for line_res in stdin.lock().lines() {
            let line = match line_res {
                Ok(l) => l.trim().to_string(),
                Err(_) => break,
            };

            if line.is_empty() {
                continue;
            }

            let parts: Vec<&str> = line.split_whitespace().collect();
            let cmd = parts[0];

            match cmd {
                "nboard" => {
                    let _version = parts.get(1).unwrap_or(&"1");
                    writeln!(stdout, "set myname {} {}", self.name, self.depth).unwrap();
                    stdout.flush().unwrap();
                }

                "depth" => {
                    if let Some(d_str) = parts.get(1) {
                        if let Ok(d) = d_str.parse::<u8>() {
                            self.depth = d.clamp(1, 24);
                            self.time_limit_sec = None; // Explicit depth clears time limit
                            writeln!(stdout, "set myname {} {}", self.name, self.depth).unwrap();
                            stdout.flush().unwrap();
                        }
                    }
                }

                "time" => {
                    if let Some(t_str) = parts.get(1) {
                        if let Ok(t) = t_str.parse::<f64>() {
                            self.time_limit_sec = if t > 0.001 { Some(t) } else { None };
                        }
                    }
                }

                "set" => {
                    if parts.len() >= 3 && parts[1] == "game" {
                        let ggf = parts[2..].join(" ");
                        if let Ok(b) = Board::from_ggf(&ggf) {
                            self.board = b;
                        }
                    } else if parts.len() >= 3 && parts[1] == "depth" {
                        if let Ok(d) = parts[2].parse::<u8>() {
                            self.depth = d.clamp(1, 24);
                            self.time_limit_sec = None;
                            writeln!(stdout, "set myname {} {}", self.name, self.depth).unwrap();
                            stdout.flush().unwrap();
                        }
                    } else if parts.len() >= 3 && parts[1] == "time" {
                        if let Ok(t) = parts[2].parse::<f64>() {
                            self.time_limit_sec = if t > 0.001 { Some(t) } else { None };
                        }
                    }
                }

                "go" => {
                    writeln!(stdout, "status {} is thinking", self.name).unwrap();
                    stdout.flush().unwrap();

                    let search_depth = if self.time_limit_sec.is_some() { 24 } else { self.depth };
                    let res = self.searcher.search(&self.board, search_depth, self.time_limit_sec, None);

                    writeln!(stdout, "nodestats {} {:.3}", res.nodes, res.time_sec).unwrap();
                    let move_str = match res.best_move {
                        Some(sq) => sq_to_alg(sq),
                        None => "pa".to_string(),
                    };
                    let eval_score = (res.score as f64) / 100.0;
                    writeln!(
                        stdout,
                        "=== {} {:.2} {:.3}",
                        move_str, eval_score, res.time_sec
                    )
                    .unwrap();

                    // Advance board if move was found
                    if let Some(sq) = res.best_move {
                        self.board.make_move(sq);
                    } else {
                        self.board.pass();
                    }

                    writeln!(stdout, "status {} is waiting", self.name).unwrap();
                    stdout.flush().unwrap();
                }

                "hint" => {
                    let count = parts.get(1).and_then(|s| s.parse::<usize>().ok()).unwrap_or(5);
                    writeln!(stdout, "status {} is thinking", self.name).unwrap();
                    stdout.flush().unwrap();

                    let candidates = self.searcher.analyze_candidates(&self.board, self.depth.min(8), count);
                    for (sq, score) in candidates {
                        let alg = sq_to_alg(sq);
                        writeln!(stdout, "search {} {:.1} 0 {}", alg, score, self.depth).unwrap();
                    }

                    writeln!(stdout, "nodestats {} {:.3}", self.searcher.nodes, 0.05).unwrap();
                    writeln!(stdout, "status {} is waiting", self.name).unwrap();
                    stdout.flush().unwrap();
                }

                "ping" => {
                    let param = parts.get(1).unwrap_or(&"0");
                    writeln!(stdout, "pong {}", param).unwrap();
                    stdout.flush().unwrap();
                }

                "move" => {
                    if let Some(alg) = parts.get(1) {
                        if let Some(sq) = alg_to_sq(alg) {
                            self.board.make_move(sq);
                        } else if alg.eq_ignore_ascii_case("pa") || alg.eq_ignore_ascii_case("pass") {
                            self.board.pass();
                        }
                    }
                }

                "quit" | "exit" => {
                    break;
                }

                _ => {}
            }
        }
    }
}
