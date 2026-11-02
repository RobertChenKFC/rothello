import { spawn } from 'child_process';
import path from 'path';

async function testIntegration() {
  console.log('Running engine integration test...');
  const enginePath = path.resolve(__dirname, '../engine/target/release/rothello');
  
  const proc = spawn(enginePath, ['--nboard']);
  let receivedPong = false;
  let receivedMove = false;

  const timeout = setTimeout(() => {
    console.error('Integration test timed out!');
    proc.kill();
    process.exit(1);
  }, 10000);

  proc.stdout.on('data', (data) => {
    const text = data.toString('utf-8');
    const lines = text.split(/\r?\n/);
    for (const line of lines) {
      if (line.startsWith('pong 1')) {
        receivedPong = true;
      }
      if (line.startsWith('=== ')) {
        receivedMove = true;
        clearTimeout(timeout);
        proc.stdin.write('quit\n');
        proc.kill();
        if (receivedPong && receivedMove) {
          console.log('Integration test passed successfully!');
          process.exit(0);
        }
      }
    }
  });

  proc.stderr.on('data', (data) => {
    console.error('[STDERR]:', data.toString('utf-8'));
  });

  proc.on('error', (err) => {
    console.error('Failed to spawn engine:', err);
    process.exit(1);
  });

  proc.stdin.write('nboard 1\n');
  proc.stdin.write('ping 1\n');
  proc.stdin.write('depth 4\n');
  proc.stdin.write('game (;GM[othello]B[f5]W[d6];)\n');
  proc.stdin.write('go\n');
}

testIntegration();
