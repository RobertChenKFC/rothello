import { spawn, ChildProcessWithoutNullStreams } from 'child_process';
import { BuiltinNBoardEngine } from './builtin-engine';
import { EventEmitter } from 'events';

export interface EngineInfo {
  id: string;
  name: string;
  type: 'builtin' | 'external';
  path?: string;
  cwd?: string;
  args?: string[];
  depth?: number;
}

export class NBoardEngineBridge extends EventEmitter {
  private engineProcess: ChildProcessWithoutNullStreams | null = null;
  private builtinEngine: BuiltinNBoardEngine | null = null;
  private currentPing: number = 0;
  private activeConfig: EngineInfo;
  private buffer: string = '';

  constructor(config: EngineInfo) {
    super();
    this.activeConfig = config;
    this.initEngine();
  }

  public getActiveConfig(): EngineInfo {
    return this.activeConfig;
  }

  public switchEngine(config: EngineInfo) {
    this.destroy();
    this.activeConfig = config;
    this.initEngine();
  }

  private initEngine() {
    if (this.activeConfig.type === 'builtin') {
      this.builtinEngine = new BuiltinNBoardEngine((line) => this.handleEngineLine(line));
      this.emit('connected', { name: this.activeConfig.name, type: 'builtin' });
      this.sendCommand('nboard 1');
      if (this.activeConfig.depth) {
        this.sendCommand(`depth ${this.activeConfig.depth}`);
      }
    } else if (this.activeConfig.path) {
      try {
        const args = this.activeConfig.args || ['-nboard'];
        this.engineProcess = spawn(this.activeConfig.path, args, {
          cwd: this.activeConfig.cwd,
        });

        this.engineProcess.stdout.on('data', (data: Buffer) => {
          this.buffer += data.toString('utf-8');
          const lines = this.buffer.split(/\r?\n/);
          this.buffer = lines.pop() || '';
          for (const line of lines) {
            this.handleEngineLine(line);
          }
        });

        this.engineProcess.stderr.on('data', (data: Buffer) => {
          console.error(`[Engine STDERR]: ${data.toString('utf-8')}`);
        });

        this.engineProcess.on('error', (err) => {
          console.error('[Engine Process Error]:', err);
          this.emit('error', err.message);
        });

        this.engineProcess.on('exit', (code) => {
          this.emit('exit', code);
        });

        this.emit('connected', { name: this.activeConfig.name, type: 'external' });
        this.sendCommand('nboard 1');
        if (this.activeConfig.depth) {
          this.sendCommand(`depth ${this.activeConfig.depth}`);
        }
      } catch (err: any) {
        console.error('Failed to spawn engine:', err);
        this.emit('error', err.message);
      }
    }
  }

  public sendCommand(cmd: string) {
    if (this.builtinEngine) {
      this.builtinEngine.handleCommand(cmd);
    } else if (this.engineProcess && this.engineProcess.stdin.writable) {
      this.engineProcess.stdin.write(cmd.trim() + '\n');
    }
  }

  public ping(): number {
    this.currentPing++;
    this.sendCommand(`ping ${this.currentPing}`);
    return this.currentPing;
  }

  public setGame(ggf: string) {
    this.sendCommand(`set game ${ggf}`);
  }

  public sendMove(algebraic: string) {
    this.sendCommand(`move ${algebraic}`);
  }

  public requestMove() {
    this.sendCommand('go');
  }

  public requestHints(nHighest: number = 5) {
    this.sendCommand(`hint ${nHighest}`);
  }

  public setDepth(depth: number) {
    this.sendCommand(`depth ${depth}`);
  }

  private handleEngineLine(rawLine: string) {
    const line = rawLine.trim();
    if (!line) return;

    // 1. Chosen move: === <move> [score] [time]
    if (line.startsWith('=== ')) {
      const parts = line.substring(4).trim().split(/\s+/);
      const move = parts[0];
      const score = parts[1] ? parseFloat(parts[1]) : undefined;
      const time = parts[2] ? parseFloat(parts[2]) : undefined;
      this.emit('move', { move, score, time, raw: line });
      return;
    }

    // 2. Pong response: pong <n>
    if (line.startsWith('pong ')) {
      const pongId = parseInt(line.substring(5).trim(), 10);
      this.emit('pong', { pongId, currentPing: this.currentPing });
      return;
    }

    // 3. Status update: status <text>
    if (line.startsWith('status')) {
      const statusText = line.substring(6).trim();
      this.emit('status', { statusText });
      return;
    }

    // 4. Node stats: nodestats <nodes> <time>
    if (line.startsWith('nodestats ')) {
      const parts = line.substring(10).trim().split(/\s+/);
      const nodes = parseInt(parts[0], 10) || 0;
      const time = parseFloat(parts[1]) || 0;
      const effectiveTime = time > 0.0005 ? time : (nodes > 0 ? 0.001 : 0);
      const nps = effectiveTime > 0 ? Math.round(nodes / effectiveTime) : 0;
      this.emit('nodestats', { nodes, time, nps });
      return;
    }

    // 5. Engine identity: set myname <name>
    if (line.startsWith('set myname ')) {
      const engineName = line.substring(11).trim();
      this.emit('name', { engineName });
      return;
    }

    // 6. Hint line: search <pv> <score> <nGames> <depth> OR book <pv> <score> <nGames> <level>
    if (line.startsWith('search ') || line.startsWith('book ')) {
      const isBook = line.startsWith('book ');
      const parts = line.split(/\s+/);
      // e.g. ["search", "f5D6c3D3", "-1", "0", "24"] or ["book", "d3", "-1", "0", "24"]
      const pv = parts[1] || '';
      const move = pv.length >= 2 ? pv.substring(0, 2).toLowerCase() : pv;
      const score = parseFloat(parts[2]) || 0;
      const nGames = parseInt(parts[3], 10) || 0;
      const depth = parseInt(parts[4], 10) || 0;

      this.emit('hint', {
        move,
        pv,
        score,
        nGames,
        depth,
        isBook,
      });
      return;
    }

    // Pass through unparsed line
    this.emit('raw', line);
  }

  public destroy() {
    if (this.engineProcess) {
      try {
        this.sendCommand('quit');
        this.engineProcess.kill();
      } catch (e) {
        // ignore
      }
      this.engineProcess = null;
    }
    this.builtinEngine = null;
  }
}
