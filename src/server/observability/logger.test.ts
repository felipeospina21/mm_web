import { afterEach, describe, expect, it, vi } from "vitest";

import { errorFields, log } from "./logger";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("structured logger", () => {
  it("emits a single JSON line with ts, level, event and fields", () => {
    const spy = vi.spyOn(console, "info").mockImplementation(() => undefined);

    log.info("lookup.resolve", { requested: 3, resolved: 2 });

    expect(spy).toHaveBeenCalledTimes(1);
    const parsed = JSON.parse(spy.mock.calls[0]![0] as string) as Record<
      string,
      unknown
    >;
    expect(parsed.level).toBe("info");
    expect(parsed.event).toBe("lookup.resolve");
    expect(parsed.requested).toBe(3);
    expect(parsed.resolved).toBe(2);
    expect(typeof parsed.ts).toBe("string");
  });

  it("routes each level to the matching console method", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const error = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    log.warn("external_api.retry", { attempt: 1 });
    log.error("external_api.request", { status: 500 });

    expect(warn).toHaveBeenCalledTimes(1);
    expect(error).toHaveBeenCalledTimes(1);
  });

  it("degrades gracefully on unserializable fields instead of throwing", () => {
    const spy = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const circular: Record<string, unknown> = {};
    circular.self = circular;

    expect(() => log.info("weird", { circular })).not.toThrow();
    const parsed = JSON.parse(spy.mock.calls[0]![0] as string) as Record<
      string,
      unknown
    >;
    expect(parsed.logError).toBe("unserializable fields");
    expect(parsed.event).toBe("weird");
  });

  it("errorFields extracts name + message from an Error", () => {
    const fields = errorFields(new TypeError("boom"));
    expect(fields).toEqual({ errorName: "TypeError", errorMessage: "boom" });
  });

  it("errorFields stringifies a non-Error value", () => {
    expect(errorFields("nope")).toEqual({ errorMessage: "nope" });
  });
});
