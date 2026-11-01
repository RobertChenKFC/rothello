# Rothello 🟢⚫

**Rothello** is a modern, high-performance Othello (Reversi) engine and tournament-grade research platform built with a native Rust core, NBoard protocol support, a Lichess-inspired web interface, and a Stockfish/Fishtest-style self-play testing dashboard.

---

## 🌟 Key Features

### 1. High-Performance Rust Engine (`engine/`)
- **64-bit Bitboard Architecture**: Ultra-fast parallel move generation using shift-and-mask algorithms without loops.
- **Negamax with Alpha-Beta Pruning**: Quiescent stability with exact minimax score bounds.
- **Transposition Table (TT)**: 64-bit Zobrist hashing with exact, lower-bound, and upper-bound cutoffs.
- **Iterative Deepening Search**: Smooth time-management breaking on elapsed clocks with best-move fallback.
- **Throughput**: ~2,000,000 nodes/second on modern CPUs.
- **Standard NBoard Protocol**: Stdio communication supporting `depth`, `time`, `set game`, `go`, and `hint`.

### 2. Fishtest-Style Self-Play Testing Dashboard (`src/components/Dashboard/`)
- **SPRT (Sequential Probability Ratio Test)**:
  - Wald's sequential test ($H_0 \le 0$ Elo vs $H_1 \ge +5$ Elo, $\alpha=0.05, \beta=0.05$).
  - Automatic early stopping on bounds $[-2.94, +2.94]$ to avoid compute waste on clear winners or regressions.
- **Dual Testing Resource Modes**:
  - **Fixed Depth Mode**: Tests search tree shape, alpha-beta cutoffs, and evaluation function per ply.
  - **Fixed Time Control (TC) Mode**: Directly measures raw throughput/NPS speedups via iterative deepening (e.g. 50ms, 100ms, 250ms per move).
- **Statistical Significance & Elo Tracking**:
  - Logistic $\Delta\text{Elo} \pm 95\%\text{ CI}$ with Bayesian/Laplace smoothing to prevent low-sample outliers.
  - Rigorous significance coloring: **Green** for statistically proven gains, **Red** for regressions, and **Neutral** when 0 is within margin of error.
  - Estimated candidate Elo anchored against baseline (default: 1500 Elo).
- **Color-Alternating Opening Pairs**:
  - Balanced 2-game pairs played across 34 classical tournament openings (Rose, Tiger, Cat, Cow, variants) to completely neutralize color bias.
- **Diagnostic Benchmark Suite**:
  - 10 representative tactical, opening, and midgame positions evaluated in milliseconds to report NPS, Effective Branching Factor (EBF), and Move Agreement before spinning up matches.
- **One-Click Arena Replay**:
  - Every match pair includes full GGF notation with an interactive "Replay in Arena" button.

### 3. Lichess-Inspired Arena UI (`src/`)
- **Dark-Mode Aesthetic**: Charcoal palette (`#161512`), tournament green board, and 3D flip disc animations.
- **Real-Time Evaluation Bar**: Live score differential and win probability.
- **Interactive Move Review**: Scrub through history with arrow keys or step buttons (`|<`, `<`, `>`, `>|`).
- **Game Modes**: Human vs Engine, Analysis Sandbox, Bot Match (Engine vs Engine spectator mode), and 2-Player Pass & Play.

---

## 🚀 Getting Started

### Prerequisites
- **Node.js**: v18 or later (`node -v`)
- **Rust & Cargo**: Latest stable release (`cargo -V`) — [Install Rust](https://rustup.rs/)

### Installation & Build

1. **Clone the repository**:
   ```bash
   git clone git@github.com:RobertChenKFC/rothello.git
   cd rothello
   ```

2. **Install frontend & server dependencies**:
   ```bash
   npm install
   ```

3. **Compile the Rust Engine (Release Mode)**:
   ```bash
   npm run build:engine
   # Alternatively: cargo build --release --manifest-path engine/Cargo.toml
   ```
   The compiled release binary will be placed at `engine/target/release/rothello`.

---

## 💻 Running the Application

### Option A: Development Mode (Recommended)
Runs both the Vite UI hot-reloading dev server and the NBoard protocol WebSocket server simultaneously:
```bash
npm run dev
```
- **Web Interface**: [http://localhost:5173](http://localhost:5173) (defaults to Testing Dashboard with top navigation toggle to the Arena)
- **Backend API & NBoard Bridge**: `http://localhost:3001`

### Option B: Production Server
```bash
npm run build
npm run server
```
Serves the full production bundle and WebSocket server at [http://localhost:3001](http://localhost:3001).

---

## 🧪 Testing Engine Improvements

Rothello features an integrated testing pipeline to statistically validate candidate changes before merging.

### 1. Quick Diagnostic Benchmark
Before running full games, run the diagnostic benchmark to check throughput and search stability:
- Click **"Quick Benchmark"** in the top dashboard bar (or POST `/api/benchmark`).
- Takes ~5 milliseconds and reports:
  - **NPS (Nodes per Second)**
  - **EBF (Effective Branching Factor)**
  - **Move Agreement** against deep search across 10 benchmark positions.

### 2. Launching an SPRT Self-Play Experiment
1. Click **"New Experiment"** in the Testing Dashboard.
2. Configure your test:
   - **Resource Control**:
     - *Fixed Depth*: Tests algorithmic heuristics (e.g. Depth 6 vs Depth 4 or Depth 6 vs 6).
     - *Fixed Time Control*: Tests NPS speedups (e.g. 100ms / move).
   - **Engine Matchup**: Select Candidate (your modified build) and Baseline (previous checkpoint or depth handicap).
   - **Test Type**: SPRT (Fishtest bounds: $H_0=0.0$, $H_1=5.0$ Elo) or Fixed Game Count.
3. Click **"Start Experiment"**:
   - The runner plays 2-game color-alternating pairs in the background.
   - The Wald LLR bar and Elo curve update in real time over WebSockets.
   - The test stops automatically as soon as it crosses $+2.94$ (Pass) or $-2.94$ (Fail).

---

## 🛠 Contributing & Git Workflow

We use a Fishtest-inspired development cycle linking every test directly to Git commits:

```
                  ┌───────────────────────────────┐
                  │ Create Feature Branch         │
                  │ git checkout -b feature/eval  │
                  └──────────────┬────────────────┘
                                 │
                                 ▼
                  ┌───────────────────────────────┐
                  │ Implement Change in engine/   │
                  │ cargo build --release         │
                  └──────────────┬────────────────┘
                                 │
                                 ▼
                  ┌───────────────────────────────┐
                  │ Run Local SPRT Experiment     │
                  │ (Dashboard or CLI)            │
                  └──────────────┬────────────────┘
                                 │
                 ┌───────────────┴───────────────┐
                 │                               │
        [Passed / Elo Gain]             [Failed / Regression]
                 │                               │
                 ▼                               ▼
    ┌─────────────────────────┐     ┌─────────────────────────┐
    │ Open Pull Request       │     │ Document Regression     │
    │ (Include Test Summary)  │     │ (Push closed PR or log  │
    │ Merge into master       │     │  to preserve knowledge) │
    └─────────────────────────┘     └─────────────────────────┘
```

### In Case of an Improvement (`✓ Significant Gain`)
1. Once the SPRT test passes with statistically significant positive Elo:
2. Commit your changes and push your branch:
   ```bash
   git add engine/src/
   git commit -m "feat: improve mobility evaluation heuristic"
   git push origin feature/eval
   ```
3. Open a Pull Request on GitHub and copy/paste your experiment summary card into the PR description:
   ```markdown
   ### 🧪 Self-Play SPRT Test Result
   - **Matchup**: Candidate (feature/eval) vs Baseline (master)
   - **Resource**: 100ms / move (TC)
   - **Result**: PASSED (H1: >= +5 Elo)
   - **Estimated Elo**: 1558 (+58.2 ± 19.4, 95% CI)
   - **Record**: 34 W - 8 D - 6 L (80% Win Rate)
   - **SPRT LLR**: +2.97 (Bounds: [-2.94, +2.94])
   ```

### In Case of a Regression (`✗ Significant Loss` or `Inconclusive`)
- **Negative knowledge is valuable**: Knowing that an idea didn't work prevents future wasted effort.
- You can push the branch and open a closed PR or record the run in your commit history with the regression stats so the research history is preserved.

---

## 📜 Project Structure

```
rothello/
├── engine/                  # Native Rust Othello Engine
│   ├── Cargo.toml
│   └── src/
│       ├── bitboard.rs      # 64-bit parallel move generator & flip masks
│       ├── board.rs         # Board state & GGF parser
│       ├── search.rs        # Negamax alpha-beta, iterative deepening, time limit
│       ├── tt.rs            # Transposition table & 64-bit Zobrist hashing
│       ├── eval.rs          # Positional heuristics & mobility evaluation
│       ├── nboard.rs        # NBoard stdio protocol handler
│       └── main.rs          # CLI binary entrypoint
├── server/                  # Node.js backend & testing framework
│   ├── index.ts             # Express REST API & WebSocket broadcast hub
│   ├── nboard-bridge.ts     # Child process wrapper for external engines
│   ├── runner.ts            # Experiment manager, 2-game pairs, Git metadata
│   ├── sprt.ts              # Wald's SPRT, logistic Elo, Laplace smoothing
│   ├── openings.ts          # Classical WOF tournament openings (Rose, Tiger, Cat)
│   ├── benchmark-suite.ts   # 10 diagnostic tactical positions
│   └── builtin-engine.ts    # JS reference engine fallback
├── src/                     # React + Vite frontend
│   ├── components/
│   │   ├── Board.tsx        # 8x8 tournament board with 3D disc flip animations
│   │   ├── EvalBar.tsx      # Vertical live evaluation bar
│   │   ├── Header.tsx       # Mode selector & Dashboard/Arena tab switcher
│   │   ├── MoveHistory.tsx  # Algebraic move history & scrubbing controls
│   │   ├── EnginePanel.tsx  # Live engine telemetry (NPS, depth, nodes, time)
│   │   └── Dashboard/
│   │       ├── DashboardView.tsx       # Fishtest monitor, LLR bar, ledger table
│   │       └── NewExperimentModal.tsx  # Setup modal (Depth vs Time Control)
│   └── lib/
│       ├── othello.ts       # Board simulation, GGF export, and move logic
│       └── types.ts         # TypeScript data contracts
└── .experiments/            # Persistent local experiment ledger (JSON)
```

---

## 📄 License

MIT License. Designed and built for open research into high-performance Othello engines.
