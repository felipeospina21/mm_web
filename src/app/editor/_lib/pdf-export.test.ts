import { describe, expect, it, vi } from "vitest";
import type { jsPDF } from "jspdf";

import type { TemplateElement } from "../_components/types";
import { __test } from "./pdf-export";

const { parseColor, getFontFamily, getFontStyle, getImageFormat, wrapText } =
  __test;

function el(overrides: Partial<TemplateElement> = {}): TemplateElement {
  return {
    id: "e",
    type: "text",
    x: 0,
    y: 0,
    width: 100,
    height: 40,
    text: "",
    fontSize: 12,
    fill: "#000",
    isDraggable: false,
    ...overrides,
  };
}

describe("parseColor", () => {
  it("parses a 6-digit hex", () => {
    expect(parseColor("#ff8800")).toEqual([255, 136, 0]);
  });

  it("expands a 3-digit hex", () => {
    expect(parseColor("#f80")).toEqual([255, 136, 0]);
  });

  it("parses rgb()/rgba()", () => {
    expect(parseColor("rgb(1, 2, 3)")).toEqual([1, 2, 3]);
    expect(parseColor("rgba(10, 20, 30, 0.5)")).toEqual([10, 20, 30]);
  });

  it("tolerates surrounding whitespace in hex", () => {
    expect(parseColor("  #010203 ")).toEqual([1, 2, 3]);
  });

  it("falls back to black for unrecognized input", () => {
    expect(parseColor("not-a-color")).toEqual([0, 0, 0]);
    expect(parseColor("")).toEqual([0, 0, 0]);
  });
});

describe("getFontFamily", () => {
  it("maps serif families to times", () => {
    expect(getFontFamily("Times New Roman")).toBe("times");
    expect(getFontFamily("Georgia")).toBe("times");
  });

  it("maps monospace to courier", () => {
    expect(getFontFamily("Courier New")).toBe("courier");
  });

  it("defaults to helvetica (incl. undefined)", () => {
    expect(getFontFamily("Arial")).toBe("helvetica");
    expect(getFontFamily(undefined)).toBe("helvetica");
  });
});

describe("getFontStyle", () => {
  it("combines bold and italic", () => {
    expect(getFontStyle(el({ fontWeight: "bold", italic: true }))).toBe(
      "bolditalic",
    );
  });

  it("returns bold / italic / normal individually", () => {
    expect(getFontStyle(el({ fontWeight: "bold" }))).toBe("bold");
    expect(getFontStyle(el({ italic: true }))).toBe("italic");
    expect(getFontStyle(el())).toBe("normal");
  });
});

describe("getImageFormat", () => {
  it("detects PNG and WEBP data URLs, defaulting to JPEG", () => {
    expect(getImageFormat("data:image/png;base64,AAAA")).toBe("PNG");
    expect(getImageFormat("data:image/webp;base64,AAAA")).toBe("WEBP");
    expect(getImageFormat("data:image/jpeg;base64,AAAA")).toBe("JPEG");
    expect(getImageFormat("data:image/gif;base64,AAAA")).toBe("JPEG");
  });
});

describe("wrapText", () => {
  // Minimal jsPDF stub: wrapText only calls splitTextToSize. We make it split
  // on spaces so we can assert the flatMap-per-line behaviour deterministically.
  const pdf = {
    splitTextToSize: (line: string) => line.split(" "),
  } as unknown as jsPDF;

  it("splits each newline-separated line via splitTextToSize", () => {
    expect(wrapText(pdf, "a b\nc", 100)).toEqual(["a", "b", "c"]);
  });

  it("preserves empty lines as a single empty string", () => {
    expect(wrapText(pdf, "a\n\nb", 100)).toEqual(["a", "", "b"]);
  });

  it("coerces non-string input to empty (ragged/null cell safety)", () => {
    expect(wrapText(pdf, null as unknown as string, 100)).toEqual([""]);
    expect(wrapText(pdf, undefined as unknown as string, 100)).toEqual([""]);
  });
});

const { collectImageElements, resolveImages } = __test;

type PageLike = Parameters<typeof collectImageElements>[0][number];

function page(elements: TemplateElement[]): PageLike {
  return { id: "p", pageNumber: 1, elements };
}

const resolved = (dataUrl: string) => ({
  dataUrl,
  format: "PNG" as const,
  naturalWidth: 10,
  naturalHeight: 10,
});

describe("collectImageElements", () => {
  it("returns image elements with a non-empty src, in document order", () => {
    const img1 = el({ id: "i1", type: "image", src: "a.png" });
    const img2 = el({ id: "i2", type: "image", src: "b.png" });
    const noSrc = el({ id: "i3", type: "image", src: "" });
    const text = el({ id: "t", type: "text", text: "hi" });
    const pages = [page([text, img1, noSrc]), page([img2])];

    expect(collectImageElements(pages)).toEqual([img1, img2]);
  });

  it("returns [] when there are no images", () => {
    expect(collectImageElements([page([el({ type: "text" })])])).toEqual([]);
  });
});

describe("resolveImages", () => {
  it("maps each element to its loaded image", async () => {
    const img1 = el({ id: "i1", type: "image", src: "a.png" });
    const img2 = el({ id: "i2", type: "image", src: "b.png" });
    const load = (e: TemplateElement) => Promise.resolve(resolved(e.src!));

    const map = await resolveImages([img1, img2], load);

    expect(map.get(img1)).toEqual(resolved("a.png"));
    expect(map.get(img2)).toEqual(resolved("b.png"));
  });

  it("loads all images in parallel (fans out before any resolves)", async () => {
    const img1 = el({ id: "i1", type: "image", src: "a.png" });
    const img2 = el({ id: "i2", type: "image", src: "b.png" });
    let started = 0;
    const releases: Array<() => void> = [];
    const load = (e: TemplateElement) =>
      new Promise<ReturnType<typeof resolved>>((resolveLoad) => {
        started += 1;
        releases.push(() => resolveLoad(resolved(e.src!)));
      });

    const pending = resolveImages([img1, img2], load);
    // Let the synchronous fan-out run.
    await Promise.resolve();
    // Both loads were kicked off before either resolved — i.e. not sequential.
    expect(started).toBe(2);

    releases.forEach((release) => release());
    await expect(pending).resolves.toBeInstanceOf(Map);
  });

  it("isolates failures: a rejected load yields null, others still resolve", async () => {
    const ok = el({ id: "i1", type: "image", src: "ok.png" });
    const bad = el({ id: "i2", type: "image", src: "bad.png" });
    const load = (e: TemplateElement) =>
      e.src === "bad.png"
        ? Promise.reject(new Error("boom"))
        : Promise.resolve(resolved(e.src!));

    // The placeholder path logs a warning by design; keep test output clean.
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const map = await resolveImages([ok, bad], load);
    warn.mockRestore();

    expect(map.get(ok)).toEqual(resolved("ok.png"));
    expect(map.get(bad)).toBeNull();
  });
});
