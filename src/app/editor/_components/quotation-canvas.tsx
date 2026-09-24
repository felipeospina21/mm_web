'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Stage, Layer, Rect, Text, Group, Transformer, Image as KonvaImage } from 'react-konva'
import type Konva from 'konva'
import TableNode from './table-node'
import FloatingToolbar from './floating-toolbar'
import type { PageData, TemplateElement } from './types'
import {
  PAGE_GAP,
  PAGE_HEIGHT,
  PAGE_WIDTH,
  STAGE_BG,
} from './types'

interface QuotationCanvasProps {
  pages: PageData[]
  onElementChange: (
    pageId: string,
    elementId: string,
    patch: Partial<TemplateElement>,
  ) => void
  /** Registered by the canvas so the export button can capture pages */
  onStageReady: (stage: Konva.Stage | null) => void
  /** Delete the element with the given id */
  onDeleteElement: (elementId: string) => void
  /** Duplicate the element with the given id */
  onDuplicateElement: (elementId: string) => void
  /** Notifies the page of selection changes (for keyboard shortcuts) */
  onSelectionChange: (elementId: string | null) => void
}

/**
 * Computes the absolute top-left position of a page on the stage.
 * Pages are stacked vertically with a fixed gap.
 */
export function getPageOffset(pageNumber: number): { x: number; y: number } {
  const index = pageNumber - 1
  return {
    x: 40,
    y: 40 + index * (PAGE_HEIGHT + PAGE_GAP),
  }
}

export default function QuotationCanvas({
  pages,
  onElementChange,
  onStageReady,
  onDeleteElement,
  onDuplicateElement,
  onSelectionChange,
}: QuotationCanvasProps) {
  const stageRef = useRef<Konva.Stage | null>(null)
  const [stageSize, setStageSize] = useState({
    width: 0,
    height: 0,
  })
  /** id of the currently selected element (globally unique across pages) */
  const [selectedId, setSelectedId] = useState<string | null>(null)
  /** id of the text element being inline-edited */
  const [editingId, setEditingId] = useState<string | null>(null)
  const transformerRef = useRef<Konva.Transformer | null>(null)

  /** Notify the page whenever the selection changes */
  useEffect(() => {
    onSelectionChange(selectedId)
  }, [selectedId, onSelectionChange])

  const handleStageRef = useCallback(
    (node: Konva.Stage | null) => {
      stageRef.current = node
      onStageReady(node)
    },
    [onStageReady],
  )

  // Keep the stage sized to the window; pages scroll inside the container.
  const updateSize = useCallback(() => {
    setStageSize({ width: window.innerWidth, height: window.innerHeight })
  }, [])

  // The canvas is only mounted client-side (dynamic import with ssr:false),
  // so window is always available here.
  useEffect(() => {
    updateSize()
    window.addEventListener('resize', updateSize)
    return () => window.removeEventListener('resize', updateSize)
  }, [updateSize])

  /**
   * Restricts dragging so the element can never leave its parent page.
   * dragBoundFunc receives the ABSOLUTE position Konva wants to apply
   * and must return the clamped absolute position.
   */
  const makeDragBoundFunc = useCallback(
    (page: PageData, element: TemplateElement) => {
      return (pos: Konva.Vector2d): Konva.Vector2d => {
        const pageOffset = getPageOffset(page.pageNumber)
        const maxX = pageOffset.x + PAGE_WIDTH - element.width
        const maxY = pageOffset.y + PAGE_HEIGHT - element.height
        return {
          x: Math.min(Math.max(pos.x, pageOffset.x), maxX),
          y: Math.min(Math.max(pos.y, pageOffset.y), maxY),
        }
      }
    },
    [],
  )

  /** Commit drag result (absolute coords -> page-relative) */
  const handleDragEnd = useCallback(
    (pageId: string, e: Konva.KonvaEventObject<DragEvent>) => {
      const node = e.target
      const page = pages.find((p) => p.id === pageId)
      if (!page) return
      const offset = getPageOffset(page.pageNumber)
      onElementChange(pageId, node.id(), {
        x: node.x() - offset.x,
        y: node.y() - offset.y,
      })
    },
    [onElementChange, pages],
  )

  /** Commit transformer result (resize) back into page-relative geometry */
  const handleTransformEnd = useCallback(
    (pageId: string, e: Konva.KonvaEventObject<Event>) => {
      const node = e.target as Konva.Shape
      const page = pages.find((p) => p.id === pageId)
      if (!page) return
      const offset = getPageOffset(page.pageNumber)
      const scaleX = node.scaleX()
      const scaleY = node.scaleY()
      // Reset scale and bake it into width/height
      node.scaleX(1)
      node.scaleY(1)

      // Tables: bake scale into colWidths/rowHeight instead of width/height
      const element = page.elements.find((el) => el.id === node.id())
      if (element?.type === 'table' && element.table) {
        onElementChange(pageId, node.id(), {
          x: node.x() - offset.x,
          y: node.y() - offset.y,
          table: {
            ...element.table,
            colWidths: element.table.colWidths.map((w) =>
              Math.max(30, Math.round(w * scaleX)),
            ),
            rowHeight: Math.max(20, Math.round(element.table.rowHeight * scaleY)),
          },
        })
        return
      }

      onElementChange(pageId, node.id(), {
        x: node.x() - offset.x,
        y: node.y() - offset.y,
        width: Math.max(20, node.width() * scaleX),
        height: Math.max(20, node.height() * scaleY),
      })
    },
    [onElementChange, pages],
  )

  /** Double-click on a text element starts inline editing */
  const handleTextDblClick = useCallback(
    (page: PageData, element: TemplateElement) => {
      const stage = stageRef.current
      if (!stage) return
      const stageBox = stage.container().getBoundingClientRect()
      const offset = getPageOffset(page.pageNumber)
      // Position of the element in page coordinates -> browser coordinates
      // (stage is not scaled, so stage coords == page pixels)
      const left = stageBox.left + offset.x + element.x
      const top = stageBox.top + offset.y + element.y
      setEditingId(element.id)
      setEditingCell(null)
      setEditingBox({
        left,
        top,
        width: element.width,
        height: element.height,
        fontSize: element.fontSize,
        color: element.fill,
      })
    },
    [],
  )

  const [editingBox, setEditingBox] = useState<{
    left: number
    top: number
    width: number
    height: number
    fontSize: number
    color: string
  } | null>(null)

  /** When editing a table cell: which element and which cell */
  const [editingCell, setEditingCell] = useState<{
    row: number
    col: number
  } | null>(null)

  /** Double-click on a table cell starts inline editing of that cell */
  const handleCellDblClick = useCallback(
    (
      page: PageData,
      element: TemplateElement,
      row: number,
      col: number,
    ) => {
      const stage = stageRef.current
      if (!stage || !element.table) return
      const stageBox = stage.container().getBoundingClientRect()
      const offset = getPageOffset(page.pageNumber)
      const { colWidths, rowHeight } = element.table
      const left =
        stageBox.left + offset.x + element.x +
        colWidths.slice(0, col).reduce((a, b) => a + b, 0)
      const top = stageBox.top + offset.y + element.y + row * rowHeight
      setEditingId(element.id)
      setEditingCell({ row, col })
      setEditingBox({
        left,
        top,
        width: colWidths[col] ?? 0,
        height: rowHeight,
        fontSize: element.table.fontSize,
        color: row === 0 ? element.table.headerColor : '#333333',
      })
    },
    [],
  )

  /** Commit edited text and close the textarea overlay */
  const commitTextEdit = useCallback(
    (newText: string) => {
      if (editingId) {
        const page = pages.find((p) =>
          p.elements.some((el) => el.id === editingId),
        )
        if (page) {
          if (editingCell) {
            // Table cell edit: patch the cells matrix
            const element = page.elements.find((el) => el.id === editingId)
            if (element?.table) {
              const cells = element.table.cells.map((r) => [...r])
              const targetRow = cells[editingCell.row]
              if (targetRow) {
                targetRow[editingCell.col] = newText
                onElementChange(page.id, editingId, {
                  table: { ...element.table, cells },
                })
              }
            }
          } else {
            onElementChange(page.id, editingId, { text: newText })
          }
        }
      }
      setEditingId(null)
      setEditingCell(null)
      setEditingBox(null)
    },
    [editingId, editingCell, onElementChange, pages],
  )

  /** Attach the transformer to the selected node */
  useEffect(() => {
    const transformer = transformerRef.current
    if (!transformer) return
    const stage = transformer.getStage()
    if (!stage) return
    const selectedNode = stage.findOne(`#${selectedId}`)
    if (selectedNode) {
      transformer.nodes([selectedNode])
    } else {
      transformer.nodes([])
    }
  }, [selectedId, pages])

  /** Deselect when clicking empty stage area */
  const handleStageMouseDown = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      // Deselect if clicked on empty area (the Stage itself or a page rect)
      const clickedOnEmpty = e.target === e.target.getStage()
      if (clickedOnEmpty) {
        setSelectedId(null)
        setEditingId(null)
      }
    },
    [],
  )

  return (
    <div
      className="relative h-[calc(100vh-56px)] w-full overflow-auto"
      style={{ background: STAGE_BG }}
    >
      <Stage
        ref={handleStageRef}
        width={stageSize.width}
        height={Math.max(
          stageSize.height,
          pages.length * (PAGE_HEIGHT + PAGE_GAP) + PAGE_GAP,
        )}
        style={{ background: STAGE_BG }}
        onMouseDown={handleStageMouseDown}
      >
        <Layer>
          {pages.map((page) => {
            const offset = getPageOffset(page.pageNumber)
            return (
              <Group key={page.id}>
                {/* White page rectangle with drop shadow */}
                <Rect
                  x={offset.x}
                  y={offset.y}
                  width={PAGE_WIDTH}
                  height={PAGE_HEIGHT}
                  fill="#ffffff"
                  shadowColor="black"
                  shadowBlur={20}
                  shadowOpacity={0.4}
                  shadowOffset={{ x: 0, y: 6 }}
                  cornerRadius={2}
                  listening={false}
                />
                {page.elements.map((element) => {
                  const absX = offset.x + element.x
                  const absY = offset.y + element.y
                  const commonProps = {
                    id: element.id,
                    x: absX,
                    y: absY,
                    draggable: true,
                    dragBoundFunc: makeDragBoundFunc(page, element),
                    onMouseDown: () => setSelectedId(element.id),
                    onDragEnd: (e: Konva.KonvaEventObject<DragEvent>) =>
                      handleDragEnd(page.id, e),
                    onDblClick: () => {
                      if (element.type === 'text') {
                        handleTextDblClick(page, element)
                      }
                    },
                  }
                  if (element.type === 'table' && element.table) {
                    return (
                      <TableNode
                        key={element.id}
                        id={element.id}
                        x={absX}
                        y={absY}
                        table={element.table}
                        isSelected={selectedId === element.id}
                        onSelect={() => setSelectedId(element.id)}
                        onDblClickCell={(row, col) =>
                          handleCellDblClick(page, element, row, col)
                        }
                        onDragEnd={(e) => handleDragEnd(page.id, e)}
                        onTransformEnd={(e) => handleTransformEnd(page.id, e)}
                        dragBoundFunc={makeDragBoundFunc(page, element)}
                      />
                    )
                  }
                  if (element.type === 'image') {
                    return (
                      <ImageElement
                        key={element.id}
                        element={element}
                        {...commonProps}
                        onTransformEnd={(e: Konva.KonvaEventObject<Event>) =>
                          handleTransformEnd(page.id, e)
                        }
                      />
                    )
                  }
                  if (element.type === 'rect') {
                    return (
                      <Rect
                        key={element.id}
                        {...commonProps}
                        width={element.width}
                        height={element.height}
                        fill={element.fill}
                        onTransformEnd={(e) => handleTransformEnd(page.id, e)}
                      />
                    )
                  }
                  return (
                    <Text
                      key={element.id}
                      {...commonProps}
                      width={element.width}
                      height={element.height}
                      text={element.text}
                      fontSize={element.fontSize}
                      fill={element.fill}
                      fontFamily={element.fontFamily ?? 'Arial'}
                      fontStyle={
                        [
                          element.fontWeight === 'bold' ? 'bold' : '',
                          element.italic ? 'italic' : '',
                        ]
                          .filter(Boolean)
                          .join(' ') || 'normal'
                      }
                      textDecoration={
                        element.underline ? 'underline' : 'normal'
                      }
                      onTransformEnd={(e) => handleTransformEnd(page.id, e)}
                    />
                  )
                })}
              </Group>
            )
          })}
          {/* Transformer for the selected element */}
          <Transformer
            ref={transformerRef}
            rotateEnabled={false}
            keepRatio={false}
            boundBoxFunc={(oldBox, newBox) => {
              // Enforce minimum size
              if (newBox.width < 20 || newBox.height < 10) {
                return oldBox
              }
              return newBox
            }}
          />
        </Layer>
      </Stage>
      {/* Inline text editing overlay */}
      {editingBox && (
        <textarea
          autoFocus
          className="fixed z-[100] resize-none border-2 border-dashed border-[#1f4e79] bg-white/95 p-0 m-0 outline-none"
          style={{
            left: editingBox.left,
            top: editingBox.top,
            width: editingBox.width,
            height: editingBox.height,
            fontSize: editingBox.fontSize,
            color: editingBox.color,
          }}
          defaultValue={
            editingCell
              ? (() => {
                  const element = pages
                    .flatMap((p) => p.elements)
                    .find((el) => el.id === editingId)
                  return (
                    element?.table?.cells[editingCell.row]?.[
                      editingCell.col
                    ] ?? ''
                  )
                })()
              : pages
                  .flatMap((p) => p.elements)
                  .find((el) => el.id === editingId)?.text
          }
          onBlur={(e) => commitTextEdit(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.preventDefault()
              // Cancel: restore original value
              const element = pages
                .flatMap((p) => p.elements)
                .find((el) => el.id === editingId)
              const original = editingCell
                ? (element?.table?.cells[editingCell.row]?.[
                    editingCell.col
                  ] ?? '')
                : (element?.text ?? '')
              commitTextEdit(original)
            }
          }}
          // Prevent Konva from stealing the events
          onMouseDown={(e) => e.stopPropagation()}
          onWheel={(e) => e.stopPropagation()}
        />
      )}
      {/* Table structure controls + formatting toolbar for the selected element */}
      {selectedId && !editingId && (
        <FloatingToolbar
          pages={pages}
          selectedId={selectedId}
          onElementChange={onElementChange}
          onDeleteElement={(id) => {
            onDeleteElement(id)
            setSelectedId(null)
          }}
          onDuplicateElement={onDuplicateElement}
        />
      )}
    </div>
  )
}

/**
 * Loads an HTMLImageElement from a data URL so Konva can draw it.
 * Returns null until the image has loaded.
 */
function useLoadedImage(src: string | undefined): HTMLImageElement | null {
  const [image, setImage] = useState<HTMLImageElement | null>(null)
  useEffect(() => {
    if (!src) {
      setImage(null)
      return
    }
    const img = new window.Image()
    img.onload = () => setImage(img)
    img.src = src
    return () => {
      img.onload = null
    }
  }, [src])
  return image
}

/**
 * Renders an image element. Shows a placeholder rect when no src is set.
 * The src is set via the FloatingToolbar file picker.
 */
function ImageElement({
  element,
  ...rest
}: {
  element: TemplateElement
} & Record<string, unknown>) {
  const image = useLoadedImage(element.src)
  const shapeProps = rest as unknown as Konva.RectConfig & Konva.ImageConfig
  if (!element.src) {
    // Placeholder while no image has been chosen
    return (
      <Rect
        {...shapeProps}
        width={element.width}
        height={element.height}
        fill="#eeeeee"
        stroke="#bbbbbb"
        strokeWidth={1}
        dash={[6, 4]}
      />
    )
  }
  return (
    <KonvaImage
      {...shapeProps}
      image={image ?? undefined}
      width={element.width}
      height={element.height}
    />
  )
}
