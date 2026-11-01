# Rothello (Phase 1)

A modern, Lichess-inspired Othello (Reversi) UI and NBoard protocol bridge designed to train, evaluate, and benchmark high-performance Othello engines.

---

## Features

- **Lichess Aesthetic**:
  - Dark-mode charcoal interface (`#161512`), tournament green board (`#1e5838`), guide star dots, and tactile 3D discs with flip transitions.
  - Interactive legal move indicators with hover flip counters.
  - Last move highlighted with pulsating indicators.
  - Real-time vertical Evaluation Bar with win probability and score differential.
- **Game Modes**:
  - **vs Engine**: Play as Black or White against an NBoard-compatible AI.
  - **Analysis**: Free board sandbox with automatic live candidate move hints (`search <pv> <score> <nGames> <depth>`).
  - **Bot Match**: Engine vs Engine automated spectator mode.
  - **2 Players**: Local pass-and-play.
- **Move History & Review**:
  - Standard algebraic notation (`1. c4 c3 2. d3 c5...`).
  - Scrubbing controls (`|<`, `<`, `>`, `>|`, arrow keys) to jump to any past position.
  - GGF string copy for compatibility with Edax, Ntest, and GGS databases.
- **NBoard Protocol Bridge**:
  - Bi-directional stdio communication with external engines (`edax`, `ntest`, and future Rust engines).
  - Built-in reference engine with minimax alpha-beta search and positional heuristic tables for zero-setup instant play.
  - Interactive NBoard Protocol Console to inspect raw `stdin`/`stdout` packets in real time.

---

## Running the Application

### Option A: Development (Hot-Reload)
```bash
npm run dev
```
Opens the UI at [http://localhost:5173](http://localhost:5173) with live WebSocket proxying to port 3001.

### Option B: Production / Standalone
```bash
npm run build
npm run server
```
Serves the full application and WebSocket bridge at [http://localhost:3001](http://localhost:3001).

---

## Connecting External Engines (Edax / Rothello Core)

Engines implementing the standard NBoard protocol can be selected directly in the UI or added to `DEFAULT_ENGINES` in `server/index.ts`:

- **Handshake**: `nboard 1` -> engine responds with `set myname <name> <depth>`
- **Sync**: `ping <id>` -> engine responds with `pong <id>`
- **Game State**: `set game (;GM[Othello]...;B[c4];W[c3];)`
- **Evaluation / Hint**: `hint 5` -> `search <pv> <score> 0 <depth>`
- **Move Generation**: `go` -> `=== <move> <score> <time>`
