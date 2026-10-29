type Level = 'debug' | 'info' | 'warn' | 'error';

const COLORS: Record<Level, string> = {
  debug: '\x1b[90m',
  info: '\x1b[36m',
  warn: '\x1b[33m',
  error: '\x1b[31m',
};
const RESET = '\x1b[0m';
const isTty = process.stdout.isTTY;

function emit(level: Level, message: string, meta?: Record<string, unknown>) {
  const stamp = new Date().toISOString();
  const color = isTty ? COLORS[level] : '';
  const tail = meta && Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
  const line = `${color}${stamp} ${level.toUpperCase().padEnd(5)}${RESET} ${message}${tail}`;
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
}

export const log = {
  debug: (message: string, meta?: Record<string, unknown>) => emit('debug', message, meta),
  info: (message: string, meta?: Record<string, unknown>) => emit('info', message, meta),
  warn: (message: string, meta?: Record<string, unknown>) => emit('warn', message, meta),
  error: (message: string, meta?: Record<string, unknown>) => emit('error', message, meta),
};
