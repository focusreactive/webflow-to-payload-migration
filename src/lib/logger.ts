import { appendFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface Logger {
  debug(msg: string, data?: Record<string, unknown>): void;
  info(msg: string, data?: Record<string, unknown>): void;
  warn(msg: string, data?: Record<string, unknown>): void;
  error(msg: string, data?: Record<string, unknown>): void;
}

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

interface Props {
  level: LogLevel;
  stderr?: NodeJS.WritableStream;
  filePath?: string;
}

export function createLogger({ level, filePath, stderr: stderrProp }: Props): Logger {
  const stderr = stderrProp ?? process.stderr;
  const threshold = LEVEL_PRIORITY[level];

  if (filePath) mkdirSync(dirname(filePath), { recursive: true });

  const write = (level: LogLevel, msg: string, data?: Record<string, unknown>) => {
    if (LEVEL_PRIORITY[level] < threshold) return;

    const prettySuffix = data && Object.keys(data).length > 0 ? ` ${JSON.stringify(data)}` : "";
    stderr.write(`[${level}] ${msg}${prettySuffix}\n`);

    if (filePath) {
      const record = {
        level,
        msg,
        timestamp: new Date().toISOString(),
        ...data,
      };

      appendFileSync(filePath, `${JSON.stringify(record)}\n`);
    }
  };

  return {
    debug: (msg, data) => write("debug", msg, data),
    info: (msg, data) => write("info", msg, data),
    warn: (msg, data) => write("warn", msg, data),
    error: (msg, data) => write("error", msg, data),
  };
}
