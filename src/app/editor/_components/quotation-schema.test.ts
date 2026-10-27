import { describe, expect, it } from "vitest";

import {
  makeEmptyQuotationPages,
  makeMasterTemplate,
} from "../_lib/template-data";
import type { PageData } from "./types";
import { quotationDocumentSchema } from "./quotation-schema";

describe("quotationDocumentSchema — real editor output (lossless round-trip)", () => {
  it("accepts the master template page unchanged", () => {
    const doc: PageData[] = [makeMasterTemplate()];
    const parsed = quotationDocumentSchema.parse(doc);
    // Lossless: parsing the real default template does not drop or alter it.
    expect(parsed).toEqual(doc);
  });

  it("accepts a full empty-quotation document (default template layout)", () => {
    const doc = makeEmptyQuotationPages();
    const parsed = quotationDocumentSchema.parse(doc);
    expect(parsed).toEqual(doc);
    expect(parsed.length).toBeGreaterThan(0);
  });
});

describe("quotationDocumentSchema — template-agnostic (open editor)", () => {
  it("accepts a free-form page with none of the standard element IDs", () => {
    const freeForm: PageData[] = [
      {
        id: "custom-page-1",
        pageNumber: 1,
        elements: [
          {
            id: "my-own-element",
            type: "text",
            x: 10,
            y: 10,
            width: 100,
            height: 20,
            text: "anything",
            fontSize: 12,
            fill: "#000000",
            isDraggable: true,
          },
        ],
      },
    ];
    expect(() => quotationDocumentSchema.parse(freeForm)).not.toThrow();
  });
});

describe("quotationDocumentSchema — lossless unknown keys", () => {
  it("preserves an unmodeled key on an element through parse()", () => {
    const withExtra = [
      {
        id: "p1",
        pageNumber: 1,
        elements: [
          {
            id: "e1",
            type: "text",
            x: 0,
            y: 0,
            width: 10,
            height: 10,
            text: "",
            fontSize: 12,
            fill: "#000",
            isDraggable: false,
            // a field the schema does not model — must survive (future templates)
            futureConfig: { rotation: 45, locked: true },
          },
        ],
      },
    ];
    const parsed = quotationDocumentSchema.parse(withExtra);
    expect(
      (parsed[0]!.elements[0] as unknown as { futureConfig: unknown })
        .futureConfig,
    ).toEqual({ rotation: 45, locked: true });
  });
});

describe("quotationDocumentSchema — rejects structural garbage", () => {
  it("rejects a non-array document", () => {
    expect(() => quotationDocumentSchema.parse({ not: "an array" })).toThrow();
  });

  it("rejects an element missing its type", () => {
    const bad = [
      {
        id: "p1",
        pageNumber: 1,
        elements: [
          {
            id: "e1",
            // type missing
            x: 0,
            y: 0,
            width: 10,
            height: 10,
            text: "",
            fontSize: 12,
            fill: "#000",
            isDraggable: false,
          },
        ],
      },
    ];
    expect(() => quotationDocumentSchema.parse(bad)).toThrow();
  });

  it("rejects an unknown element type", () => {
    const bad = [
      {
        id: "p1",
        pageNumber: 1,
        elements: [
          {
            id: "e1",
            type: "video",
            x: 0,
            y: 0,
            width: 10,
            height: 10,
            text: "",
            fontSize: 12,
            fill: "#000",
            isDraggable: false,
          },
        ],
      },
    ];
    expect(() => quotationDocumentSchema.parse(bad)).toThrow();
  });

  it("rejects a table whose cells are not a string matrix", () => {
    const bad = [
      {
        id: "p1",
        pageNumber: 1,
        elements: [
          {
            id: "t1",
            type: "table",
            x: 0,
            y: 0,
            width: 100,
            height: 100,
            text: "",
            fontSize: 12,
            fill: "#000",
            isDraggable: false,
            table: {
              colWidths: [10, 10],
              rowHeight: 20,
              cells: [[1, 2]], // numbers, not strings
              headerFill: "#eee",
              headerColor: "#111",
              borderColor: "#ccc",
              fontSize: 10,
            },
          },
        ],
      },
    ];
    expect(() => quotationDocumentSchema.parse(bad)).toThrow();
  });
});
