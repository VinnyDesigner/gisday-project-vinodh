import { spawn } from 'node:child_process';

const isWin = process.platform === 'win32';
const npmCmd = isWin ? 'npm.cmd' : 'npm';

const serverProc = spawn(npmCmd, ['run', 'server'], {
  stdio: 'inherit',
  shell: isWin,
});

const viteProc = spawn(npmCmd, ['run', 'dev:client'], {
  stdio: 'inherit',
  shell: isWin,
});

function shutdown() {
  serverProc.kill();
  viteProc.kill();
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
