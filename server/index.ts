import express from 'express';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { NBoardEngineBridge, EngineInfo } from './nboard-bridge';

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
    id: 'rothello-rust',
    name: 'Rothello Engine (Rust)',
    type: 'external',
    path: path.resolve(__dirname, '../engine/target/release/rothello'),
    args: ['--nboard'],
    depth: 14,
  },
  {
    id: 'edax',
    name: 'Edax 4.4',
    type: 'external',
    path: 'edax',
    args: ['-nboard'],
    depth: 18,
  },
];

let bridge = new NBoardEngineBridge(DEFAULT_ENGINES[0]);

function broadcast(msg: object) {
  const json = JSON.stringify(msg);
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(json);
    }
  });
}

function attachBridgeEvents(b: NBoardEngineBridge) {
  b.on('connected', (info) => broadcast({ type: 'engine_connected', ...info }));
  b.on('name', (data) => broadcast({ type: 'engine_name', ...data }));
  b.on('status', (data) => broadcast({ type: 'engine_status', ...data }));
  b.on('move', (data) => broadcast({ type: 'engine_move', ...data }));
  b.on('hint', (data) => broadcast({ type: 'engine_hint', ...data }));
  b.on('nodestats', (data) => broadcast({ type: 'engine_nodestats', ...data }));
  b.on('pong', (data) => broadcast({ type: 'engine_pong', ...data }));
  b.on('error', (err) => broadcast({ type: 'engine_error', error: err }));
  b.on('raw', (line) => broadcast({ type: 'engine_raw', line }));
}

attachBridgeEvents(bridge);

wss.on('connection', (ws: WebSocket) => {
  // Send current engine config on connect
  ws.send(
    JSON.stringify({
      type: 'engine_connected',
      name: bridge.getActiveConfig().name,
      config: bridge.getActiveConfig(),
    })
  );

  ws.on('message', (message: string) => {
    try {
      const data = JSON.parse(message.toString());
      switch (data.type) {
        case 'set_game':
          bridge.setGame(data.ggf);
          break;
        case 'send_move':
          bridge.sendMove(data.algebraic);
          break;
        case 'request_move':
          bridge.requestMove();
          break;
        case 'request_hints':
          bridge.requestHints(data.count || 5);
          break;
        case 'set_depth':
          bridge.setDepth(data.depth);
          break;
        case 'ping':
          bridge.ping();
          break;
        case 'raw_command':
          bridge.sendCommand(data.command);
          break;
        case 'switch_engine': {
          const config = data.config as EngineInfo;
          bridge.switchEngine(config);
          attachBridgeEvents(bridge);
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
      e.type === 'builtin' || (e.path ? fs.existsSync(e.path) || e.path === 'edax' : false);
    return {
      ...e,
      available: isAvailable,
    };
  });
  res.json({ engines, active: bridge.getActiveConfig().id });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Rothello NBoard Protocol Server running on port ${PORT}`);
});
