'use client'

import type { PageData, TemplateElement } from './types'

interface FloatingToolbarProps {
  pages: PageData[]
  selectedId: string
  onElementChange: (
    pageId: string,
    elementId: string,
    patch: Partial<TemplateElement>,
  ) => void
  onDeleteElement: (elementId: string) => void
  onDuplicateElement: (elementId: string) => void
}

const FONT_SIZES = [10, 12, 14, 16, 18, 20, 24, 28, 32, 36, 48]
const FONT_FAMILIES = [
  'Arial',
  'Helvetica',
  'Times New Roman',
  'Georgia',
  'Courier New',
  'Verdana',
  'system-ui',
]

/**
 * Floating toolbar shown when an element is selected.
 * - Text: font family, size, bold/italic/underline, color
 * - Image: file upload (stored as data URL)
 * - Table: add/remove row/column
 * - All: duplicate / delete
 */
export default function FloatingToolbar({
  pages,
  selectedId,
  onElementChange,
  onDeleteElement,
  onDuplicateElement,
}: FloatingToolbarProps) {
  const page = pages.find((p) => p.elements.some((el) => el.id === selectedId))
  const element = page?.elements.find((el) => el.id === selectedId)
  if (!page || !element) return null

  const patch = (p: Partial<TemplateElement>) =>
    onElementChange(page.id, element.id, p)

  const isText = element.type === 'text'
  const isTable = element.type === 'table' && element.table
  const isImage = element.type === 'image'

  const handleImageUpload = (file: File | undefined) => {
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        patch({ src: reader.result })
      }
    }
    reader.readAsDataURL(file)
  }

  const addRow = () => {
    if (!element.table) return
    const cols = element.table.cells[0]?.length ?? 0
    patch({
      table: {
        ...element.table,
        cells: [...element.table.cells, Array.from({ length: cols }, () => '')],
      },
    })
  }

  const removeRow = () => {
    if (!element.table || element.table.cells.length <= 1) return
    patch({
      table: {
        ...element.table,
        cells: element.table.cells.slice(0, -1),
      },
    })
  }

  const addColumn = () => {
    if (!element.table) return
    patch({
      table: {
        ...element.table,
        colWidths: [...element.table.colWidths, 120],
        cells: element.table.cells.map((row) => [...row, '']),
      },
    })
  }

  const removeColumn = () => {
    if (!element.table || element.table.colWidths.length <= 1) return
    patch({
      table: {
        ...element.table,
        colWidths: element.table.colWidths.slice(0, -1),
        cells: element.table.cells.map((row) => row.slice(0, -1)),
      },
    })
  }

  return (
    <div
      className="fixed left-1/2 top-16 z-40 flex -translate-x-1/2 items-center gap-2 rounded-md bg-white px-2.5 py-1.5 shadow-[0_2px_10px_rgba(0,0,0,0.35)]"
      onMouseDown={(e) => e.stopPropagation()}
    >
      {isText && (
        <>
          <label className="flex items-center gap-1 text-xs text-neutral-700">
            Font
            <select
              value={element.fontFamily ?? 'Arial'}
              onChange={(e) => patch({ fontFamily: e.target.value })}
              className="ml-1 rounded border border-neutral-300 px-1 py-0.5"
            >
              {FONT_FAMILIES.map((family) => (
                <option key={family} value={family}>
                  {family}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-1 text-xs text-neutral-700">
            Size
            <select
              value={element.fontSize}
              onChange={(e) => patch({ fontSize: Number(e.target.value) })}
              className="ml-1 rounded border border-neutral-300 px-1 py-0.5"
            >
              {FONT_SIZES.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </label>
          <button
            className={`h-7 w-7 rounded border border-neutral-300 bg-neutral-100 text-[13px] ${
              element.fontWeight === 'bold' ? 'font-extrabold' : 'font-normal'
            }`}
            title="Bold"
            onClick={() =>
              patch({
                fontWeight: element.fontWeight === 'bold' ? 'normal' : 'bold',
              })
            }
          >
            B
          </button>
          <button
            className={`h-7 w-7 rounded border border-neutral-300 bg-neutral-100 text-[13px] ${
              element.italic ? 'italic' : ''
            }`}
            title="Italic"
            onClick={() => patch({ italic: !element.italic })}
          >
            I
          </button>
          <button
            className={`h-7 w-7 rounded border border-neutral-300 bg-neutral-100 text-[13px] ${
              element.underline ? 'underline' : ''
            }`}
            title="Underline"
            onClick={() => patch({ underline: !element.underline })}
          >
            U
          </button>
          <label className="flex items-center gap-1 text-xs text-neutral-700">
            Color
            <input
              type="color"
              value={element.fill}
              onChange={(e) => patch({ fill: e.target.value })}
              className="h-6 w-8 cursor-pointer border-none bg-transparent"
            />
          </label>
        </>
      )}

      {isImage && (
        <label className="flex items-center gap-1 text-xs text-neutral-700">
          Image
          <input
            type="file"
            accept="image/*"
            onChange={(e) => handleImageUpload(e.target.files?.[0])}
            className="text-[11px]"
          />
        </label>
      )}

      {isTable && (
        <>
          <span className="text-xs text-neutral-700">Table</span>
          <button
            className="h-7 rounded border border-neutral-300 bg-neutral-100 px-2.5 text-xs"
            onClick={() => addRow()}
            title="Add row"
          >
            + Row
          </button>
          <button
            className="h-7 rounded border border-neutral-300 bg-neutral-100 px-2.5 text-xs"
            onClick={() => removeRow()}
            title="Remove last row"
          >
            − Row
          </button>
          <button
            className="h-7 rounded border border-neutral-300 bg-neutral-100 px-2.5 text-xs"
            onClick={() => addColumn()}
            title="Add column"
          >
            + Col
          </button>
          <button
            className="h-7 rounded border border-neutral-300 bg-neutral-100 px-2.5 text-xs"
            onClick={() => removeColumn()}
            title="Remove last column"
          >
            − Col
          </button>
        </>
      )}

      <span className="h-5 w-px bg-neutral-200" />

      <button
        className="h-7 rounded border border-neutral-300 bg-neutral-100 px-2.5 text-xs"
        title="Duplicate (Ctrl+D)"
        onClick={() => onDuplicateElement(element.id)}
      >
        Duplicate
      </button>
      <button
        className="h-7 rounded border border-neutral-300 bg-neutral-100 px-2.5 text-xs text-red-700"
        title="Delete (Del)"
        onClick={() => onDeleteElement(element.id)}
      >
        Delete
      </button>
    </div>
  )
}
