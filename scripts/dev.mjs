#!/usr/bin/env node
/**
 * NOVA dev orchestrator — runs the API and the Vite dev server together,
 * prefixes their output, and shuts both down on Ctrl+C.
 */
import { spawn } from 'node:child_process';
import process from 'node:process';

const COLORS = {
  api: '\x1b[38;5;111m',
  web: '\x1b[38;5;80m',
  reset: '\x1b[0m',
  dim: '\x1b[90m',
};

const processes = [
  {
    name: 'api',
    command: process.platform === 'win32' ? 'npm.cmd' : 'npm',
    args: ['run', 'dev', '-w', 'server'],
    color: COLORS.api,
  },
  {
    name: 'web',
    command: process.platform === 'win32' ? 'npm.cmd' : 'npm',
    args: ['run', 'dev', '-w', 'web'],
    color: COLORS.web,
  },
];

const children = [];
let shuttingDown = false;

function prefixStream(stream, name, color) {
  let buffer = '';
  stream.on('data', (chunk) => {
    buffer += chunk.toString();
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines) {
      process.stdout.write(`${color}${name.padEnd(3)}${COLORS.reset} ${COLORS.dim}│${COLORS.reset} ${line}\n`);
    }
  });
}

for (const definition of processes) {
  const child = spawn(definition.command, definition.args, {
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, FORCE_COLOR: '1' },
  });
  children.push(child);
  prefixStream(child.stdout, definition.name, definition.color);
  prefixStream(child.stderr, definition.name, definition.color);

  child.on('exit', (code) => {
    if (shuttingDown) return;
    console.log(`\n${definition.color}${definition.name}${COLORS.reset} exited with code ${code}`);
    shutdown(code ?? 0);
  });
}

function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children) {
    if (!child.killed) child.kill('SIGTERM');
  }
  setTimeout(() => process.exit(code), 400);
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

console.log(`
${COLORS.api}  ███╗   ██╗ ██████╗ ██╗   ██╗ █████╗ ${COLORS.reset}
${COLORS.api}  ████╗  ██║██╔═══██╗██║   ██║██╔══██╗${COLORS.reset}
${COLORS.web}  ██╔██╗ ██║██║   ██║██║   ██║███████║${COLORS.reset}
${COLORS.web}  ██║╚██╗██║██║   ██║╚██╗ ██╔╝██╔══██║${COLORS.reset}
${COLORS.web}  ██║ ╚████║╚██████╔╝ ╚████╔╝ ██║  ██║${COLORS.reset}
${COLORS.web}  ╚═╝  ╚═══╝ ╚═════╝   ╚═══╝  ╚═╝  ╚═╝${COLORS.reset}

  ${COLORS.dim}AI top-up super app · API :8787 · Web :5173${COLORS.reset}
  ${COLORS.dim}Demo: demo@nova.ai / Demo@1234 · admin@nova.ai / Admin@123${COLORS.reset}
`);
