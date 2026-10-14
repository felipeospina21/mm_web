/**
 * Helpers for serving external product images through our own origin.
 *
 * The aggregator's images live on an S3 bucket that does NOT send CORS
 * headers. Loading them directly with `crossOrigin="anonymous"` (which we need
 * so the Konva canvas stays untainted for PDF export) makes the browser block
 * the request. Routing them through `/api/image` fetches them server-side and
 * re-serves them same-origin — so they display AND the canvas stays exportable.
 *
 * Framework-agnostic (no server-only / React) so both the proxy route and the
 * editor page-builder can share the URL helpers.
 */

/**
 * Hostnames (exact or dot-suffix) whose images the proxy is allowed to fetch.
 * This is a security boundary: it stops `/api/image?url=` from being abused as
 * an open proxy / SSRF vector. Keep it to the aggregator's image CDN(s).
 */
export const ALLOWED_IMAGE_HOST_SUFFIXES = [
  "amazonaws.com", // S3 buckets, e.g. soyave-bucket.s3.eu-central-1.amazonaws.com
] as const;

/** True when `hostname` is exactly, or a subdomain of, an allowed suffix. */
export function isAllowedImageHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return ALLOWED_IMAGE_HOST_SUFFIXES.some(
    (suffix) => host === suffix || host.endsWith(`.${suffix}`),
  );
}

/**
 * Validate a candidate external image URL for proxying. Returns the parsed
 * URL when it is a well-formed `https` URL on an allowed host; otherwise null.
 * Rejects non-https (no plaintext, no `file:`/`data:` etc.) and disallowed
 * hosts.
 */
export function parseAllowedImageUrl(raw: string): URL | null {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== "https:") return null;
  if (!isAllowedImageHost(url.hostname)) return null;
  return url;
}

/**
 * Rewrite an external image URL to our same-origin proxy. Pass-through for
 * empty/missing input (callers render a placeholder in that case). Already
 * same-origin / relative URLs are left untouched.
 */
export function proxiedImageUrl(url: string | null | undefined): string {
  if (!url) return "";
  // Relative or already-proxied URLs don't need wrapping.
  if (url.startsWith("/")) return url;
  return `/api/image?url=${encodeURIComponent(url)}`;
}
