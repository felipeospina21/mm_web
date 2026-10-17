import type {
  PageData,
  Product,
  QuotationData,
  TemplateElement,
} from "./types";
import { proxiedImageUrl } from "@/lib/product-image";
import { theme } from "@/lib/theme";
import { formatQuotationFooter } from "@/lib/company-profile";
import { defaultLocale, t, type Locale } from "@/i18n/messages";

/** Shared logo with fixed geometry across all quotation pages. */
function makeDocTitle(id: string): TemplateElement {
  return {
    id,
    type: "image",
    x: 40,
    y: 20,
    width: 336,
    height: 66,
    text: "",
    fontSize: 0,
    fill: "#000000",
    isDraggable: false,
    src: "/mmedios_logo.jpg",
  };
}

function makeFirstPageHeader(locale: Locale): TemplateElement[] {
  return [
    makeDocTitle("doc-title"),
    {
      id: "customer-name",
      type: "text",
      x: 40,
      y: 100,
      width: 500,
      height: 30,
      text: t("template.customer", { name: "{{customerName}}" }, locale),
      fontSize: 18,
      fill: "#333333",
      isDraggable: false,
      isEditable: false,
    },
    {
      id: "company-name",
      type: "text",
      x: 40,
      y: 130,
      width: 300,
      height: 110,
      text: "{{companyName}}",
      fontSize: 18,
      fill: "#000000",
      isDraggable: false,
      isEditable: false,
    },
    {
      id: "date",
      type: "text",
      x: 460,
      y: 20,
      width: 350,
      height: 60,
      text: (() => {
        const parts = new Intl.DateTimeFormat("es-CO", {
          day: "numeric",
          month: "long",
          year: "numeric",
        }).formatToParts(new Date());
        const part = (type: Intl.DateTimeFormatPartTypes) =>
          parts.find((item) => item.type === type)?.value ?? "";
        return `${part("day")} ${part("month")} de ${part("year")}`;
      })(),
      fontSize: 18,
      fill: "#000000",
      isDraggable: false,
      isEditable: false,
    },
    {
      id: "quotation-number",
      type: "text",
      x: 460,
      y: 50,
      width: 350,
      height: 60,
      text: `${t("template.quotation", { number: "{{quotationNumber}}" }, locale)}`,
      fontSize: 18,
      fill: "#000000",
      isDraggable: false,
      isEditable: false,
    },
    {
      id: "representative-info",
      type: "text",
      x: 460,
      y: 100,
      width: 350,
      height: 115,
      text: `${t("template.representative", {}, locale)} \n{{representativeName}}\n{{representativePhone}}\n{{representativeEmail}}`,
      fontSize: 14,
      fill: "#000000",
      isDraggable: false,
      isEditable: false,
    },
  ];
}

/** Product block: name, price, description (used on pages 1..n-1) */
function makeProductElements(
  suffix: string,
  verticalOffset = 0,
  locale: Locale = defaultLocale,
): TemplateElement[] {
  return [
    {
      id: `product-name-${suffix}`,
      type: "text",
      x: 40,
      y: 220 + verticalOffset,
      width: 600,
      height: 40,
      text: "{{productName}}",
      fontSize: 24,
      fill: theme.colors.primary,
      isDraggable: true,
      isEditable: true,
    },
    {
      id: `product-reference-${suffix}`,
      type: "text",
      x: 40,
      y: 262 + verticalOffset,
      width: 400,
      height: 20,
      text: t(
        "template.reference",
        { reference: "{{productReference}}" },
        locale,
      ),
      fontSize: 12,
      fill: theme.colors.secondary,
      isDraggable: true,
    },
    {
      id: `product-description-${suffix}`,
      type: "text",
      x: 40,
      y: 290 + verticalOffset,
      width: 700,
      height: 120,
      text: "{{productDescription}}",
      fontSize: 16,
      fill: "#555555",
      isDraggable: true,
      isEditable: true,
    },
    {
      id: `line-items-${suffix}`,
      type: "table",
      x: 40,
      y: 420 + verticalOffset,
      width: 714,
      height: 150,
      text: "",
      fontSize: 0,
      fill: "#000000",
      isDraggable: true,
      isEditable: true,
      table: {
        colWidths: [80, 300, 120, 120],
        rowHeight: 36,
        cells: [
          [
            t("template.quantity", {}, locale),
            t("template.marking", {}, locale),
            t("template.detail", {}, locale),
            t("template.unitPrice", {}, locale),
          ],
          ["", "", "", ""],
          ["", "", "", ""],
          ["", "", "", ""],
        ],
        headerFill: theme.colors.primary,
        headerColor: "#ffffff",
        borderColor: "#cccccc",
        fontSize: 13,
      },
    },
    {
      // Product image (bottom-right of the product block). `src` is filled in
      // per-product by buildPagesFromQuotation; empty renders a placeholder.
      id: `product-image-${suffix}`,
      type: "image",
      x: 360,
      y: 650 + verticalOffset,
      width: 400,
      height: 400,
      text: "",
      fontSize: 0,
      fill: "#000000",
      isDraggable: true,
      isEditable: true,
      src: "",
    },
  ];
}

/** Footer used on every page */
function makeFooter(): TemplateElement[] {
  return [
    {
      id: "footer",
      type: "text",
      x: 40,
      y: 1040,
      width: 714,
      height: 64,
      text: "{{quotationFooter}}",
      fontSize: 10,
      lineHeight: 1.8,
      fill: "#999999",
      isDraggable: false,
    },
  ];
}

/**
 * First page: company + client header. When `withProduct` is true the
 * first product block is included (used once products are added);
 * otherwise it is just the header + footer (initial empty quotation).
 */
function makeFirstPageElements(
  withProduct: boolean,
  locale: Locale,
): TemplateElement[] {
  return [
    ...makeFirstPageHeader(locale),
    ...(withProduct ? makeProductElements("p1", 0, locale) : []),
    ...makeFooter(),
  ];
}

/** Middle pages (products 2..n-1): logo, continuation band, and product block. */
function makeProductPageElements(
  suffix: string,
  locale: Locale,
): TemplateElement[] {
  return [
    makeDocTitle(`doc-title-${suffix}`),
    // These pages have only a 50px title band, so move the product content
    // up to use the space that the first page's company header occupies.
    ...makeProductElements(suffix, -120, locale),
    ...makeFooter(),
  ];
}

/**
 * Last page: fixed commercial policies, no product info.
 */
function makePoliciesPageElements(): TemplateElement[] {
  return [
    makeDocTitle("doc-title-policies"),
    {
      id: "policies-body",
      type: "image",
      x: 40,
      y: 100,
      width: 700,
      height: 736,
      text: "",
      fontSize: 14,
      fill: "#444444",
      isDraggable: true,
      src: "/comercial_policy.jpg",
    },
    ...makeFooter(),
  ];
}

/** Replaces all placeholders in a text string with quotation values */
function interpolate(
  text: string,
  quotation: QuotationData,
  product?: QuotationData["products"][number],
  locale: Locale = defaultLocale,
  productNumber?: number,
): string {
  let result = text
    .replaceAll("{{companyName}}", quotation.companyName)
    .replaceAll("{{customerName}}", quotation.customerName)
    .replaceAll("{{representativeName}}", quotation.representativeName)
    .replaceAll("{{representativePhone}}", quotation.representativePhone)
    .replaceAll("{{representativeEmail}}", quotation.representativeEmail);

  result = result.replaceAll(
    "{{quotationFooter}}",
    formatQuotationFooter(quotation, locale),
  );

  if (product) {
    result = result
      .replaceAll(
        "{{productName}}",
        `${productNumber ?? ""}${productNumber ? ". " : ""}${product.name}`,
      )
      .replaceAll("{{productReference}}", product.reference)
      .replaceAll("{{productPrice}}", product.price)
      .replaceAll("{{productDescription}}", product.description);
  }

  return result;
}

/**
 * Builds the inventory table for a single product: one row per color
 * variant, showing stock and packaging. Rendered as a small table in the
 * bottom-left of that product's page (draggable, like the line-items table).
 */
export function buildInventoryTable(
  product: Product,
  suffix: string,
  verticalOffset = 0,
  locale: Locale = defaultLocale,
): TemplateElement {
  const colWidths = [140, 70, 70];
  const rowHeight = 22;
  const fontSize = 10;

  const variants = product.variants ?? [];
  const cells: string[][] = [
    [
      t("template.inventoryColor", {}, locale),
      t("template.inventoryLocal", {}, locale),
      t("template.inventoryZone", {}, locale),
    ],
  ];

  if (variants.length === 0) {
    cells.push(["—", "—", "—"]);
  } else {
    const consultationOnly = product.categories?.some(
      (category) =>
        category.trim().toLocaleLowerCase() === "produccion nacional",
    );
    for (const variant of variants) {
      cells.push([
        variant.colorName,
        consultationOnly &&
        variant.localInventory === 0 &&
        variant.zoneInventory === 0
          ? t("template.inventoryConsultAdvisor", {}, locale)
          : variant.localInventory.toLocaleString(
              locale === "es" ? "es-CO" : "en-US",
            ),
        consultationOnly &&
        variant.localInventory === 0 &&
        variant.zoneInventory === 0
          ? ""
          : variant.zoneInventory.toLocaleString(
              locale === "es" ? "es-CO" : "en-US",
            ),
      ]);
    }
  }

  return {
    id: `inventory-${suffix}`,
    type: "table",
    x: 40,
    y: 600 + verticalOffset,
    width: colWidths.reduce((a, b) => a + b, 0),
    height: rowHeight * cells.length,
    text: "",
    fontSize,
    fill: "#333333",
    table: {
      colWidths,
      rowHeight,
      cells,
      headerFill: "#eef2f7",
      headerColor: theme.colors.primary,
      borderColor: "#c9d2dc",
      fontSize,
    },
    isDraggable: true,
    isEditable: false,
    isDeletable: true,
    isRowDeletable: true,
  };
}

/** Build a blank product page while keeping each product field editable. */
export function makeEmptyProductPage(
  pageNumber: number,
  quotation: QuotationData,
  locale: Locale = defaultLocale,
): PageData {
  const suffix = `p${pageNumber}`;
  const productElements = makeProductElements(suffix, -120, locale).map(
    (element) => ({
      ...element,
      text: "",
      ...(element.table
        ? {
            table: {
              ...element.table,
              cells: element.table.cells.map((row) => row.map(() => "")),
            },
          }
        : {}),
    }),
  );

  const inventory = buildInventoryTable(
    { name: "", reference: "", price: "", description: "", variants: [] },
    suffix,
    -120,
    locale,
  );
  if (inventory.table) {
    inventory.table = {
      ...inventory.table,
      cells: inventory.table.cells.map((row) => row.map(() => "")),
    };
  }

  return {
    id: `page-${pageNumber}`,
    pageNumber,
    elements: [
      makeDocTitle(`doc-title-${suffix}`),
      ...productElements,
      inventory,
      ...makeFooter().map((footer) => ({
        ...footer,
        text: formatQuotationFooter(quotation, locale),
      })),
    ],
  };
}

/**
 * Builds a single product page (middle page: logo + product block + inventory table + footer).
 */
export function buildProductPage(
  product: Product,
  quotation: QuotationData,
  pageNumber: number,
  productNumber: number,
  locale: Locale = defaultLocale,
): PageData {
  const suffix = `p${pageNumber}`;
  const baseElements = makeProductPageElements(suffix, locale);

  const pageElements = baseElements.map((el) => {
    const next: TemplateElement = {
      ...el,
      text: interpolate(el.text, quotation, product, locale, productNumber),
    };
    if (next.table) {
      next.table = {
        ...next.table,
        cells: next.table.cells.map((row) =>
          row.map((cell) =>
            interpolate(cell, quotation, product, locale, productNumber),
          ),
        ),
      };
    }
    if (next.type === "image" && next.id.startsWith("product-image-")) {
      next.src = proxiedImageUrl(product.imageUrl);
    }
    return next;
  });

  pageElements.push(buildInventoryTable(product, suffix, -120, locale));

  return {
    id: `page-${pageNumber}`,
    pageNumber,
    elements: pageElements,
  };
}

/**
 * Builds the full page set from a quotation:
 *  - Page 1: header (company + client) + first product (header only if
 *    the quotation has no products yet)
 *  - Pages 2..n: one product per page
 *  - Last page: commercial policies
 */
export function buildPagesFromQuotation(
  quotation: QuotationData,
  locale: Locale = defaultLocale,
): PageData[] {
  const pages: PageData[] = [];

  quotation.products.forEach((product, index) => {
    if (!product) return;
    const pageNumber = pages.length + 1;

    if (index === 0) {
      const baseElements = makeFirstPageElements(true, locale);

      const pageElements = baseElements.map((el) => {
        const next: TemplateElement = {
          ...el,
          text: interpolate(el.text, quotation, product, locale, index + 1),
        };
        // Placeholders inside table cells too
        if (next.table) {
          next.table = {
            ...next.table,
            cells: next.table.cells.map((row) =>
              row.map((cell) =>
                interpolate(cell, quotation, product, locale, index + 1),
              ),
            ),
          };
        }
        // Fill the product image element's src from the product (image src
        // can't be interpolated via {{...}} text placeholders). Route external
        // URLs through our same-origin proxy so they load despite missing CORS
        // headers and keep the canvas exportable to PDF.
        if (next.type === "image" && next.id.startsWith("product-image-")) {
          next.src = proxiedImageUrl(product.imageUrl);
        }
        return next;
      });

      // Each product page carries its own inventory table (one row per
      // variant) in the bottom-left.
      pageElements.push(
        buildInventoryTable(product, `p${pageNumber}`, 0, locale),
      );

      pages.push({
        id: `page-${pageNumber}`,
        pageNumber,
        elements: pageElements,
      });
    } else {
      pages.push(
        buildProductPage(product, quotation, pageNumber, index + 1, locale),
      );
    }
  });

  // Empty quotation: header-only first page
  if (quotation.products.length === 0) {
    const elements = makeFirstPageElements(false, locale).map((element) => ({
      ...element,
      text: interpolate(element.text, quotation, undefined, locale),
    }));
    pages.push({
      id: "page-1",
      pageNumber: 1,
      elements,
    });
  }

  // Final policies page
  const policiesPageNumber = pages.length + 1;
  pages.push({
    id: `page-${policiesPageNumber}`,
    pageNumber: policiesPageNumber,
    elements: makePoliciesPageElements(),
  });

  return pages;
}

/** Add the standard logo to pages in quotations saved before it was repeated. */
export function ensurePageLogos(pages: PageData[]): PageData[] {
  return pages.map((page) => {
    const hasLogo = page.elements.some((element) =>
      element.id.startsWith("doc-title"),
    );
    const elements = page.elements.map((element) => {
      if (element.id === "footer") {
        return { ...element, lineHeight: 1.5 };
      }
      if (element.id === "page-title" || element.id === "policies-title") {
        return { ...element, x: 400, y: 38, width: 390 };
      }
      if (element.id.startsWith("doc-title")) {
        return { ...element, x: 40, y: 20, width: 336, height: 66 };
      }
      return element;
    });

    if (!hasLogo) {
      const id =
        page.pageNumber === 1
          ? "doc-title"
          : `doc-title-page-${page.pageNumber}`;
      elements.push(makeDocTitle(id));
    }
    return { ...page, elements };
  });
}

/** Initial quotation: header page + policies, optionally with empty item fields on page one. */
export function makeEmptyQuotationPages(
  locale: Locale = defaultLocale,
  includeEmptyItemsOnFirstPage = false,
): PageData[] {
  if (!includeEmptyItemsOnFirstPage) {
    return buildPagesFromQuotation(
      { ...DUMMY_QUOTATION, products: [] },
      locale,
    );
  }

  const quotation = { ...DUMMY_QUOTATION, products: [] };
  const pages = buildPagesFromQuotation(quotation, locale);
  const firstPage = pages[0];
  if (!firstPage) return pages;

  const elements = makeFirstPageElements(true, locale).map((element) => {
    const isProductField =
      element.id.startsWith("product-") || element.id.startsWith("line-items-");
    if (isProductField) {
      return {
        ...element,
        text: "",
        ...(element.table
          ? {
              table: {
                ...element.table,
                cells: element.table.cells.map((row) => row.map(() => "")),
              },
            }
          : {}),
      };
    }
    return {
      ...element,
      text: interpolate(element.text, quotation, undefined, locale),
    };
  });
  const inventory = buildInventoryTable(
    { name: "", reference: "", price: "", description: "", variants: [] },
    "p1",
    0,
    locale,
  );
  if (inventory.table) {
    inventory.table = {
      ...inventory.table,
      cells: inventory.table.cells.map((row) => row.map(() => "")),
    };
  }
  const footerIndex = elements.findIndex((element) => element.id === "footer");
  elements.splice(
    footerIndex < 0 ? elements.length : footerIndex,
    0,
    inventory,
  );

  return pages.map((page) =>
    page.id === firstPage.id ? { ...page, elements } : page,
  );
}

/** Master template shown before products are added */
export function makeMasterTemplate(locale: Locale = defaultLocale): PageData {
  return {
    id: "page-template",
    pageNumber: 1,
    elements: makeFirstPageElements(false, locale),
  };
}

export const DUMMY_QUOTATION: Omit<QuotationData, "products"> = {
  companyName: "",
  customerName: "",
  representativeName: "",
  representativePhone: "",
  representativePhoneExtension: "",
  representativeCellphone: "",
  representativeEmail: "",
};
