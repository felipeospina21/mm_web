import "server-only";

import { env } from "@/env";

/**
 * Typed fetch wrapper for the external product aggregator API.
 *
 * Responsibilities (transport only — no payload validation; that is the Zod
 * firewall's job in a later epic):
 *   - prefix requests with `EXTERNAL_API_BASE_URL`
 *   - attach `Authorization: Bearer <EXTERNAL_API_TOKEN>` and JSON Accept
 *   - abort a request that exceeds a timeout
 *   - retry transient failures (network errors + 5xx + 429) with exponential
 *     backoff; never retry other 4xx (they are deterministic client errors)
 *
 * `server-only` guarantees the token never ends up in a client bundle.
 */

/** Error thrown when the external API returns a non-2xx response. */
export class ExternalApiError extends Error {
  constructor(
    message: string,
    /** HTTP status code, or 0 for a network/timeout failure. */
    readonly status: number,
    /** Response body text, when available. */
    readonly body?: string,
  ) {
    super(message);
    this.name = "ExternalApiError";
  }
}

export interface ExternalFetchOptions {
  /** Query parameters appended to the path. */
  query?: Record<string, string | number | undefined>;
  /** Abort the request after this many ms (default 10_000). */
  timeoutMs?: number;
  /** Max attempts including the first (default 3). */
  maxAttempts?: number;
  /** Base backoff in ms; attempt N waits baseDelayMs * 2^(N-1) (default 300). */
  baseDelayMs?: number;
  /**
   * Sleep implementation; injectable so tests don't wait on real timers.
   * Defaults to a real `setTimeout`-based delay.
   */
  sleep?: (ms: number) => Promise<void>;
}

const DEFAULTS = {
  timeoutMs: 10_000,
  maxAttempts: 3,
  baseDelayMs: 300,
} as const;

const realSleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Statuses worth retrying: rate-limit + server errors. */
function isRetryableStatus(status: number): boolean {
  return status === 429 || status >= 500;
}

/**
 * Build an absolute URL from the configured base, a path, and query params.
 * `undefined` query values are skipped. Exported for testing.
 */
export function buildUrl(
  path: string,
  query?: ExternalFetchOptions["query"],
): string {
  if (!env.EXTERNAL_API_BASE_URL) {
    throw new ExternalApiError(
      "EXTERNAL_API_BASE_URL is not configured",
      0,
    );
  }
  // Join base + path with exactly one slash.
  const base = env.EXTERNAL_API_BASE_URL.replace(/\/+$/, "");
  const rel = path.replace(/^\/+/, "");
  const url = new URL(`${base}/${rel}`);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined) url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
}

/**
 * Perform a GET against the external API and return the parsed JSON body
 * typed as `T`. Throws `ExternalApiError` on timeout, network failure, or a
 * non-2xx response (after exhausting retries for transient failures).
 *
 * NOTE: the returned value is cast to `T` without validation — callers that
 * care about shape must validate it (Zod firewall epic).
 */
export async function externalGet<T>(
  path: string,
  options: ExternalFetchOptions = {},
): Promise<T> {
  const {
    query,
    timeoutMs = DEFAULTS.timeoutMs,
    maxAttempts = DEFAULTS.maxAttempts,
    baseDelayMs = DEFAULTS.baseDelayMs,
    sleep = realSleep,
  } = options;

  const url = buildUrl(path, query);
  const headers: Record<string, string> = { Accept: "application/json" };
  if (env.EXTERNAL_API_TOKEN) {
    headers.Authorization = `Bearer ${env.EXTERNAL_API_TOKEN}`;
  }

  let lastError: ExternalApiError | undefined;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        method: "GET",
        headers,
        signal: controller.signal,
      });

      if (res.ok) {
        return (await res.json()) as T;
      }

      // Non-2xx. Read the body for diagnostics (best-effort).
      const body = await res.text().catch(() => undefined);
      const err = new ExternalApiError(
        `External API GET ${path} failed with status ${res.status}`,
        res.status,
        body,
      );

      // Deterministic client errors (except 429) are not worth retrying.
      if (!isRetryableStatus(res.status)) throw err;
      lastError = err;
    } catch (cause) {
      // Re-throw non-retryable ExternalApiErrors immediately.
      if (cause instanceof ExternalApiError && !isRetryableStatus(cause.status)) {
        throw cause;
      }
      lastError =
        cause instanceof ExternalApiError
          ? cause
          : new ExternalApiError(
              `External API GET ${path} failed: ${
                cause instanceof Error ? cause.message : String(cause)
              }`,
              0,
            );
    } finally {
      clearTimeout(timer);
    }

    // Back off before the next attempt (skip the wait after the last one).
    if (attempt < maxAttempts) {
      await sleep(baseDelayMs * 2 ** (attempt - 1));
    }
  }

  throw (
    lastError ??
    new ExternalApiError(`External API GET ${path} failed`, 0)
  );
}
