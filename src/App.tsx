import React, { useState, useEffect, useRef, useCallback } from 'react';
import { GameState, Player, EngineStatus } from './lib/types';
import {
  createInitialGameState,
  makeMove,
  makePass,
  getLegalMoves,
  replayToMove,
  toGGF,
  algebraicToCoord,
} from './lib/othello';
import { Board } from './components/Board';
import { EvalBar } from './components/EvalBar';
import { PlayerCard } from './components/PlayerCard';
import { MoveHistory } from './components/MoveHistory';
import { EnginePanel } from './components/EnginePanel';
import { Header } from './components/Header';
import { BotMatchControls } from './components/BotMatchControls';
import { DashboardView } from './components/Dashboard/DashboardView';

export const App: React.FC = () => {
  // Default to Fishtest Dashboard as requested
  const [activeTab, setActiveTab] = useState<'dashboard' | 'arena'>('dashboard');
  const [experiments, setExperiments] = useState<any[]>([]);
  const [activeExperiment, setActiveExperiment] = useState<any | null>(null);
  const [gitInfo, setGitInfo] = useState<any | null>(null);

  const [gameState, setGameState] = useState<GameState>(createInitialGameState());
  const [flipped, setFlipped] = useState(false);
  const [availableEngines, setAvailableEngines] = useState<
    { id: string; name: string; available: boolean; type: string }[]
  >([]);
  const [currentEngineId, setCurrentEngineId] = useState('edax');
  const [rawLogs, setRawLogs] = useState<string[]>([]);

  // Bot Match dual engine states
  const [blackBotId, setBlackBotId] = useState('edax');
  const [whiteBotId, setWhiteBotId] = useState('builtin');
  const [blackBotDepth, setBlackBotDepth] = useState(10);
  const [whiteBotDepth, setWhiteBotDepth] = useState(6);
  const [isBotMatchRunning, setIsBotMatchRunning] = useState(false);
  const [botMoveDelay, setBotMoveDelay] = useState(350);

  const [engineTelemetry, setEngineTelemetry] = useState<Record<string, EngineStatus>>({
    edax: {
      name: 'Edax 4.4 (Native)',
      connected: false,
      state: 'waiting',
      statusText: 'Engine ready',
      depth: 10,
      nodes: 0,
      nps: 0,
      timeSec: 0,
      hints: [],
    },
    builtin: {
      name: 'Rothello Reference (JS)',
      connected: true,
      state: 'waiting',
      statusText: 'Engine ready',
      depth: 6,
      nodes: 0,
      nps: 0,
      timeSec: 0,
      hints: [],
    },
  });

  const wsRef = useRef<WebSocket | null>(null);
  const isEngineMovingRef = useRef(false);

  // Sync WebSocket
  useEffect(() => {
    // Fetch available engines
    fetch('/api/engines')
      .then((res) => res.json())
      .then((data) => {
        if (data.engines) {
          setAvailableEngines(data.engines);
          // Prefer edax if available, else builtin
          const edaxAvailable = data.engines.find((e: any) => e.id === 'edax' && e.available);
          const initialId = edaxAvailable ? 'edax' : 'builtin';
          setCurrentEngineId(initialId);
          setBlackBotId(initialId);
        }
      })
      .catch((err) => console.error('Failed to fetch engines:', err));

    fetch('/api/git-info')
      .then((res) => res.json())
      .then((data) => setGitInfo(data))
      .catch((err) => console.error(err));

    fetch('/api/experiments')
      .then((res) => res.json())
      .then((data) => {
        if (data.experiments) setExperiments(data.experiments);
        if (data.active) setActiveExperiment(data.active);
      })
      .catch((err) => console.error(err));

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    const socket = new WebSocket(wsUrl);
    wsRef.current = socket;

    socket.onopen = () => {
      setRawLogs((prev) => [...prev, '[WS] Connected to NBoard bridge']);
      // Immediately initialize depths for both engines
      socket.send(JSON.stringify({ type: 'set_depth', engineId: blackBotId, depth: blackBotDepth }));
      socket.send(JSON.stringify({ type: 'set_depth', engineId: whiteBotId, depth: whiteBotDepth }));
      // Send initial game state to all engines
      socket.send(JSON.stringify({ type: 'set_game', ggf: toGGF(gameState) }));
    };

    socket.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);

        if (msg.type === 'experiments_cleared') {
          setExperiments([]);
          setActiveExperiment(null);
          return;
        }

        if (msg.type === 'experiment_updated') {
          setActiveExperiment(msg.experiment);
          setExperiments((prev) => {
            const idx = prev.findIndex((e) => e.id === msg.experiment.id);
            if (idx >= 0) {
              const updated = [...prev];
              updated[idx] = msg.experiment;
              return updated;
            } else {
              return [msg.experiment, ...prev];
            }
          });
          return;
        }

        const engId = msg.engineId || currentEngineId;
        setRawLogs((prev) => [
          ...prev,
          `<< [${engId}] ${msg.type} ${msg.move || msg.nodes !== undefined ? msg.nodes : ''}`,
        ]);

        switch (msg.type) {
          case 'engine_connected':
            setEngineTelemetry((prev) => ({
              ...prev,
              [engId]: {
                ...(prev[engId] || { hints: [] }),
                connected: true,
                name: msg.name || prev[engId]?.name || engId,
                state: 'waiting',
                statusText: 'Engine ready',
                depth: msg.config?.depth ?? prev[engId]?.depth,
              },
            }));
            break;

          case 'engine_name':
            setEngineTelemetry((prev) => ({
              ...prev,
              [engId]: {
                ...(prev[engId] || { hints: [] }),
                name: msg.engineName || prev[engId]?.name || engId,
              },
            }));
            break;

          case 'engine_status':
            setEngineTelemetry((prev) => ({
              ...prev,
              [engId]: {
                ...(prev[engId] || { hints: [] }),
                statusText: msg.statusText,
                state: msg.statusText.includes('thinking')
                  ? 'thinking'
                  : msg.statusText.includes('learning')
                  ? 'learning'
                  : 'waiting',
              },
            }));
            break;

          case 'engine_nodestats':
            setEngineTelemetry((prev) => ({
              ...prev,
              [engId]: {
                ...(prev[engId] || { hints: [] }),
                nodes: msg.nodes,
                timeSec: msg.time,
                nps: msg.nps,
              },
            }));
            break;

          case 'engine_hint':
            setEngineTelemetry((prev) => {
              const currentEng = prev[engId] || { hints: [] };
              const existing = (currentEng.hints || []).filter((h) => h.move !== msg.move);
              const updatedHints = [
                ...existing,
                {
                  move: msg.move,
                  score: msg.score,
                  depth: msg.depth,
                  nGames: msg.nGames,
                  isBook: msg.isBook,
                  pv: msg.pv,
                },
              ];
              updatedHints.sort((a, b) => b.score - a.score);
              return {
                ...prev,
                [engId]: {
                  ...currentEng,
                  hints: updatedHints,
                  bestMove: updatedHints[0]?.move,
                  bestScore: updatedHints[0]?.score,
                },
              };
            });
            break;

          case 'engine_move': {
            isEngineMovingRef.current = false;
            setEngineTelemetry((prev) => ({
              ...prev,
              [engId]: {
                ...(prev[engId] || { hints: [] }),
                state: 'waiting',
                lastMove: msg.move,
                lastScore: msg.score,
                timeSec: msg.time !== undefined ? msg.time : prev[engId]?.timeSec,
              },
            }));
            if (msg.move) {
              const lower = msg.move.toLowerCase();
              if (lower === 'pass' || lower === 'pa' || lower === '--') {
                setGameState((current) => makePass(current));
              } else {
                const coord = algebraicToCoord(msg.move);
                if (coord) {
                  setGameState((current) => {
                    const nextState = makeMove(current, coord.row, coord.col);
                    return nextState || current;
                  });
                }
              }
            }
            break;
          }

          case 'engine_error':
            isEngineMovingRef.current = false;
            setEngineTelemetry((prev) => ({
              ...prev,
              [engId]: {
                ...(prev[engId] || { hints: [] }),
                state: 'error',
                statusText: `Error: ${msg.error}`,
              },
            }));
            break;
        }
      } catch (err) {
        console.error('Error parsing WS message:', err);
      }
    };

    socket.onclose = () => {
      setEngineTelemetry((prev) => {
        const next: Record<string, EngineStatus> = {};
        for (const [k, v] of Object.entries(prev)) {
          next[k] = { ...v, connected: false, state: 'error', statusText: 'Disconnected' };
        }
        return next;
      });
    };

    return () => {
      socket.close();
    };
  }, []);

  // Update engine on position change
  const syncPositionToEngine = useCallback(
    (state: GameState) => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        const ggf = toGGF(state);
        wsRef.current.send(JSON.stringify({ type: 'set_game', ggf }));
        setRawLogs((prev) => [...prev, `>> set game ${ggf}`]);

        // Clear previous hints for new position
        setEngineTelemetry((prev) => ({
          ...prev,
          [currentEngineId]: { ...(prev[currentEngineId] || { hints: [] }), hints: [] },
        }));

        // If in analysis mode, request hints from active engine
        if (state.mode === 'analysis') {
          wsRef.current.send(
            JSON.stringify({ type: 'request_hints', engineId: currentEngineId, count: 5 })
          );
          setRawLogs((prev) => [...prev, `>> [${currentEngineId}] hint 5`]);
        }
      }
    },
    [currentEngineId]
  );

  useEffect(() => {
    syncPositionToEngine(gameState);
  }, [gameState.currentMoveIndex, gameState.mode, syncPositionToEngine]);

  // Handle Turn logic for Engine
  useEffect(() => {
    if (gameState.isGameOver) return;
    if (Object.keys(gameState.legalMoves).length === 0) return;

    if (gameState.mode === 'human_vs_engine') {
      const isEngineTurn = gameState.currentPlayer !== gameState.userColor;
      if (isEngineTurn && !isEngineMovingRef.current) {
        isEngineMovingRef.current = true;
        let hasFired = false;
        const timer = setTimeout(() => {
          hasFired = true;
          if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(
              JSON.stringify({
                type: 'request_move',
                engineId: currentEngineId,
              })
            );
            setRawLogs((prev) => [...prev, `>> [${currentEngineId}] go`]);
          }
        }, 300);
        return () => {
          clearTimeout(timer);
          if (!hasFired) {
            isEngineMovingRef.current = false;
          }
        };
      }
    } else if (gameState.mode === 'engine_vs_engine' && isBotMatchRunning) {
      if (!isEngineMovingRef.current) {
        isEngineMovingRef.current = true;
        const activeBotId = gameState.currentPlayer === 1 ? blackBotId : whiteBotId;
        const activeDepth = gameState.currentPlayer === 1 ? blackBotDepth : whiteBotDepth;

        // Show live "thinking" state immediately on active bot card
        setEngineTelemetry((prev) => ({
          ...prev,
          [activeBotId]: {
            ...(prev[activeBotId] || { hints: [] }),
            state: 'thinking',
            statusText: 'Thinking...',
          },
        }));

        let hasFired = false;
        const timer = setTimeout(() => {
          hasFired = true;
          if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            // Ensure depth is set
            wsRef.current.send(
              JSON.stringify({
                type: 'set_depth',
                engineId: activeBotId,
                depth: activeDepth,
              })
            );
            wsRef.current.send(
              JSON.stringify({
                type: 'request_move',
                engineId: activeBotId,
              })
            );
            setRawLogs((prev) => [...prev, `>> [${activeBotId} (d=${activeDepth})] go`]);
          }
        }, botMoveDelay);
        return () => {
          clearTimeout(timer);
          if (!hasFired) {
            isEngineMovingRef.current = false;
          }
        };
      }
    }
  }, [
    gameState.currentPlayer,
    gameState.currentMoveIndex,
    gameState.legalMoves,
    gameState.mode,
    gameState.userColor,
    gameState.isGameOver,
    isBotMatchRunning,
    blackBotId,
    whiteBotId,
    blackBotDepth,
    whiteBotDepth,
    botMoveDelay,
    currentEngineId,
  ]);

  // When game ends during bot match, stop running
  useEffect(() => {
    if (gameState.isGameOver && isBotMatchRunning) {
      setIsBotMatchRunning(false);
      isEngineMovingRef.current = false;
    }
  }, [gameState.isGameOver, isBotMatchRunning]);

  // Automatically pass turn when current player has no moves but opponent does
  useEffect(() => {
    if (!gameState.isGameOver && Object.keys(gameState.legalMoves).length === 0) {
      const opp = -gameState.currentPlayer as Player;
      const oppMoves = getLegalMoves(gameState.board, opp);
      if (Object.keys(oppMoves).length > 0) {
        const timer = setTimeout(() => {
          setGameState((prev) => makePass(prev));
        }, 400);
        return () => clearTimeout(timer);
      }
    }
  }, [gameState.legalMoves, gameState.isGameOver, gameState.currentPlayer, gameState.board]);

  const handleSquareClick = (row: number, col: number) => {
    if (gameState.isGameOver) return;

    // Check if human can move
    if (
      gameState.mode === 'human_vs_engine' &&
      gameState.currentPlayer !== gameState.userColor
    ) {
      return;
    }

    if (gameState.mode === 'engine_vs_engine') return;

    const nextState = makeMove(gameState, row, col);
    if (nextState) {
      setGameState(nextState);
    }
  };

  const handleNavigate = (idx: number) => {
    setGameState((prev) => replayToMove(prev, idx));
  };

  const handleNewGame = () => {
    const fresh = createInitialGameState();
    fresh.mode = gameState.mode;
    fresh.userColor = gameState.userColor;
    fresh.engineDepth = gameState.engineDepth;
    setGameState(fresh);
    setEngineTelemetry((prev) => ({
      ...prev,
      [currentEngineId]: { ...(prev[currentEngineId] || { hints: [] }), hints: [] },
    }));
    isEngineMovingRef.current = false;
  };

  const handleSwitchEngine = (engineId: string) => {
    const selected = availableEngines.find((e) => e.id === engineId);
    if (!selected) return;
    setCurrentEngineId(engineId);
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'switch_engine', config: selected }));
      setRawLogs((prev) => [...prev, `>> switch engine to ${selected.name}`]);
    }
  };

  const handleSelectBlackDepth = (depth: number) => {
    setBlackBotDepth(depth);
    setEngineTelemetry((prev) => ({
      ...prev,
      [blackBotId]: { ...(prev[blackBotId] || { hints: [] }), depth },
    }));
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'set_depth', engineId: blackBotId, depth }));
      setRawLogs((prev) => [...prev, `>> [${blackBotId}] depth ${depth}`]);
    }
  };

  const handleSelectWhiteDepth = (depth: number) => {
    setWhiteBotDepth(depth);
    setEngineTelemetry((prev) => ({
      ...prev,
      [whiteBotId]: { ...(prev[whiteBotId] || { hints: [] }), depth },
    }));
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'set_depth', engineId: whiteBotId, depth }));
      setRawLogs((prev) => [...prev, `>> [${whiteBotId}] depth ${depth}`]);
    }
  };

  const handleSelectBlackEngine = (id: string) => {
    setBlackBotId(id);
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'set_depth', engineId: id, depth: blackBotDepth }));
      setRawLogs((prev) => [...prev, `>> [${id}] depth ${blackBotDepth}`]);
    }
  };

  const handleSelectWhiteEngine = (id: string) => {
    setWhiteBotId(id);
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'set_depth', engineId: id, depth: whiteBotDepth }));
      setRawLogs((prev) => [...prev, `>> [${id}] depth ${whiteBotDepth}`]);
    }
  };

  const handleRequestHint = () => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({ type: 'request_hints', engineId: currentEngineId, count: 5 })
      );
      setRawLogs((prev) => [...prev, `>> [${currentEngineId}] hint 5`]);
    }
  };

  const handleRequestEngineMove = () => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      const targetEngine =
        gameState.mode === 'engine_vs_engine'
          ? gameState.currentPlayer === 1
            ? blackBotId
            : whiteBotId
          : currentEngineId;

      wsRef.current.send(JSON.stringify({ type: 'request_move', engineId: targetEngine }));
      setRawLogs((prev) => [...prev, `>> [${targetEngine}] go`]);
    }
  };

  const handleStartExperiment = async (params: any) => {
    try {
      const res = await fetch('/api/experiments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });
      const exp = await res.json();
      setActiveExperiment(exp);
      setExperiments((prev) => [exp, ...prev]);
    } catch (err) {
      console.error('Failed to start experiment:', err);
    }
  };

  const handleStopExperiment = async () => {
    try {
      await fetch('/api/experiments/stop', { method: 'POST' });
      setActiveExperiment((prev: any) => (prev ? { ...prev, status: 'stopped' } : null));
    } catch (err) {
      console.error('Failed to stop experiment:', err);
    }
  };

  const handleClearExperiments = async () => {
    try {
      await fetch('/api/experiments', { method: 'DELETE' });
      setExperiments([]);
      setActiveExperiment(null);
    } catch (err) {
      console.error('Failed to clear experiments:', err);
    }
  };

  const handleRunBenchmark = async (engineId: string, depth: number) => {
    const res = await fetch('/api/benchmark', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ engineId, depth }),
    });
    return await res.json();
  };

  const handleReplayGame = (ggf: string) => {
    const moveRegex = /;?([BW])\[([a-h][1-8]|pass|pa|--)\]/gi;
    let match;
    let state = createInitialGameState();
    while ((match = moveRegex.exec(ggf)) !== null) {
      const alg = match[2].toLowerCase();
      if (alg === 'pass' || alg === 'pa' || alg === '--') {
        state = makePass(state);
      } else {
        const coord = algebraicToCoord(alg);
        if (coord) {
          const next = makeMove(state, coord.row, coord.col);
          if (next) state = next;
        }
      }
    }
    setGameState(state);
    setActiveTab('arena');
  };

  const handleSetDepth = (depth: number) => {
    setGameState((prev) => ({ ...prev, engineDepth: depth }));
    setEngineTelemetry((prev) => ({
      ...prev,
      [currentEngineId]: { ...(prev[currentEngineId] || { hints: [] }), depth },
    }));
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'set_depth', engineId: currentEngineId, depth }));
      setRawLogs((prev) => [...prev, `>> [${currentEngineId}] depth ${depth}`]);
    }
  };

  // Keyboard navigation shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        setGameState((prev) => replayToMove(prev, Math.max(0, prev.currentMoveIndex - 1)));
      } else if (e.key === 'ArrowRight') {
        setGameState((prev) =>
          replayToMove(prev, Math.min(prev.moveHistory.length, prev.currentMoveIndex + 1))
        );
      } else if (e.key === 'f' || e.key === 'F') {
        setFlipped((f) => !f);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const activeEngineStatus = engineTelemetry[currentEngineId] || {
    name: currentEngineId,
    connected: false,
    state: 'waiting',
    statusText: 'Connecting...',
    hints: [],
  };

  const bestHint = activeEngineStatus.hints[0];

  // Eval score from Black's perspective
  const blackEvalScore =
    bestHint !== undefined
      ? gameState.currentPlayer === 1
        ? bestHint.score
        : -bestHint.score
      : null;

  // Determine player card roles based on mode and board flip
  const topPlayer: Player = flipped ? 1 : -1;
  const bottomPlayer: Player = flipped ? -1 : 1;

  const getEngineNameById = (id: string) => {
    const found = availableEngines.find((e) => e.id === id);
    return found ? found.name : id;
  };

  const getPlayerName = (color: Player) => {
    if (gameState.mode === 'human_vs_engine') {
      return color === gameState.userColor ? 'Player' : getEngineNameById(currentEngineId);
    }
    if (gameState.mode === 'engine_vs_engine') {
      return color === 1
        ? `${getEngineNameById(blackBotId)} (d=${blackBotDepth})`
        : `${getEngineNameById(whiteBotId)} (d=${whiteBotDepth})`;
    }
    return color === 1 ? 'Black' : 'White';
  };

  const isPlayerEngine = (color: Player) => {
    if (gameState.mode === 'human_vs_engine') {
      return color !== gameState.userColor;
    }
    if (gameState.mode === 'engine_vs_engine') return true;
    return false;
  };

  const isBotMatch = gameState.mode === 'engine_vs_engine';
  const activeBotDepth = gameState.currentPlayer === 1 ? blackBotDepth : whiteBotDepth;
  const activeDisplayDepth = isBotMatch
    ? activeBotDepth
    : (activeEngineStatus.depth ?? gameState.engineDepth);

  return (
    <div className="flex flex-col min-h-screen bg-[#161512] text-[#d0d0d0]">
      {/* Lichess Style Header with Testing Dashboard Switcher */}
      <Header
        activeTab={activeTab}
        onTabChange={setActiveTab}
        mode={gameState.mode}
        onModeChange={(m) => {
          setGameState((prev) => ({ ...prev, mode: m }));
          if (m !== 'engine_vs_engine') setIsBotMatchRunning(false);
        }}
        userColor={gameState.userColor}
        onUserColorChange={(c) => {
          setGameState((prev) => ({ ...prev, userColor: c }));
          setFlipped(c === -1);
        }}
        isGameOver={gameState.isGameOver}
        winner={gameState.winner}
        blackCount={gameState.blackCount}
        whiteCount={gameState.whiteCount}
        gitCommit={gitInfo?.commit}
      />

      {/* Main Area: Defaults to Fishtest Testing Dashboard */}
      <main className="flex-1 max-w-7xl mx-auto w-full p-4 flex flex-col items-center gap-4">
        {activeTab === 'dashboard' ? (
          <DashboardView
            availableEngines={availableEngines}
            experiments={experiments}
            activeExperiment={activeExperiment}
            gitInfo={gitInfo}
            onStartExperiment={handleStartExperiment}
            onStopExperiment={handleStopExperiment}
            onClearExperiments={handleClearExperiments}
            onReplayGame={handleReplayGame}
            onRunBenchmark={handleRunBenchmark}
          />
        ) : (
          <>
            {/* Dual Bot Match Control Bar (shown only in Bot Match mode) */}
            {gameState.mode === 'engine_vs_engine' && (
              <div className="w-full max-w-5xl">
                <BotMatchControls
                  availableEngines={availableEngines}
                  blackEngineId={blackBotId}
                  whiteEngineId={whiteBotId}
                  blackDepth={blackBotDepth}
                  whiteDepth={whiteBotDepth}
                  onSelectBlackEngine={handleSelectBlackEngine}
                  onSelectWhiteEngine={handleSelectWhiteEngine}
                  onSelectBlackDepth={handleSelectBlackDepth}
                  onSelectWhiteDepth={handleSelectWhiteDepth}
                  isRunning={isBotMatchRunning}
                  onToggleRunning={() => {
                    setIsBotMatchRunning((prev) => {
                      if (prev) isEngineMovingRef.current = false;
                      return !prev;
                    });
                  }}
                  onStepMove={() => {
                    isEngineMovingRef.current = false;
                    handleRequestEngineMove();
                  }}
                  onResetMatch={handleNewGame}
                  moveDelay={botMoveDelay}
                  onMoveDelayChange={setBotMoveDelay}
                />
              </div>
            )}

            <div className="flex flex-col lg:flex-row items-center lg:items-start justify-center gap-6">
              {/* Board & Eval Bar Container */}
              <div className="flex items-center space-x-3">
                {/* Vertical Lichess Eval Bar */}
                <EvalBar score={blackEvalScore} flipped={flipped} />

                {/* Board Column with Top and Bottom Player Strips */}
                <div className="flex flex-col space-y-2">
                  {/* Top Player Card */}
                  <PlayerCard
                    player={topPlayer}
                    name={getPlayerName(topPlayer)}
                    count={topPlayer === 1 ? gameState.blackCount : gameState.whiteCount}
                    isTurn={gameState.currentPlayer === topPlayer && !gameState.isGameOver}
                    isEngine={isPlayerEngine(topPlayer)}
                  />

                  {/* Interactive Othello Board */}
                  <Board
                    gameState={gameState}
                    onSquareClick={handleSquareClick}
                    bestHint={bestHint}
                    flipped={flipped}
                  />

                  {/* Bottom Player Card */}
                  <PlayerCard
                    player={bottomPlayer}
                    name={getPlayerName(bottomPlayer)}
                    count={bottomPlayer === 1 ? gameState.blackCount : gameState.whiteCount}
                    isTurn={gameState.currentPlayer === bottomPlayer && !gameState.isGameOver}
                    isEngine={isPlayerEngine(bottomPlayer)}
                  />
                </div>
              </div>

              {/* Right Side Panels: Move History & Engine Telemetry */}
              <div className="flex flex-col w-[360px] h-[640px] space-y-3">
                {/* Move History Sheet */}
                <div className="h-[280px]">
                  <MoveHistory
                    gameState={gameState}
                    onNavigate={handleNavigate}
                    onNewGame={handleNewGame}
                    onFlipBoard={() => setFlipped((f) => !f)}
                  />
                </div>

                {/* Engine Analysis & Protocol Panel */}
                <div className="flex-1">
                  <EnginePanel
                    engineStatus={activeEngineStatus}
                    availableEngines={availableEngines}
                    currentEngineId={currentEngineId}
                    onSwitchEngine={handleSwitchEngine}
                    onRequestHint={handleRequestHint}
                    onRequestEngineMove={handleRequestEngineMove}
                    onSetDepth={handleSetDepth}
                    currentDepth={activeDisplayDepth}
                    rawLogs={rawLogs}
                    isBotMatch={isBotMatch}
                    blackBotName={getEngineNameById(blackBotId)}
                    whiteBotName={getEngineNameById(whiteBotId)}
                    blackBotTelemetry={{
                      ...(engineTelemetry[blackBotId] || {
                        name: blackBotId,
                        connected: true,
                        state: 'waiting',
                        statusText: 'Ready',
                        hints: [],
                      }),
                      depth: blackBotDepth,
                    }}
                    whiteBotTelemetry={{
                      ...(engineTelemetry[whiteBotId] || {
                        name: whiteBotId,
                        connected: true,
                        state: 'waiting',
                        statusText: 'Ready',
                        hints: [],
                      }),
                      depth: whiteBotDepth,
                    }}
                    currentTurn={gameState.currentPlayer}
                    isBotMatchRunning={isBotMatchRunning}
                  />
                </div>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
};
