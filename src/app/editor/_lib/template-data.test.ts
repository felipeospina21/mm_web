import { describe, expect, it } from "vitest";

import type { Product, QuotationData } from "../_components/types";
import {
  buildPagesFromQuotation,
  interpolate,
} from "./template-data";
import { elementRole } from "./element-role";

function quotation(overrides: Partial<QuotationData> = {}): QuotationData {
  return {
    companyName: "Acme",
    customerName: "Wile E.",
    representativeName: "Rep Name",
    representativePhone: "111",
    representativePhoneExtension: "22",
    representativeCellphone: "333",
    representativeEmail: "rep@acme.test",
    products: [],
    ...overrides,
  };
}

function product(overrides: Partial<Product> = {}): Product {
  return {
    name: "Widget",
    reference: "tx-10",
    price: "$ 1.000",
    description: "A widget",
    imageUrl: null,
    variants: [],
    ...overrides,
  };
}

describe("interpolate", () => {
  it("substitutes quotation-level placeholders", () => {
    expect(
      interpolate("{{companyName}} / {{customerName}}", quotation()),
    ).toBe("Acme / Wile E.");
    expect(interpolate("{{representativeEmail}}", quotation())).toBe(
      "rep@acme.test",
    );
  });

  it("substitutes product placeholders only when a product is given", () => {
    const withProduct = interpolate(
      "{{productReference}}: {{productDescription}}",
      quotation(),
      product(),
    );
    expect(withProduct).toBe("tx-10: A widget");
    // No product: the product placeholders are left untouched.
    expect(interpolate("{{productReference}}", quotation())).toBe(
      "{{productReference}}",
    );
  });

  it("prefixes the product name with its number when provided", () => {
    expect(
      interpolate("{{productName}}", quotation(), product(), undefined, 2),
    ).toBe("2. Widget");
    // Without a number, no prefix.
    expect(interpolate("{{productName}}", quotation(), product())).toBe(
      "Widget",
    );
  });
});

describe("buildPagesFromQuotation", () => {
  it("builds one product page per product plus a final policies page", () => {
    const pages = buildPagesFromQuotation(
      quotation({ products: [product({ reference: "a" }), product({ reference: "b" })] }),
    );
    expect(pages).toHaveLength(3); // 2 products + policies
    expect(pages.map((p) => p.pageNumber)).toEqual([1, 2, 3]);
    // Final page carries the policies-body element (by role).
    const lastPage = pages.at(-1)!;
    expect(
      lastPage.elements.some((e) => elementRole(e) === "policies-body"),
    ).toBe(true);
  });

  it("tags product elements with their roles and interpolates product data", () => {
    const pages = buildPagesFromQuotation(
      quotation({ products: [product({ name: "Gadget", reference: "ref-9" })] }),
    );
    const firstPage = pages[0]!;
    const nameEl = firstPage.elements.find(
      (e) => elementRole(e) === "product-name",
    );
    const refEl = firstPage.elements.find(
      (e) => elementRole(e) === "product-reference",
    );
    // Product number 1 is prefixed onto the name.
    expect(nameEl?.text).toContain("1. Gadget");
    expect(refEl?.text).toContain("ref-9");
  });

  it("renders a header-only first page plus policies for an empty quotation", () => {
    const pages = buildPagesFromQuotation(quotation({ products: [] }));
    expect(pages).toHaveLength(2); // header-only page 1 + policies
    expect(pages[0]!.id).toBe("page-1");
    expect(
      pages[1]!.elements.some((e) => elementRole(e) === "policies-body"),
    ).toBe(true);
  });
});
