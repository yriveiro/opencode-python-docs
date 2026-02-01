import type { LogLevel } from "./types";

/** Logger interface providing leveled logging methods. */
export interface Logger {
  info: (msg: string) => Promise<unknown>;
  warn: (msg: string) => Promise<unknown>;
  error: (msg: string) => Promise<unknown>;
}

interface LoggingContext {
  client: {
    app: {
      log: (params: {
        body: { service: string; level: LogLevel; message: string };
      }) => Promise<unknown>;
    };
  };
}

/**
 * Creates a logger that sends messages through the OpenCode plugin logging API.
 * @param ctx - The plugin context containing the logging client.
 * @returns A Logger instance with info, warn, and error methods.
 */
export function createLogger(ctx: LoggingContext): Logger {
  const log = (level: LogLevel) => (msg: string) =>
    ctx.client.app.log({
      body: { service: "python-docs", level, message: msg },
    });

  return {
    info: log("info"),
    warn: log("warn"),
    error: log("error"),
  };
}
