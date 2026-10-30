import { describe, expect, it } from "vitest";

import type { TemplateElement } from "../_components/types";
import { elementRole, isLineItems, isLineItemsId } from "./element-role";

/** Minimal element builder — only the fields the resolver reads. */
function el(overrides: Partial<TemplateElement>): TemplateElement {
  return {
    id: "x",
    type: "text",
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    text: "",
    fontSize: 0,
    fill: "#000",
    isDraggable: false,
    ...overrides,
  };
}

describe("elementRole", () => {
  it("returns the explicit role when present", () => {
    expect(elementRole(el({ role: "line-items" }))).toBe("line-items");
  });

  it("maps a legacy prefixed id to its role when role is absent", () => {
    expect(elementRole(el({ id: "product-name-p1" }))).toBe("product-name");
  });

  it.each([
    ["product-reference-p2", "product-reference"],
    ["product-description-p3", "product-description"],
    ["product-image-p1", "product-image"],
    ["line-items-p1", "line-items"],
  ] as const)("maps legacy prefix id %s", (id, role) => {
    expect(elementRole(el({ id }))).toBe(role);
  });

  it.each([
    ["quotation-number", "quotation-number"],
    ["representative-info", "representative-info"],
    ["footer", "footer"],
    ["policies-body", "policies-body"],
    ["customer-name", "customer-name"],
    ["company-name", "company-name"],
  ] as const)("maps legacy exact id %s", (id, role) => {
    expect(elementRole(el({ id }))).toBe(role);
  });

  it("returns undefined for an unrecognized id with no role", () => {
    expect(elementRole(el({ id: "free-form-123" }))).toBeUndefined();
  });

  it("prefers an explicit role over a conflicting legacy id", () => {
    expect(elementRole(el({ id: "footer", role: "line-items" }))).toBe(
      "line-items",
    );
  });
});

describe("isLineItems", () => {
  it("is true for a legacy line-items id", () => {
    expect(isLineItems(el({ id: "line-items-p1" }))).toBe(true);
  });

  it("is true for an element with the explicit line-items role", () => {
    expect(isLineItems(el({ id: "anything", role: "line-items" }))).toBe(true);
  });

  it("is false for other elements", () => {
    expect(isLineItems(el({ id: "product-name-p1" }))).toBe(false);
    expect(isLineItems(el({ id: "free-form" }))).toBe(false);
  });
});

describe("isLineItemsId", () => {
  it("is true for a legacy line-items id string", () => {
    expect(isLineItemsId("line-items-p1")).toBe(true);
  });

  it("is false for other or nullish ids", () => {
    expect(isLineItemsId("product-name-p1")).toBe(false);
    expect(isLineItemsId(null)).toBe(false);
    expect(isLineItemsId(undefined)).toBe(false);
  });
});

describe("legacy document (no role fields) resolves every role", () => {
  // A trimmed snapshot shaped like data saved before `role` existed: ids only.
  const legacyPages = [
    { id: "customer-name" },
    { id: "company-name" },
    { id: "quotation-number" },
    { id: "representative-info" },
    { id: "footer" },
    { id: "product-name-p1" },
    { id: "product-reference-p1" },
    { id: "product-description-p1" },
    { id: "product-image-p1" },
    { id: "line-items-p1" },
    { id: "policies-body" },
  ].map((o) => el(o));

  it("maps each legacy element to a defined role", () => {
    const roles = legacyPages.map((element) => elementRole(element));
    expect(roles).toEqual([
      "customer-name",
      "company-name",
      "quotation-number",
      "representative-info",
      "footer",
      "product-name",
      "product-reference",
      "product-description",
      "product-image",
      "line-items",
      "policies-body",
    ]);
  });
});
