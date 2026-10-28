// Starts the game server (port 8787) and the Vite client (port 5173) together.
import { spawn } from 'node:child_process';

const procs = [
  ['server', ['run', 'dev', '-w', '@pulse/server']],
  ['client', ['run', 'dev', '-w', '@pulse/client']],
].map(([name, args]) => {
  const p = spawn(process.platform === 'win32' ? 'npm.cmd' : 'npm', args, { stdio: ['ignore', 'pipe', 'pipe'], env: process.env });
  const tag = name === 'server' ? '[server]' : '[client]';
  p.stdout.on('data', (d) => process.stdout.write(d.toString().replace(/^/gm, `${tag} `)));
  p.stderr.on('data', (d) => process.stderr.write(d.toString().replace(/^/gm, `${tag} `)));
  p.on('exit', (code) => {
    console.log(`${tag} exited with code ${code}`);
    shutdown();
  });
  return p;
});

function shutdown() {
  for (const p of procs) if (!p.killed) p.kill('SIGTERM');
  setTimeout(() => process.exit(0), 300);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
