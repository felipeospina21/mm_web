import "server-only";

/**
 * Minimal, dependency-free structured logger.
 *
 * Emits one JSON object per line via `console`, which is exactly what
 * platform log collectors (Vercel Observability, Fly, Railway, Loki, Sentry's
 * log integration, …) ingest. Keeping it vendor-neutral means we can point the
 * same logs at any backend later with zero code changes.
 *
 * Conventions:
 *   - every line has `ts`, `level`, `event`, plus arbitrary structured fields
 *   - `event` is a short, greppable, dot-namespaced string (e.g.
 *     "external_api.request", "lookup.resolve")
 *   - NEVER log secret values (tokens, passwords) or PII — log shapes/counts,
 *     not payloads. Callers are responsible for passing safe fields.
 *
 * Usage:
 *   log.info("lookup.resolve", { requested: 3, resolved: 2, durationMs: 120 });
 *   log.error("external_api.request", { status: 500, attempts: 3 });
 */

export type LogLevel = "debug" | "info" | "warn" | "error";

/** Structured fields; values must be JSON-serializable and secret-free. */
export type LogFields = Record<string, unknown>;

interface LogLine extends LogFields {
  ts: string;
  level: LogLevel;
  event: string;
}

/** Route each level to the matching console method so platforms classify it. */
const consoleFor: Record<LogLevel, (line: string) => void> = {
  debug: (l) => console.debug(l),
  info: (l) => console.info(l),
  warn: (l) => console.warn(l),
  error: (l) => console.error(l),
};

function emit(level: LogLevel, event: string, fields?: LogFields): void {
  const line: LogLine = {
    ts: new Date().toISOString(),
    level,
    event,
    ...fields,
  };

  let serialized: string;
  try {
    serialized = JSON.stringify(line);
  } catch {
    // A field wasn't serializable (e.g. a circular object). Degrade to a
    // safe line rather than throwing from a logging call.
    serialized = JSON.stringify({
      ts: line.ts,
      level,
      event,
      logError: "unserializable fields",
    });
  }

  consoleFor[level](serialized);
}

export const log = {
  debug: (event: string, fields?: LogFields) => emit("debug", event, fields),
  info: (event: string, fields?: LogFields) => emit("info", event, fields),
  warn: (event: string, fields?: LogFields) => emit("warn", event, fields),
  error: (event: string, fields?: LogFields) => emit("error", event, fields),
};

/**
 * Normalize an unknown thrown value into a small, safe, loggable shape.
 * Captures the message and error name but never the stack by default (keep
 * log lines compact; the platform can be configured for stacks separately).
 */
export function errorFields(cause: unknown): LogFields {
  if (cause instanceof Error) {
    return { errorName: cause.name, errorMessage: cause.message };
  }
  return { errorMessage: String(cause) };
}
