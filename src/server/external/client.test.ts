import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { buildUrl, ExternalApiError, externalGet } from "./client";

/** A no-op sleep so retry/backoff tests don't wait on real timers. */
const noSleep = () => Promise.resolve();

/** Build a Response-like object for the mocked global fetch. */
function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  } as unknown as Response;
}

afterEach(() => {
  vi.restoreAllMocks();
});

beforeEach(() => {
  // Silence the structured logger emitted by externalGet during these tests.
  vi.spyOn(console, "info").mockImplementation(() => undefined);
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

describe("buildUrl", () => {
  it("joins base + path with a single slash and encodes query params", () => {
    const url = buildUrl("/products", { skus: "KIT002,MP-4410" });
    // base from vitest.config env is https://api.example.test/v1
    expect(url).toBe(
      "https://api.example.test/v1/products?skus=KIT002%2CMP-4410",
    );
  });

  it("tolerates leading/trailing slashes and skips undefined query values", () => {
    const url = buildUrl("products", { skus: "A", page: undefined });
    expect(url).toBe("https://api.example.test/v1/products?skus=A");
  });
});

describe("externalGet", () => {
  it("sends the bearer auth header and JSON Accept, returning parsed JSON", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(jsonResponse({ ok: 1 }));

    const out = await externalGet<{ ok: number }>("/products", {
      query: { skus: "A,B" },
    });

    expect(out).toEqual({ ok: 1 });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const call = fetchMock.mock.calls[0]!;
    const calledUrl = call[0];
    const init = call[1]!;
    expect(calledUrl).toBe("https://api.example.test/v1/products?skus=A%2CB");
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer test-token");
    expect(headers.Accept).toBe("application/json");
    expect(init.method).toBe("GET");
  });

  it("retries on 5xx then succeeds, respecting maxAttempts", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(jsonResponse({ error: "boom" }, 503))
      .mockResolvedValueOnce(jsonResponse({ ok: 2 }, 200));

    const out = await externalGet<{ ok: number }>("/products", {
      maxAttempts: 3,
      sleep: noSleep,
    });

    expect(out).toEqual({ ok: 2 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("gives up after maxAttempts on persistent 5xx and throws ExternalApiError", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(jsonResponse({ error: "down" }, 500));

    await expect(
      externalGet("/products", { maxAttempts: 3, sleep: noSleep }),
    ).rejects.toMatchObject({
      name: "ExternalApiError",
      status: 500,
    });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("does NOT retry on a deterministic 4xx", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(jsonResponse({ error: "bad request" }, 400));

    await expect(
      externalGet("/products", { maxAttempts: 3, sleep: noSleep }),
    ).rejects.toBeInstanceOf(ExternalApiError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("retries on a network error then surfaces it after exhausting attempts", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockRejectedValue(new Error("ECONNRESET"));

    await expect(
      externalGet("/products", { maxAttempts: 2, sleep: noSleep }),
    ).rejects.toMatchObject({ status: 0 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
