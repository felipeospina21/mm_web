'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'

interface ActionsMenuProps {
  canUndo: boolean
  canRedo: boolean
  onUndo: () => void
  onRedo: () => void
  onAddElement: (type: 'text' | 'rect' | 'table' | 'image') => void
}

const ITEM_CLASS =
  'block w-full rounded px-3 py-1.5 text-left text-sm text-neutral-700 hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-50'

/**
 * Collapsible "Actions" dropdown for the editor toolbar. Groups the
 * undo/redo and add-element options (plus a link back to the catalog to
 * add products) behind a single toggle so the toolbar stays slim.
 */
export function ActionsMenu({
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onAddElement,
}: ActionsMenuProps) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement | null>(null)

  // Close on outside click or Escape.
  useEffect(() => {
    if (!open) return
    const onDocClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDocClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="flex items-center gap-1.5 rounded border border-neutral-300 bg-neutral-100 px-3 py-1.5 text-sm hover:bg-neutral-200"
      >
        Actions
        <svg
          className={`h-3.5 w-3.5 transition-transform ${open ? 'rotate-180' : ''}`}
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden="true"
        >
          <path
            fillRule="evenodd"
            d="M5.23 7.21a.75.75 0 011.06.02L10 11.17l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
            clipRule="evenodd"
          />
        </svg>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-20 mt-2 w-48 rounded-lg border border-neutral-200 bg-white p-1.5 shadow-lg"
        >
          <button
            type="button"
            role="menuitem"
            className={ITEM_CLASS}
            onClick={onUndo}
            disabled={!canUndo}
          >
            Undo
          </button>
          <button
            type="button"
            role="menuitem"
            className={ITEM_CLASS}
            onClick={onRedo}
            disabled={!canRedo}
          >
            Redo
          </button>

          <div className="my-1 h-px bg-neutral-100" aria-hidden="true" />

          <button
            type="button"
            role="menuitem"
            className={ITEM_CLASS}
            onClick={() => onAddElement('text')}
          >
            + Text
          </button>
          <button
            type="button"
            role="menuitem"
            className={ITEM_CLASS}
            onClick={() => onAddElement('rect')}
          >
            + Shape
          </button>
          <button
            type="button"
            role="menuitem"
            className={ITEM_CLASS}
            onClick={() => onAddElement('table')}
          >
            + Table
          </button>
          <button
            type="button"
            role="menuitem"
            className={ITEM_CLASS}
            onClick={() => onAddElement('image')}
          >
            + Image
          </button>

          <div className="my-1 h-px bg-neutral-100" aria-hidden="true" />

          <Link href="/" className={ITEM_CLASS}>
            + Add products
          </Link>
        </div>
      )}
    </div>
  )
}
