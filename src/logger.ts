import pinoLogger from 'pino';
import type { LevelWithSilent } from 'pino';

export type Logger = Pick<ReturnType<typeof pinoLogger>, 'debug' | 'info' | 'warn' | 'error'>;

export interface LoggerOptions {
  level?: LevelWithSilent;
  name?: string;
}

export function createLogger(options: LoggerOptions = {}): Logger {
  const { level = 'info', name = 'moviebox-js-sdk' } = options;
  return pinoLogger({ level, name });
}

export function createNoopLogger(): Logger {
  const noop = () => {};
  return {
    debug: noop,
    info: noop,
    warn: noop,
    error: noop
  } satisfies Logger;
}
