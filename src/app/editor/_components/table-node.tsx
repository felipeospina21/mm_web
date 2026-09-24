'use client'

import { Group, Rect, Text } from 'react-konva'
import type Konva from 'konva'
import type { TableData } from './types'

interface TableNodeProps {
  id: string
  x: number
  y: number
  table: TableData
  isSelected: boolean
  onSelect: () => void
  onDblClickCell: (row: number, col: number) => void
  onDragEnd: (e: Konva.KonvaEventObject<DragEvent>) => void
  onTransformEnd: (e: Konva.KonvaEventObject<Event>) => void
  dragBoundFunc: (pos: Konva.Vector2d) => Konva.Vector2d
}

/**
 * Renders a table as a Konva Group of cell Rects + Texts.
 * The Group itself is the draggable/transformable node; its id is the
 * element id so the Transformer can find it.
 */
export default function TableNode({
  id,
  x,
  y,
  table,
  isSelected,
  onSelect,
  onDblClickCell,
  onDragEnd,
  onTransformEnd,
  dragBoundFunc,
}: TableNodeProps) {
  const { colWidths, rowHeight, cells, headerFill, headerColor, borderColor, fontSize } = table

  return (
    <Group
      id={id}
      x={x}
      y={y}
      draggable
      dragBoundFunc={dragBoundFunc}
      onMouseDown={onSelect}
      onDblClick={(e) => {
        // Find which cell was double-clicked from the event target's cell index
        const target = e.target as Konva.Shape
        const row = target.getAttr('data-row') as number | undefined
        const col = target.getAttr('data-col') as number | undefined
        if (typeof row === 'number' && typeof col === 'number') {
          onDblClickCell(row, col)
        }
      }}
      onDragEnd={onDragEnd}
      onTransformEnd={onTransformEnd}
    >
      {/* Selection outline */}
      {isSelected && (
        <Rect
          x={-2}
          y={-2}
          width={colWidths.reduce((a, b) => a + b, 0) + 4}
          height={rowHeight * cells.length + 4}
          stroke="#1f4e79"
          strokeWidth={2}
          dash={[6, 4]}
          listening={false}
        />
      )}
      {cells.map((rowCells, rowIndex) =>
        rowCells.map((cellText, colIndex) => {
          const cellX = colWidths.slice(0, colIndex).reduce((a, b) => a + b, 0)
          const cellWidth = colWidths[colIndex] ?? 0
          const isHeader = rowIndex === 0
          return (
            <Group key={`${rowIndex}-${colIndex}`}>
              <Rect
                x={cellX}
                y={rowIndex * rowHeight}
                width={cellWidth}
                height={rowHeight}
                fill={isHeader ? headerFill : '#ffffff'}
                stroke={borderColor}
                strokeWidth={1}
                data-row={rowIndex}
                data-col={colIndex}
              />
              <Text
                x={cellX + 8}
                y={rowIndex * rowHeight}
                width={cellWidth - 16}
                height={rowHeight}
                text={cellText}
                fontSize={fontSize}
                fill={isHeader ? headerColor : '#333333'}
                verticalAlign="middle"
                listening={false}
              />
            </Group>
          )
        }),
      )}
    </Group>
  )
}
