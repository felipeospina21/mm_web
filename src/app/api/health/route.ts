import { sql } from "drizzle-orm";
import { NextResponse } from "next/server";

import { env } from "@/env";
import { db } from "@/server/db";
import { buildUrl } from "@/server/external/client";
import { errorFields, log } from "@/server/observability/logger";

/**
 * Health / readiness probe.
 *
 * Vendor-neutral: a plain GET returning JSON, suitable for Vercel's checks, an
 * external uptime pinger (UptimeRobot, Better Stack, Uptime Kuma), or a manual
 * `curl`. No auth — it exposes only coarse up/down signals, never data.
 *
 * Semantics:
 *   - `db` is a HARD dependency. If it is down the service is "unhealthy"
 *     (HTTP 503) — the app can't serve quotations without it.
 *   - `externalApi` is a SOFT dependency. The core quotation editor works
 *     without it (it only powers the reference lookup), so a failure here
 *     yields "degraded" (still HTTP 200) rather than a hard outage.
 */

export const dynamic = "force-dynamic";

type CheckStatus = "ok" | "error" | "skipped";

interface Check {
  status: CheckStatus;
  durationMs: number;
  detail?: string;
}

/** Ping the database with a trivial `SELECT 1`. */
async function checkDb(): Promise<Check> {
  const startedAt = Date.now();
  try {
    await db.execute(sql`select 1`);
    return { status: "ok", durationMs: Date.now() - startedAt };
  } catch (cause) {
    return {
      status: "error",
      durationMs: Date.now() - startedAt,
      detail: cause instanceof Error ? cause.message : String(cause),
    };
  }
}

/**
 * Probe external-API reachability. We don't want to hammer the real endpoint
 * on every health check, so this is intentionally light: when the API is not
 * configured we report `skipped`; otherwise we issue a short-timeout HEAD to
 * the base URL and treat ANY HTTP response (even 4xx) as "reachable" — we are
 * checking the network path, not authorization.
 */
async function checkExternalApi(): Promise<Check> {
  const startedAt = Date.now();

  if (!env.EXTERNAL_API_BASE_URL) {
    return { status: "skipped", durationMs: 0, detail: "not configured" };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 3_000);
  try {
    // Hit the base URL itself; we only care that the host answers.
    const url = buildUrl("/");
    const res = await fetch(url, {
      method: "HEAD",
      signal: controller.signal,
    });
    return {
      status: "ok",
      durationMs: Date.now() - startedAt,
      detail: `reachable (${res.status})`,
    };
  } catch (cause) {
    return {
      status: "error",
      durationMs: Date.now() - startedAt,
      detail: cause instanceof Error ? cause.message : String(cause),
    };
  } finally {
    clearTimeout(timer);
  }
}

export async function GET() {
  const [dbCheck, externalApiCheck] = await Promise.all([
    checkDb(),
    checkExternalApi(),
  ]);

  // db is hard; externalApi is soft.
  const status =
    dbCheck.status === "error"
      ? "unhealthy"
      : externalApiCheck.status === "error"
        ? "degraded"
        : "healthy";

  const body = {
    status,
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.round(process.uptime()),
    checks: { db: dbCheck, externalApi: externalApiCheck },
  };

  if (status === "unhealthy") {
    log.error("health.check", { status, ...errorFields(dbCheck.detail) });
  } else if (status === "degraded") {
    log.warn("health.check", { status, externalApi: externalApiCheck.detail });
  }

  return NextResponse.json(body, {
    status: status === "unhealthy" ? 503 : 200,
    headers: { "cache-control": "no-store" },
  });
}
