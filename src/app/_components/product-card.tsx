'use client'

import { useEffect, useState } from 'react'
import {
  addQuotationProduct,
  getQuotationProducts,
  removeQuotationProduct,
  STORAGE_EVENT,
  type QuotationProduct,
} from '@/lib/quotation-selection'

export interface ProductVariantView {
  id: string
  colorName: string
  colorHex: string
  stock: number
  packaging: string | null
}

export interface CatalogProduct {
  id: string
  name: string
  reference: string
  description: string | null
  price: string
  imageUrl: string | null
  variants: {
    id: string
    colorName: string
    colorHex: string
    stock: number
    packaging: string | null
  }[]
}

export function ProductCard({ product }: { product: CatalogProduct }) {
  const [isAdded, setIsAdded] = useState(false)

  // Keep the toggle in sync with the shared selection (e.g. after
  // navigating back from the editor).
  useEffect(() => {
    const sync = () => {
      setIsAdded(
        getQuotationProducts().some((p) => p.id === product.id),
      )
    }
    sync()
    window.addEventListener(STORAGE_EVENT, sync)
    return () => window.removeEventListener(STORAGE_EVENT, sync)
  }, [product.id])

  const handleToggle = () => {
    const quotationProduct: QuotationProduct = {
      id: product.id,
      name: product.name,
      reference: product.reference,
      price: product.price,
      description: product.description ?? '',
      variants: product.variants.map((variant) => ({
        id: variant.id,
        colorName: variant.colorName,
        colorHex: variant.colorHex,
        stock: variant.stock,
        packaging: variant.packaging,
      })),
    }
    if (isAdded) {
      removeQuotationProduct(product.id)
      setIsAdded(false)
    } else {
      addQuotationProduct(quotationProduct)
      setIsAdded(true)
    }
  }

  return (
    <article className="flex flex-col overflow-hidden rounded-2xl bg-white shadow-lg">
      {product.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={product.imageUrl}
          alt={product.name}
          className="h-44 w-full object-cover"
        />
      ) : (
        <div className="h-44 w-full bg-neutral-200" />
      )}

      <div className="flex flex-1 flex-col gap-3 p-5">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-lg font-semibold text-neutral-900">
            {product.name}
          </h3>
          <span className="shrink-0 text-lg font-bold text-[#1f4e79]">
            {product.price}
          </span>
        </div>

        <p className="text-sm leading-relaxed text-neutral-600">
          {product.description}
        </p>

        <div className="mt-auto space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
            Color variants
          </p>
          <ul className="flex flex-col gap-1.5">
            {product.variants.map((variant) => (
              <li
                key={variant.id}
                className="flex items-center gap-2 rounded-lg bg-neutral-50 px-2.5 py-1.5 text-sm"
              >
                <span
                  className="h-4 w-4 shrink-0 rounded-full border border-neutral-300"
                  style={{ backgroundColor: variant.colorHex }}
                  title={variant.colorName}
                  aria-hidden="true"
                />
                <span className="font-medium text-neutral-800">
                  {variant.colorName}
                </span>
                <span className="ml-auto text-neutral-500">
                  {variant.stock > 0 ? (
                    <>
                      {variant.stock} in stock
                      {variant.packaging ? ` · ${variant.packaging}` : ''}
                    </>
                  ) : (
                    <span className="text-red-500">Out of stock</span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <button
          onClick={handleToggle}
          className={
            isAdded
              ? 'mt-auto rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700'
              : 'mt-auto rounded-lg bg-[#1f4e79] px-4 py-2 text-sm font-semibold text-white hover:bg-[#16405f]'
          }
        >
          {isAdded ? 'Added ✓' : 'Add'}
        </button>
      </div>
    </article>
  )
}
