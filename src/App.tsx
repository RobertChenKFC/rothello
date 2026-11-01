import React, { useState, useEffect, useRef, useCallback } from 'react';
import { GameState, Player, EngineStatus } from './lib/types';
import {
  createInitialGameState,
  makeMove,
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

export const App: React.FC = () => {
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
  const [blackBotDepth, setBlackBotDepth] = useState(14);
  const [whiteBotDepth, setWhiteBotDepth] = useState(8);
  const [isBotMatchRunning, setIsBotMatchRunning] = useState(false);
  const [botMoveDelay, setBotMoveDelay] = useState(350);

  const [engineStatus, setEngineStatus] = useState<EngineStatus>({
    name: 'Edax 4.4 (Native)',
    connected: false,
    state: 'idle',
    statusText: 'Connecting to protocol server...',
    hints: [],
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

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    const socket = new WebSocket(wsUrl);
    wsRef.current = socket;

    socket.onopen = () => {
      setEngineStatus((prev) => ({
        ...prev,
        connected: true,
        state: 'waiting',
        statusText: 'Connected to NBoard bridge',
      }));
      setRawLogs((prev) => [...prev, '[WS] Connected to NBoard bridge']);
      // Send initial game state to all engines
      socket.send(JSON.stringify({ type: 'set_game', ggf: toGGF(gameState) }));
    };

    socket.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        setRawLogs((prev) => [...prev, `<< [${msg.engineId || 'srv'}] ${msg.type} ${msg.move || msg.nodes || ''}`]);

        switch (msg.type) {
          case 'engine_connected':
            setEngineStatus((prev) => ({
              ...prev,
              connected: true,
              name: msg.name,
              state: 'waiting',
              statusText: 'Engine ready',
            }));
            break;

          case 'engine_name':
            if (!msg.engineId || msg.engineId === currentEngineId) {
              setEngineStatus((prev) => ({ ...prev, name: msg.engineName || prev.name }));
            }
            break;

          case 'engine_status':
            setEngineStatus((prev) => ({
              ...prev,
              statusText: msg.statusText,
              state: msg.statusText.includes('thinking')
                ? 'thinking'
                : msg.statusText.includes('learning')
                ? 'learning'
                : 'waiting',
            }));
            break;

          case 'engine_nodestats':
            setEngineStatus((prev) => ({
              ...prev,
              nodes: msg.nodes,
              timeSec: msg.time,
              nps: msg.nps,
            }));
            break;

          case 'engine_hint':
            setEngineStatus((prev) => {
              const existing = prev.hints.filter((h) => h.move !== msg.move);
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
                hints: updatedHints,
                bestMove: updatedHints[0]?.move,
                bestScore: updatedHints[0]?.score,
              };
            });
            break;

          case 'engine_move': {
            isEngineMovingRef.current = false;
            setEngineStatus((prev) => ({ ...prev, state: 'waiting' }));
            if (msg.move && msg.move !== 'pass' && msg.move !== '--') {
              const coord = algebraicToCoord(msg.move);
              if (coord) {
                setGameState((current) => {
                  const nextState = makeMove(current, coord.row, coord.col);
                  return nextState || current;
                });
              }
            }
            break;
          }

          case 'engine_error':
            setEngineStatus((prev) => ({
              ...prev,
              state: 'error',
              statusText: `Error: ${msg.error}`,
            }));
            break;
        }
      } catch (err) {
        console.error('Error parsing WS message:', err);
      }
    };

    socket.onclose = () => {
      setEngineStatus((prev) => ({
        ...prev,
        connected: false,
        state: 'error',
        statusText: 'Disconnected',
      }));
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
        setEngineStatus((prev) => ({ ...prev, hints: [] }));

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

    if (gameState.mode === 'human_vs_engine') {
      const isEngineTurn = gameState.currentPlayer !== gameState.userColor;
      if (isEngineTurn && !isEngineMovingRef.current) {
        isEngineMovingRef.current = true;
        const timer = setTimeout(() => {
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
        return () => clearTimeout(timer);
      }
    } else if (gameState.mode === 'engine_vs_engine' && isBotMatchRunning) {
      if (!isEngineMovingRef.current) {
        isEngineMovingRef.current = true;
        const activeBotId = gameState.currentPlayer === 1 ? blackBotId : whiteBotId;
        const activeDepth = gameState.currentPlayer === 1 ? blackBotDepth : whiteBotDepth;

        const timer = setTimeout(() => {
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
        return () => clearTimeout(timer);
      }
    }
  }, [
    gameState.currentPlayer,
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
    setEngineStatus((prev) => ({ ...prev, hints: [] }));
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

  const handleSetDepth = (depth: number) => {
    setGameState((prev) => ({ ...prev, engineDepth: depth }));
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

  const bestHint = engineStatus.hints[0];

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

  return (
    <div className="flex flex-col min-h-screen bg-[#161512] text-[#d0d0d0]">
      {/* Lichess Style Header */}
      <Header
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
      />

      {/* Main Playing Area */}
      <main className="flex-1 max-w-7xl mx-auto w-full p-4 flex flex-col items-center gap-4">
        {/* Dual Bot Match Control Bar (shown only in Bot Match mode) */}
        {gameState.mode === 'engine_vs_engine' && (
          <div className="w-full max-w-4xl">
            <BotMatchControls
              availableEngines={availableEngines}
              blackEngineId={blackBotId}
              whiteEngineId={whiteBotId}
              blackDepth={blackBotDepth}
              whiteDepth={whiteBotDepth}
              onSelectBlackEngine={setBlackBotId}
              onSelectWhiteEngine={setWhiteBotId}
              onSelectBlackDepth={setBlackBotDepth}
              onSelectWhiteDepth={setWhiteBotDepth}
              isRunning={isBotMatchRunning}
              onToggleRunning={() => setIsBotMatchRunning(!isBotMatchRunning)}
              onStepMove={handleRequestEngineMove}
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
                engineStatus={engineStatus}
                availableEngines={availableEngines}
                currentEngineId={currentEngineId}
                onSwitchEngine={handleSwitchEngine}
                onRequestHint={handleRequestHint}
                onRequestEngineMove={handleRequestEngineMove}
                onSetDepth={handleSetDepth}
                currentDepth={gameState.engineDepth}
                rawLogs={rawLogs}
              />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};
