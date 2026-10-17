/**
 * Client-side store for the products the user picked on the home page
 * for the current quotation. Persisted in sessionStorage so the
 * selection survives navigation between the catalog and the editor.
 */

/** A color variant with local, zone, and combined inventory amounts. */
export interface QuotationProductVariant {
  id: string;
  colorName: string;
  colorHex: string;
  localInventory: number;
  zoneInventory: number;
  stock: number;
  packaging: string | null;
}

export interface QuotationProduct {
  id: string;
  name: string;
  /** Product reference / catalog code, e.g. "tx-10". */
  reference: string;
  price: string;
  description: string;
  categories?: string[];
  /** First product image URL (main image), when the source provides one. */
  imageUrl?: string | null;
  /** Color variants (inventory + packaging) captured when the product was picked. */
  variants: QuotationProductVariant[];
}

const STORAGE_KEY = "mm_quotation_products";
export const STORAGE_EVENT = "mm_quotation_products_changed";

function readAll(): QuotationProduct[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as QuotationProduct[];
    // Selections saved before variants existed have no `variants` field;
    // normalize so consumers can always rely on it being an array.
    return parsed.map((product) => ({
      ...product,
      variants: (product.variants ?? []).map((variant) => ({
        ...variant,
        localInventory: variant.localInventory ?? variant.stock,
        zoneInventory: variant.zoneInventory ?? 0,
      })),
    }));
  } catch {
    return [];
  }
}

function writeAll(products: QuotationProduct[]) {
  window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(products));
  window.dispatchEvent(new Event(STORAGE_EVENT));
}

export function getQuotationProducts(): QuotationProduct[] {
  return readAll();
}

export function addQuotationProduct(product: QuotationProduct): void {
  const products = readAll();
  if (products.some((p) => p.id === product.id)) return;
  writeAll([...products, product]);
}

export function removeQuotationProduct(id: string): void {
  writeAll(readAll().filter((p) => p.id !== id));
}

export function clearQuotationProducts(): void {
  writeAll([]);
}
