'use client'

import dynamic from 'next/dynamic'
import { useCallback, useEffect, useRef, useState } from 'react'
import type Konva from 'konva'
import { exportPagesToPdf } from './_components/pdf-export'
import { buildPagesFromQuotation, makeEmptyQuotationPages, DUMMY_QUOTATION } from './_components/template-data'
import type { PageData, QuotationData, TemplateElement } from './_components/types'
import { ActionsMenu } from './_components/actions-menu'
import {
  getQuotationProducts,
  type QuotationProduct,
} from '@/lib/quotation-selection'
import { api } from '@/trpc/react'

// Konva touches `window` at import time, so the canvas is loaded
// client-side only.
const QuotationCanvas = dynamic(
  () => import('./_components/quotation-canvas'),
  { ssr: false },
)

export default function EditorPage() {
  const [canUndo, setCanUndo] = useState(false)
  const [canRedo, setCanRedo] = useState(false)
  // Unsaved-changes flag: true after any edit, cleared on successful save.
  const [isDirty, setIsDirty] = useState(false)

  /** Push a new state snapshot onto the history stack */
  const commitHistory = useCallback((next: PageData[]) => {
    // Drop any redo tail, then append
    historyIndexRef.current += 1
    historyRef.current = historyRef.current.slice(0, historyIndexRef.current)
    historyRef.current.push(next)
    setCanUndo(true)
    setCanRedo(false)
  }, [])

  const setPagesWithHistory = useCallback(
    (updater: PageData[] | ((prev: PageData[]) => PageData[])) => {
      setPages((prev) => {
        const next =
          typeof updater === 'function' ? updater(prev) : updater
        commitHistory(next)
        return next
      })
      // Any edit leaves the quotation with unsaved changes.
      setIsDirty(true)
    },
    [commitHistory],
  )

  const handleUndo = useCallback(() => {
    if (historyIndexRef.current <= 0) return
    historyIndexRef.current -= 1
    const snapshot = historyRef.current[historyIndexRef.current]
    if (!snapshot) return
    setPages(snapshot)
    setCanUndo(historyIndexRef.current > 0)
    setCanRedo(true)
  }, [])

  const handleRedo = useCallback(() => {
    if (historyIndexRef.current >= historyRef.current.length - 1) return
    historyIndexRef.current += 1
    const snapshot = historyRef.current[historyIndexRef.current]
    if (!snapshot) return
    setPages(snapshot)
    setCanUndo(true)
    setCanRedo(historyIndexRef.current < historyRef.current.length - 1)
  }, [])

  const handleStageReady = useCallback((stage: Konva.Stage | null) => {
    stageRef.current = stage
  }, [])

  // Warn before leaving/reloading the tab when there are unsaved changes.
  useEffect(() => {
    if (!isDirty) return
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      // Modern browsers show their own generic message; setting
      // returnValue is what actually triggers the prompt.
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [isDirty])

  /**
   * Builds the initial quotation `meta` (client/company details + the
   * products picked on the home page). Falls back to the dummy header-only
   * quotation when nothing was picked.
   */
  const makeInitialMeta = useCallback((): QuotationData => {
    const picked = getQuotationProducts()
    return {
      ...DUMMY_QUOTATION,
      products: picked.map((product: QuotationProduct) => ({
        name: product.name,
        reference: product.reference,
        price: product.price,
        description: product.description,
        variants: product.variants.map((variant) => ({
          colorName: variant.colorName,
          colorHex: variant.colorHex,
          stock: variant.stock,
          packaging: variant.packaging,
        })),
      })),
    }
  }, [])

  /**
   * Builds the initial quotation pages from the products selected on
   * the home page: header page + first product, one page per additional
   * product, and the fixed policies last page. Falls back to the empty
   * quotation (header page + policies page) when nothing is picked.
   */
  const makeInitialPages = useCallback((): PageData[] => {
    const picked = getQuotationProducts()
    if (picked.length === 0) return makeEmptyQuotationPages()
    return buildPagesFromQuotation(makeInitialMeta())
  }, [makeInitialMeta])

  // Source `meta` for the quotation (client + products). Captured at mount;
  // persisted alongside the edited pages on save.
  const metaRef = useRef<QuotationData>(makeInitialMeta())

  // Initial quotation pages: header page + policies page, plus one page
  // per product picked on the home page.
  const [pages, setPages] = useState<PageData[]>(makeInitialPages)
  const [isExporting, setIsExporting] = useState(false)
  const stageRef = useRef<Konva.Stage | null>(null)

  // Saved identity: null while a draft, { id, quotationNumber } once persisted.
  const [saved, setSaved] = useState<{
    id: string
    quotationNumber: number
  } | null>(null)

  const saveMutation = api.quotation.save.useMutation({
    onSuccess: (result) => {
      setSaved(result)
      setIsDirty(false)
    },
    onError: (error) => {
      console.error('Save failed:', error)
      alert(`Save failed: ${error.message}`)
    },
  })

  const handleSave = useCallback(() => {
    const meta = metaRef.current

    // The client name is edited on the canvas in the first page's
    // "Prepared for:" block (element id `client-info`), which reads
    // "Prepared for:\n<name>\n<address>\n<email>". Take the name line.
    const clientInfo = pages[0]?.elements.find((el) => el.id === 'client-info')
    const nameLine = clientInfo?.text.split('\n')[1]?.trim()
    const metaName = metaRef.current.customerName.trim()
    const clientName =
      nameLine && nameLine.length > 0
        ? nameLine
        : metaName.length > 0
          ? metaName
          : 'Untitled client'

    saveMutation.mutate({
      id: saved?.id,
      clientName,
      // Snapshot of the product reference codes in this quotation.
      references: meta.products.map((p) => p.reference),
      data: { meta, pages },
    })
  }, [saveMutation, saved?.id, pages])

  // ---- Undo/redo history ----
  const historyRef = useRef<PageData[][]>([makeInitialPages()])
  const historyIndexRef = useRef(0)

  /** Persist any element edit (drag, resize, text, formatting) */
  const handleElementChange = useCallback(
    (pageId: string, elementId: string, patch: Partial<TemplateElement>) => {
      setPagesWithHistory((prev) =>
        prev.map((page) => {
          if (page.id !== pageId) return page
          return {
            ...page,
            elements: page.elements.map((el) =>
              el.id === elementId ? { ...el, ...patch } : el,
            ),
          }
        }),
      )
    },
    [setPagesWithHistory],
  )

  /** Delete the selected element */
  const handleDeleteElement = useCallback(
    (elementId: string) => {
      setPagesWithHistory((prev) =>
        prev.map((page) => ({
          ...page,
          elements: page.elements.filter((el) => el.id !== elementId),
        })),
      )
    },
    [setPagesWithHistory],
  )

  /** Duplicate the selected element, offset slightly below the original */
  const handleDuplicateElement = useCallback(
    (elementId: string) => {
      setPagesWithHistory((prev) =>
        prev.map((page) => {
          const source = page.elements.find((el) => el.id === elementId)
          if (!source) return page
          const copy: TemplateElement = {
            ...source,
            id: `${source.id}-copy-${Date.now()}`,
            y: source.y + 30,
          }
          return { ...page, elements: [...page.elements, copy] }
        }),
      )
    },
    [setPagesWithHistory],
  )

  /** Add a new element to the first page */
  const handleAddElement = useCallback(
    (type: 'text' | 'rect' | 'table' | 'image') => {
      const newId = `el-${type}-${Date.now()}`
      const base = {
        id: newId,
        x: 100,
        y: 600,
        width: type === 'rect' ? 200 : 300,
        height: type === 'rect' ? 100 : 40,
        text: type === 'text' ? 'New text' : '',
        fontSize: 16,
        fill: type === 'rect' ? '#1f4e79' : '#333333',
        isDraggable: true,
      }
      const element: TemplateElement =
        type === 'table'
          ? {
              ...base,
              type: 'table',
              width: 400,
              height: 120,
              table: {
                colWidths: [100, 100, 100, 100],
                rowHeight: 30,
                cells: [
                  ['A', 'B', 'C', 'D'],
                  ['', '', '', ''],
                  ['', '', '', ''],
                ],
                headerFill: '#1f4e79',
                headerColor: '#ffffff',
                borderColor: '#cccccc',
                fontSize: 12,
              },
            }
          : type === 'image'
            ? { ...base, type: 'image', src: '' }
            : { ...base, type }

      setPagesWithHistory((prev) =>
        prev.map((page, index) =>
          index === 0 ? { ...page, elements: [...page.elements, element] } : page,
        ),
      )
    },
    [setPagesWithHistory],
  )

  // Track the selected element id via a ref (set by the canvas)
  const selectedIdRef = useRef<string | null>(null)
  const handleSelectionChange = useCallback((id: string | null) => {
    selectedIdRef.current = id
  }, [])

  // Keyboard shortcuts: undo/redo, delete, duplicate
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey
      if (mod && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        if (e.shiftKey) {
          handleRedo()
        } else {
          handleUndo()
        }
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        // Only delete when not typing in an input/textarea
        const tag = (e.target as HTMLElement)?.tagName
        if (tag === 'INPUT' || tag === 'TEXTAREA') return
        if (selectedIdRef.current) {
          e.preventDefault()
          handleDeleteElement(selectedIdRef.current)
        }
      } else if (mod && e.key.toLowerCase() === 'd') {
        e.preventDefault()
        if (selectedIdRef.current) {
          handleDuplicateElement(selectedIdRef.current)
        }
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [handleUndo, handleRedo, handleDeleteElement, handleDuplicateElement])

  const handleExportPdf = useCallback(async () => {
    const stage = stageRef.current
    if (!stage) return
    setIsExporting(true)
    // Let the button state render before the (synchronous) capture work
    await new Promise((resolve) => requestAnimationFrame(() => resolve(null)))
    try {
      exportPagesToPdf(stage, pages, 'quotation.pdf')
    } catch (error) {
      console.error('PDF export failed:', error)
      alert('PDF export failed. See console for details.')
    } finally {
      setIsExporting(false)
    }
  }, [pages])

  return (
    // h-screen minus the 56px global navbar rendered above by the layout,
    // so the editor fills the viewport exactly without the body scrolling.
    <div className="flex h-[calc(100vh-56px)] flex-col">
      {/* Slim editor toolbar. The global navbar (Catalog / Editor / Sign
          out) is rendered above this by the layout, so we only keep the
          editor-specific actions here — collapsed into a dropdown. */}
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-neutral-200 bg-white px-4">
        <div className="flex items-center gap-3">
          <h1 className="text-base font-semibold">Quotation Editor</h1>
          {/* Draft until saved; shows the DB-assigned number once persisted. */}
          {saved ? (
            <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-semibold text-green-800">
              Quotation #{saved.quotationNumber}
            </span>
          ) : (
            <span className="rounded-full bg-neutral-100 px-2.5 py-0.5 text-xs font-semibold text-neutral-500">
              Draft
            </span>
          )}
          {/* Unsaved-changes indicator. */}
          {isDirty && (
            <span className="flex items-center gap-1 text-xs font-medium text-amber-600">
              <span
                className="h-1.5 w-1.5 rounded-full bg-amber-500"
                aria-hidden="true"
              />
              Unsaved changes
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <ActionsMenu
            canUndo={canUndo}
            canRedo={canRedo}
            onUndo={handleUndo}
            onRedo={handleRedo}
            onAddElement={handleAddElement}
          />
          <button
            onClick={handleSave}
            disabled={saveMutation.isPending}
            className="rounded bg-green-600 px-3 py-1.5 text-sm text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saveMutation.isPending
              ? 'Saving…'
              : saved
                ? 'Save'
                : 'Save quotation'}
          </button>
          <button
            onClick={handleExportPdf}
            disabled={isExporting}
            className="rounded bg-[#1f4e79] px-3 py-1.5 text-sm text-white hover:bg-[#16405f] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isExporting ? 'Exporting…' : 'Export to PDF'}
          </button>
        </div>
      </header>

      <div className="min-h-0 flex-1">
        <QuotationCanvas
          pages={pages}
          onElementChange={handleElementChange}
          onStageReady={handleStageReady}
          onDeleteElement={handleDeleteElement}
          onDuplicateElement={handleDuplicateElement}
          onSelectionChange={handleSelectionChange}
        />
      </div>
    </div>
  )
}
