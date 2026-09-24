'use client'

import dynamic from 'next/dynamic'
import { useCallback, useEffect, useRef, useState } from 'react'
import { signOut } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import type Konva from 'konva'
import { exportPagesToPdf } from './_components/pdf-export'
import { buildPagesFromQuotation, DUMMY_QUOTATION, makeMasterTemplate } from './_components/template-data'
import type { PageData, QuotationData, TemplateElement } from './_components/types'

// Konva touches `window` at import time, so the canvas is loaded
// client-side only.
const QuotationCanvas = dynamic(
  () => import('./_components/quotation-canvas'),
  { ssr: false },
)

export default function EditorPage() {
  const router = useRouter()
  // Starts with the master template (one page of placeholders)
  const [pages, setPages] = useState<PageData[]>([makeMasterTemplate()])
  const [isExporting, setIsExporting] = useState(false)
  const stageRef = useRef<Konva.Stage | null>(null)

  // ---- Undo/redo history ----
  const historyRef = useRef<PageData[][]>([[makeMasterTemplate()]])
  const historyIndexRef = useRef(0)
  const [canUndo, setCanUndo] = useState(false)
  const [canRedo, setCanRedo] = useState(false)

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

  /** Log out and return to the login home page */
  const handleSignOut = useCallback(async () => {
    // redirect:false keeps NextAuth from building an absolute URL from the
    // server host (which is 0.0.0.0 in the container). We navigate ourselves.
    await signOut({ redirect: false })
    router.push('/')
    router.refresh()
  }, [router])

  /**
   * "Populate Data": builds the full page set from the quotation —
   * first page with company/client header + first product, one page
   * per additional product, and a fixed commercial-policies last page.
   */
  const handlePopulateData = useCallback(() => {
    const quotation: QuotationData = DUMMY_QUOTATION
    setPagesWithHistory(buildPagesFromQuotation(quotation))
  }, [setPagesWithHistory])

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
    <div className="flex h-screen flex-col">
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-neutral-200 bg-white px-4">
        <h1 className="text-lg font-semibold">Quotation Editor</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={handleUndo}
            disabled={!canUndo}
            title="Undo (Ctrl+Z)"
            className="rounded border border-neutral-300 bg-neutral-100 px-3 py-1.5 text-sm hover:bg-neutral-200 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Undo
          </button>
          <button
            onClick={handleRedo}
            disabled={!canRedo}
            title="Redo (Ctrl+Shift+Z)"
            className="rounded border border-neutral-300 bg-neutral-100 px-3 py-1.5 text-sm hover:bg-neutral-200 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Redo
          </button>
          <button
            onClick={() => handleAddElement('text')}
            className="rounded border border-neutral-300 bg-neutral-100 px-2.5 py-1.5 text-sm hover:bg-neutral-200"
          >
            + Text
          </button>
          <button
            onClick={() => handleAddElement('rect')}
            className="rounded border border-neutral-300 bg-neutral-100 px-2.5 py-1.5 text-sm hover:bg-neutral-200"
          >
            + Shape
          </button>
          <button
            onClick={() => handleAddElement('table')}
            className="rounded border border-neutral-300 bg-neutral-100 px-2.5 py-1.5 text-sm hover:bg-neutral-200"
          >
            + Table
          </button>
          <button
            onClick={() => handleAddElement('image')}
            className="rounded border border-neutral-300 bg-neutral-100 px-2.5 py-1.5 text-sm hover:bg-neutral-200"
          >
            + Image
          </button>
          <button
            onClick={handlePopulateData}
            className="rounded border border-neutral-300 bg-neutral-100 px-2.5 py-1.5 text-sm hover:bg-neutral-200"
          >
            Populate Data
          </button>
          <button
            onClick={handleExportPdf}
            disabled={isExporting}
            className="rounded bg-[#1f4e79] px-3 py-1.5 text-sm text-white hover:bg-[#16405f] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isExporting ? 'Exporting…' : 'Export to PDF'}
          </button>
          <span className="mx-1 h-6 w-px bg-neutral-300" aria-hidden="true" />
          <button
            onClick={handleSignOut}
            title="Sign out"
            className="rounded border border-neutral-300 bg-neutral-100 px-3 py-1.5 text-sm hover:bg-neutral-200"
          >
            Sign out
          </button>
        </div>
      </header>
      <QuotationCanvas
        pages={pages}
        onElementChange={handleElementChange}
        onStageReady={handleStageReady}
        onDeleteElement={handleDeleteElement}
        onDuplicateElement={handleDuplicateElement}
        onSelectionChange={handleSelectionChange}
      />
    </div>
  )
}
