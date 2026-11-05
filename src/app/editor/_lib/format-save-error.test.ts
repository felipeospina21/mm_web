import { describe, expect, it } from "vitest";

import { formatSaveError, type SaveErrorLike } from "./format-save-error";

/** Build a tRPC-like error carrying a single trimmed Zod issue. */
function zodError(
  path: Array<string | number>,
  maximum?: number,
  code = "too_big",
): SaveErrorLike {
  return { message: "validation", data: { zodIssues: [{ path, code, maximum }] } };
}

describe("formatSaveError — body too large (413)", () => {
  it("maps the classic 'Unexpected token R' parse error", () => {
    const result = formatSaveError({ message: "Unexpected token 'R', \"Request En\"... is not valid JSON" });
    expect(result.code).toBe("QUOT-TOO-LARGE-VERCEL");
    expect(result.message).toContain("demasiado grande");
    // Vercel rides in the CODE, not the user-facing sentence body.
    expect(result.message).toContain("QUOT-TOO-LARGE-VERCEL");
  });

  it("maps explicit 'Request Entity Too Large' and 413", () => {
    expect(formatSaveError({ message: "Request Entity Too Large" }).code).toBe(
      "QUOT-TOO-LARGE-VERCEL",
    );
    expect(formatSaveError({ message: "HTTP 413" }).code).toBe(
      "QUOT-TOO-LARGE-VERCEL",
    );
  });

  it("413 takes precedence even if a zodIssue is somehow present", () => {
    const err: SaveErrorLike = {
      message: "payload too large",
      data: { zodIssues: [{ path: ["data", 0, "elements", 0, "id"], code: "too_big", maximum: 200 }] },
    };
    expect(formatSaveError(err).code).toBe("QUOT-TOO-LARGE-VERCEL");
  });
});

describe("formatSaveError — per-field validation", () => {
  it("element id too long -> QUOT-ID-TOO-LONG with the cap", () => {
    const r = formatSaveError(zodError(["data", 13, "elements", 7, "id"], 200));
    expect(r.code).toBe("QUOT-ID-TOO-LONG");
    expect(r.message).toContain("identificador demasiado largo");
    expect(r.message).toContain("200");
    expect(r.message).toContain("Código: QUOT-ID-TOO-LONG");
  });

  it("element text too long -> QUOT-TEXT-TOO-LONG", () => {
    const r = formatSaveError(zodError(["data", 2, "elements", 1, "text"], 20000));
    expect(r.code).toBe("QUOT-TEXT-TOO-LONG");
    expect(r.message).toContain("20000");
  });

  it("table cell text (ends in two indices) -> QUOT-CELL-TOO-LONG", () => {
    const r = formatSaveError(
      zodError(["data", 0, "elements", 3, "table", "cells", 4, 2], 10000),
    );
    expect(r.code).toBe("QUOT-CELL-TOO-LONG");
    expect(r.message).toContain("celda");
    expect(r.message).toContain("10000");
  });

  it("too many elements on a page -> QUOT-TOO-MANY-ELEMENTS", () => {
    const r = formatSaveError(zodError(["data", 5, "elements"], 1000));
    expect(r.code).toBe("QUOT-TOO-MANY-ELEMENTS");
    expect(r.message).toContain("demasiados elementos");
    expect(r.message).toContain("1000");
  });

  it("row-count error on cells (ends AT 'cells') is NOT mistaken for cell text", () => {
    // [...,"cells"] with no trailing indices is a row-count cap, not cell text.
    const r = formatSaveError(zodError(["data", 0, "elements", 3, "table", "cells"], 1000));
    expect(r.code).not.toBe("QUOT-CELL-TOO-LONG");
    expect(r.code).toBe("QUOT-SAVE-FAILED");
  });

  it("missing maximum falls back to 'el límite permitido'", () => {
    const r = formatSaveError(zodError(["data", 0, "elements", 0, "id"]));
    expect(r.code).toBe("QUOT-ID-TOO-LONG");
    expect(r.message).toContain("el límite permitido");
  });

  it("known validation shape but unmapped field -> generic code + field name", () => {
    const r = formatSaveError(zodError(["data", 0, "elements", 0, "fontFamily"], 200));
    expect(r.code).toBe("QUOT-SAVE-FAILED");
    expect(r.message).toContain("campo: fontFamily");
  });
});

describe("formatSaveError — fallback", () => {
  it("no issues and no 413 signature -> generic", () => {
    expect(formatSaveError({ message: "network boom" }).code).toBe("QUOT-SAVE-FAILED");
  });

  it("empty/absent data -> generic, never throws", () => {
    expect(formatSaveError({}).code).toBe("QUOT-SAVE-FAILED");
    expect(formatSaveError({ data: null }).code).toBe("QUOT-SAVE-FAILED");
    expect(formatSaveError({ data: { zodIssues: [] } }).code).toBe("QUOT-SAVE-FAILED");
  });

  it("always returns a non-empty message", () => {
    expect(formatSaveError({}).message.length).toBeGreaterThan(0);
  });
});
