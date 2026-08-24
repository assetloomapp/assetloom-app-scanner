import { styleText } from "node:util";

export type LogLevel = "debug" | "info" | "warn" | "error";

const ORDER: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};
const COLORS: Record<LogLevel, "dim" | "cyan" | "yellow" | "red"> = {
  debug: "dim",
  info: "cyan",
  warn: "yellow",
  error: "red",
};

let threshold: LogLevel = "info";

export function setLogLevel(level: LogLevel): void {
  threshold = level;
}

function write(level: LogLevel, msg: string): void {
  if (ORDER[level] < ORDER[threshold]) return;
  const tag = level.padEnd(5);
  process.stderr.write(
    `${process.stderr.isTTY ? styleText(COLORS[level], tag) : tag} ${msg}\n`,
  );
}

export const log = {
  debug: (msg: string) => write("debug", msg),
  info: (msg: string) => write("info", msg),
  warn: (msg: string) => write("warn", msg),
  error: (msg: string) => write("error", msg),
};
