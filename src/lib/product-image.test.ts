import { describe, expect, it } from "vitest";

import {
  isAllowedImageHost,
  parseAllowedImageUrl,
  proxiedImageUrl,
} from "./product-image";

describe("isAllowedImageHost", () => {
  it("allows exact and subdomain matches of an allowed suffix", () => {
    expect(isAllowedImageHost("amazonaws.com")).toBe(true);
    expect(
      isAllowedImageHost("soyave-bucket.s3.eu-central-1.amazonaws.com"),
    ).toBe(true);
    expect(isAllowedImageHost("S3.AMAZONAWS.COM")).toBe(true); // case-insensitive
  });

  it("rejects unrelated and look-alike hosts", () => {
    expect(isAllowedImageHost("evil.com")).toBe(false);
    expect(isAllowedImageHost("example.org")).toBe(false);
    // Suffix must be on a dot boundary — not a substring trick.
    expect(isAllowedImageHost("notamazonaws.com")).toBe(false);
    expect(isAllowedImageHost("amazonaws.com.evil.com")).toBe(false);
  });
});

describe("parseAllowedImageUrl", () => {
  it("accepts a well-formed https URL on an allowed host", () => {
    const url = parseAllowedImageUrl(
      "https://soyave-bucket.s3.eu-central-1.amazonaws.com/x/a.jpg",
    );
    expect(url).not.toBeNull();
    expect(url!.hostname).toBe("soyave-bucket.s3.eu-central-1.amazonaws.com");
  });

  it("rejects non-https protocols (SSRF / scheme abuse)", () => {
    expect(parseAllowedImageUrl("http://x.amazonaws.com/a.jpg")).toBeNull();
    expect(parseAllowedImageUrl("file:///etc/passwd")).toBeNull();
    expect(
      parseAllowedImageUrl("data:image/png;base64,AAAA"),
    ).toBeNull();
  });

  it("rejects disallowed hosts and malformed URLs", () => {
    expect(parseAllowedImageUrl("https://evil.com/a.jpg")).toBeNull();
    expect(parseAllowedImageUrl("not a url")).toBeNull();
    expect(parseAllowedImageUrl("")).toBeNull();
  });
});

describe("proxiedImageUrl", () => {
  it("wraps an external URL in the same-origin proxy, encoded", () => {
    const original = "https://x.s3.amazonaws.com/a b.jpg?v=1";
    expect(proxiedImageUrl(original)).toBe(
      `/api/image?url=${encodeURIComponent(original)}`,
    );
  });

  it("returns empty string for empty / nullish input", () => {
    expect(proxiedImageUrl("")).toBe("");
    expect(proxiedImageUrl(null)).toBe("");
    expect(proxiedImageUrl(undefined)).toBe("");
  });

  it("leaves relative / already-proxied URLs untouched", () => {
    expect(proxiedImageUrl("/api/image?url=foo")).toBe("/api/image?url=foo");
    expect(proxiedImageUrl("/local.png")).toBe("/local.png");
  });
});
