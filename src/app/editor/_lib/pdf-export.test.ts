import { describe, expect, it } from "vitest";
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
