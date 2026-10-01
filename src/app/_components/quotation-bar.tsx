'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import {
  getQuotationProducts,
  STORAGE_EVENT,
} from '@/lib/quotation-selection'

/**
 * Floating bar shown on the catalog once the user has picked at least
 * one product, linking to the quotation editor.
 */
export function QuotationBar() {
  const [count, setCount] = useState(0)

  useEffect(() => {
    const sync = () => setCount(getQuotationProducts().length)
    sync()
    window.addEventListener(STORAGE_EVENT, sync)
    return () => window.removeEventListener(STORAGE_EVENT, sync)
  }, [])

  if (count === 0) return null

  return (
    <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2">
      <a
        href="/editor"
        className="flex items-center gap-3 rounded-full bg-[#1f4e79] px-6 py-3 text-sm font-semibold text-white shadow-2xl transition hover:bg-[#16405f]"
      >
        <span>
          {count} {count === 1 ? 'product' : 'products'} selected
        </span>
        <span className="h-4 w-px bg-white/30" aria-hidden="true" />
        <span>Go to quotation →</span>
      </a>
    </div>
  )
}
