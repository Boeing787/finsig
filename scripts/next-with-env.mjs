import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const rootEnv = fileURLToPath(new URL('../.env.local', import.meta.url));
const nextCli = fileURLToPath(
  new URL('../apps/web/node_modules/next/dist/bin/next', import.meta.url),
);

if (existsSync(rootEnv)) process.loadEnvFile(rootEnv);

const child = spawn(process.execPath, [nextCli, ...process.argv.slice(2)], {
  stdio: 'inherit',
  env: process.env,
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => child.kill(signal));
}

child.on('error', (error) => {
  console.error(error);
  process.exitCode = 1;
});

child.on('exit', (code) => {
  process.exitCode = code ?? 1;
});
