import express from 'express';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { NBoardEngineBridge, EngineInfo } from './nboard-bridge';
import { ExperimentManager } from './runner';

const app = express();
app.use(cors());
app.use(express.json());

// Serve static frontend build if available
const distPath = path.resolve(__dirname, '../dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
}

const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

const DEFAULT_ENGINES: EngineInfo[] = [
  {
    id: 'builtin',
    name: 'Rothello Reference Engine',
    type: 'builtin',
    depth: 8,
  },
  {
    id: 'edax',
    name: 'Edax 4.4 (Native)',
    type: 'external',
    path: path.resolve(__dirname, '../tools/edax/bin/lEdax-native'),
    cwd: path.resolve(__dirname, '../tools/edax/bin'),
    args: ['-nboard', '-book-usage', 'off'],
    depth: 18,
  },
  {
    id: 'rothello-rust',
    name: 'Rothello Engine (Rust)',
    type: 'external',
    path: path.resolve(__dirname, '../engine/target/release/rothello'),
    args: ['--nboard'],
    depth: 14,
  },
  {
    id: 'rothello-baseline',
    name: 'Rothello Baseline (Master)',
    type: 'external',
    path: path.resolve(__dirname, '../engine/target/release/rothello-baseline'),
    args: ['--nboard'],
    depth: 14,
  },
];

const enginePool = new Map<string, NBoardEngineBridge>();
let primaryEngineId = 'edax';
let currentGgf = '(;GM[othello];)';

function broadcast(msg: object) {
  const json = JSON.stringify(msg);
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(json);
    }
  });
}

function attachBridgeEvents(b: NBoardEngineBridge, engineId: string) {
  b.on('connected', (info) => broadcast({ type: 'engine_connected', engineId, ...info }));
  b.on('name', (data) => broadcast({ type: 'engine_name', engineId, ...data }));
  b.on('status', (data) => broadcast({ type: 'engine_status', engineId, ...data }));
  b.on('move', (data) => broadcast({ type: 'engine_move', engineId, ...data }));
  b.on('hint', (data) => broadcast({ type: 'engine_hint', engineId, ...data }));
  b.on('nodestats', (data) => broadcast({ type: 'engine_nodestats', engineId, ...data }));
  b.on('pong', (data) => broadcast({ type: 'engine_pong', engineId, ...data }));
  b.on('error', (err) => broadcast({ type: 'engine_error', engineId, error: err }));
  b.on('raw', (line) => broadcast({ type: 'engine_raw', engineId, line }));
}

function getEngine(engineId?: string): NBoardEngineBridge {
  const id = engineId || primaryEngineId;
  let b = enginePool.get(id);
  if (!b) {
    const config = DEFAULT_ENGINES.find((e) => e.id === id) || DEFAULT_ENGINES[0];
    b = new NBoardEngineBridge(config);
    attachBridgeEvents(b, id);
    b.setGame(currentGgf);
    enginePool.set(id, b);
  }
  return b;
}

// Pre-initialize engines
getEngine('builtin');
getEngine('edax');
getEngine('rothello-rust');

wss.on('connection', (ws: WebSocket) => {
  const activeEngine = getEngine(primaryEngineId);
  ws.send(
    JSON.stringify({
      type: 'engine_connected',
      engineId: primaryEngineId,
      name: activeEngine.getActiveConfig().name,
      config: activeEngine.getActiveConfig(),
    })
  );

  ws.on('message', (message: string) => {
    try {
      const data = JSON.parse(message.toString());
      const targetEngine = getEngine(data.engineId);

      switch (data.type) {
        case 'set_game':
          currentGgf = data.ggf;
          enginePool.forEach((eng) => eng.setGame(currentGgf));
          break;

        case 'send_move':
          enginePool.forEach((eng) => eng.sendMove(data.algebraic));
          break;

        case 'request_move':
          targetEngine.setGame(currentGgf);
          targetEngine.requestMove();
          break;

        case 'request_hints':
          targetEngine.setGame(currentGgf);
          targetEngine.requestHints(data.count || 5);
          break;

        case 'set_depth':
          targetEngine.setDepth(data.depth);
          break;

        case 'ping':
          targetEngine.ping();
          break;

        case 'raw_command':
          targetEngine.sendCommand(data.command);
          break;

        case 'switch_engine': {
          const config = data.config as EngineInfo;
          primaryEngineId = config.id;
          const eng = getEngine(config.id);
          eng.setGame(currentGgf);
          broadcast({
            type: 'engine_connected',
            engineId: config.id,
            name: eng.getActiveConfig().name,
            config: eng.getActiveConfig(),
          });
          break;
        }
      }
    } catch (err) {
      console.error('Error handling WebSocket message:', err);
    }
  });
});

app.get('/api/engines', (req, res) => {
  const engines = DEFAULT_ENGINES.map((e) => {
    const isAvailable =
      e.type === 'builtin' || (e.path ? fs.existsSync(e.path) : false);
    return {
      ...e,
      available: isAvailable,
    };
  });
  res.json({ engines, active: primaryEngineId });
});

const experimentManager = new ExperimentManager((msg) => broadcast(msg));

app.get('/api/git-info', (req, res) => {
  res.json(experimentManager.getGitInfo());
});

app.get('/api/experiments', (req, res) => {
  res.json({
    experiments: experimentManager.getExperiments(),
    active: experimentManager.getActiveExperiment(),
  });
});

app.post('/api/experiments', (req, res) => {
  try {
    const exp = experimentManager.startExperiment(req.body, getEngine);
    res.json(exp);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/experiments/stop', (req, res) => {
  experimentManager.stopCurrentRun();
  res.json({ status: 'stopped' });
});

app.delete('/api/experiments', (req, res) => {
  experimentManager.clearAllExperiments();
  res.json({ status: 'cleared' });
});

app.post('/api/benchmark', async (req, res) => {
  try {
    const engineId = req.body.engineId || 'rothello-rust';
    const durationSec = req.body.durationSec || 10;
    const report = await experimentManager.runBenchmark(engineId, durationSec, getEngine);
    res.json(report);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Rothello NBoard Protocol Server running on port ${PORT}`);
});
