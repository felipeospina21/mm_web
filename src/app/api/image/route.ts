import { type NextRequest, NextResponse } from "next/server";

import { parseAllowedImageUrl } from "@/lib/product-image";
import { log } from "@/server/observability/logger";

/**
 * Image proxy.
 *
 * Fetches an allowlisted external product image server-side and re-serves it
 * from our own origin. Two problems this solves at once:
 *   1. The aggregator's S3 bucket sends no CORS headers, so the browser blocks
 *      `crossOrigin="anonymous"` loads — breaking display.
 *   2. We need `crossOrigin` so the Konva canvas isn't tainted for PDF export.
 * Serving same-origin removes the CORS requirement entirely while keeping the
 * canvas exportable.
 *
 * Security: only `https` URLs on an allowlisted host are fetched (see
 * `parseAllowedImageUrl`) so this cannot be used as an open proxy / SSRF
 * vector. Only `image/*` responses are passed through.
 */

export const dynamic = "force-dynamic";

/** Abort an upstream fetch that takes longer than this. */
const UPSTREAM_TIMEOUT_MS = 8_000;

export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get("url");
  if (!raw) {
    return NextResponse.json({ error: "missing url param" }, { status: 400 });
  }

  const target = parseAllowedImageUrl(raw);
  if (!target) {
    log.warn("image_proxy.rejected", { reason: "disallowed-or-malformed" });
    return NextResponse.json(
      { error: "url is not an allowed image URL" },
      { status: 400 },
    );
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
  try {
    const upstream = await fetch(target.toString(), {
      signal: controller.signal,
      // No credentials; we only want the public object bytes.
      headers: { Accept: "image/*" },
    });

    if (!upstream.ok) {
      log.warn("image_proxy.upstream", {
        host: target.hostname,
        status: upstream.status,
      });
      return NextResponse.json(
        { error: `upstream responded ${upstream.status}` },
        { status: 502 },
      );
    }

    const contentType = upstream.headers.get("content-type") ?? "";
    if (!contentType.startsWith("image/")) {
      log.warn("image_proxy.not_image", {
        host: target.hostname,
        contentType,
      });
      return NextResponse.json(
        { error: "upstream is not an image" },
        { status: 502 },
      );
    }

    const body = await upstream.arrayBuffer();
    return new NextResponse(body, {
      status: 200,
      headers: {
        "content-type": contentType,
        // Cache aggressively: product images are effectively immutable per URL.
        "cache-control": "public, max-age=86400, s-maxage=86400, immutable",
      },
    });
  } catch (cause) {
    log.error("image_proxy.error", {
      host: target.hostname,
      errorMessage: cause instanceof Error ? cause.message : String(cause),
    });
    return NextResponse.json(
      { error: "failed to fetch image" },
      { status: 502 },
    );
  } finally {
    clearTimeout(timer);
  }
}
