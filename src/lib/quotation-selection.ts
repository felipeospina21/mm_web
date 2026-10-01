/**
 * Client-side store for the products the user picked on the home page
 * for the current quotation. Persisted in sessionStorage so the
 * selection survives navigation between the catalog and the editor.
 */

export interface QuotationProduct {
  id: string
  name: string
  price: string
  description: string
}

const STORAGE_KEY = "mm_quotation_products";
export const STORAGE_EVENT = "mm_quotation_products_changed";

function readAll(): QuotationProduct[] {
  if (typeof window === "undefined") return []
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as QuotationProduct[]) : []
  } catch {
    return []
  }
}

function writeAll(products: QuotationProduct[]) {
  window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(products))
  window.dispatchEvent(new Event(STORAGE_EVENT))
}

export function getQuotationProducts(): QuotationProduct[] {
  return readAll()
}

export function addQuotationProduct(product: QuotationProduct): void {
  const products = readAll()
  if (products.some((p) => p.id === product.id)) return
  writeAll([...products, product])
}

export function removeQuotationProduct(id: string): void {
  writeAll(readAll().filter((p) => p.id !== id))
}

export function clearQuotationProducts(): void {
  writeAll([])
}
