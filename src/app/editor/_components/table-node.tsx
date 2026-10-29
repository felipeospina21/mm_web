"use client";

import { Group, Rect, Text } from "react-konva";
import type Konva from "konva";
import type { TableData } from "./types";
import { theme } from "@/lib/theme";

/** Half the hit-width (px) of a column-resize divider handle. */
const HANDLE_HALF_WIDTH = 4;
/**
 * Inset (px) for the last column's divider so it clears the element
 * Transformer's right-middle resize anchor on the table's right edge.
 */
const HANDLE_INSET = 4;

interface TableNodeProps {
  id: string;
  x: number;
  y: number;
  table: TableData;
  isDraggable: boolean;
  isSelected: boolean;
  selectedRows: number[];
  selectedColumns: number[];
  selectedCells: Array<{ row: number; col: number }>;
  onSelect: () => void;
  onSelectRow: (row: number, extendSelection: boolean) => void;
  onSelectColumn: (column: number, extendSelection: boolean) => void;
  onSelectCell: (row: number, col: number, extendSelection: boolean) => void;
  onDblClickCell: (row: number, col: number) => void;
  onDragEnd: (e: Konva.KonvaEventObject<DragEvent>) => void;
  onTransformEnd: (e: Konva.KonvaEventObject<Event>) => void;
  dragBoundFunc: (pos: Konva.Vector2d) => Konva.Vector2d;
  /** Commit a new width (px) for a single column (grow-only resize). */
  onResizeColumn: (colIndex: number, newWidth: number) => void;
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
  isDraggable,
  isSelected,
  selectedRows,
  selectedColumns,
  selectedCells,
  onSelect,
  onDblClickCell,
  onSelectRow,
  onSelectColumn,
  onSelectCell,
  onDragEnd,
  onTransformEnd,
  dragBoundFunc,
  onResizeColumn,
}: TableNodeProps) {
  const {
    colWidths,
    rowHeight,
    cells,
    headerFill,
    headerColor,
    borderColor,
    fontSize,
  } = table;

  return (
    <Group
      id={id}
      x={x}
      y={y}
      draggable={isDraggable}
      dragBoundFunc={dragBoundFunc}
      onMouseDown={onSelect}
      onTouchStart={onSelect}
      onDblClick={(e) => {
        // Find which cell was double-clicked from the event target's cell index
        const target = e.target as Konva.Shape;
        const row = target.getAttr("data-row") as number | undefined;
        const col = target.getAttr("data-col") as number | undefined;
        if (typeof row === "number" && typeof col === "number") {
          onDblClickCell(row, col);
        }
      }}
      onDblTap={(e) => {
        const target = e.target as Konva.Shape;
        const row = target.getAttr("data-row") as number | undefined;
        const col = target.getAttr("data-col") as number | undefined;
        if (typeof row === "number" && typeof col === "number") {
          onDblClickCell(row, col);
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
          stroke={theme.colors.primary}
          strokeWidth={2}
          dash={[6, 4]}
          listening={false}
        />
      )}
      {cells.map((rowCells, rowIndex) =>
        rowCells.map((cellText, colIndex) => {
          const cellX = colWidths.slice(0, colIndex).reduce((a, b) => a + b, 0);
          const cellWidth = colWidths[colIndex] ?? 0;
          const isHeader = rowIndex === 0;
          return (
            <Group key={`${rowIndex}-${colIndex}`}>
              <Rect
                x={cellX}
                y={rowIndex * rowHeight}
                width={cellWidth}
                height={rowHeight}
                fill={isHeader ? headerFill : "#ffffff"}
                stroke={borderColor}
                strokeWidth={1}
                data-row={rowIndex}
                data-col={colIndex}
                onClick={(event) =>
                  onSelectCell(
                    rowIndex,
                    colIndex,
                    event.evt.shiftKey || event.evt.ctrlKey || event.evt.metaKey,
                  )
                }
                onTap={() => onSelectCell(rowIndex, colIndex, false)}
              />
              {rowIndex === 0 && (
                <Rect
                  x={cellX}
                  y={0}
                  width={cellWidth}
                  height={Math.min(8, rowHeight)}
                  fill="transparent"
                  data-column={colIndex}
                  onClick={(event) =>
                    onSelectColumn(
                      colIndex,
                      event.evt.shiftKey || event.evt.ctrlKey || event.evt.metaKey,
                    )
                  }
                  onTap={() => onSelectColumn(colIndex, false)}
                />
              )}
              <Text
                x={cellX + 8}
                y={rowIndex * rowHeight}
                width={cellWidth - 16}
                height={rowHeight}
                text={cellText}
                fontSize={fontSize}
                fill={isHeader ? headerColor : "#333333"}
                verticalAlign="middle"
                listening={false}
              />
            </Group>
          );
        }),
      )}
      {cells.slice(1).map((_, index) => {
        const row = index + 1;
        return (
          <Rect
            key={`row-selector-${row}`}
            x={0}
            y={row * rowHeight}
            width={8}
            height={rowHeight}
            fill="transparent"
            onClick={(event) =>
              onSelectRow(
                row,
                event.evt.shiftKey || event.evt.ctrlKey || event.evt.metaKey,
              )
            }
            onTap={() => onSelectRow(row, false)}
          />
        );
      })}
      {selectedRows
        .filter((row) => row > 0 && row < cells.length)
        .map((row) => (
          <Rect
            key={`selected-row-${row}`}
            x={0}
            y={row * rowHeight}
            width={colWidths.reduce((total, width) => total + width, 0)}
            height={rowHeight}
            stroke={theme.colors.primary}
            strokeWidth={2}
            listening={false}
          />
        ))}
      {selectedColumns.map((col) => (
        <Rect
          key={`selected-column-${col}`}
          x={colWidths.slice(0, col).reduce((total, width) => total + width, 0)}
          y={0}
          width={colWidths[col] ?? 0}
          height={rowHeight * cells.length}
          stroke={theme.colors.primary}
          strokeWidth={2}
          listening={false}
        />
      ))}
      {selectedCells.map(({ row, col }) => (
        <Rect
          key={`selected-cell-${row}-${col}`}
          x={colWidths.slice(0, col).reduce((total, width) => total + width, 0)}
          y={row * rowHeight}
          width={colWidths[col] ?? 0}
          height={rowHeight}
          stroke={theme.colors.primary}
          strokeWidth={2}
          listening={false}
        />
      ))}
      {/* Per-column resize dividers (grow-only). One on each column's right
          edge so the first, middle, and last columns are all resizable.
          Dragging boundary `col` resizes column `col`. The last divider is
          inset a few px so it doesn't overlap the element Transformer's
          right-middle handle. Shown only while the table is selected. */}
      {isSelected &&
        colWidths.map((width, col) => {
          const rightEdge = colWidths
            .slice(0, col + 1)
            .reduce((total, value) => total + value, 0);
          const isLast = col === colWidths.length - 1;
          const handleX = isLast ? rightEdge - HANDLE_INSET : rightEdge;
          const tableHeight = rowHeight * cells.length;
          return (
            <Rect
              key={`col-resize-${col}`}
              x={handleX - HANDLE_HALF_WIDTH}
              y={0}
              width={HANDLE_HALF_WIDTH * 2}
              height={tableHeight}
              fill="transparent"
              draggable
              onMouseEnter={(event) => {
                const container = event.target.getStage()?.container();
                if (container) container.style.cursor = "col-resize";
              }}
              onMouseLeave={(event) => {
                const container = event.target.getStage()?.container();
                if (container) container.style.cursor = "default";
              }}
              dragBoundFunc={function (this: Konva.Node, pos) {
                // Constrain the handle to horizontal movement at the Group's
                // top. `this` is the handle node; its parent is the table Group.
                const group = this.getParent();
                const absY = group ? group.getAbsolutePosition().y : pos.y;
                return { x: pos.x, y: absY };
              }}
              onDragEnd={(event) => {
                const node = event.target;
                // The column's left edge, relative to the table Group.
                const leftEdge = colWidths
                  .slice(0, col)
                  .reduce((total, value) => total + value, 0);
                // node.x() is the handle's left edge; its centre is the divider
                // line. For the last column the real right edge is the line plus
                // the inset we rendered it at.
                const dividerLine = node.x() + HANDLE_HALF_WIDTH;
                const columnRightEdge = isLast
                  ? dividerLine + HANDLE_INSET
                  : dividerLine;
                onResizeColumn(col, columnRightEdge - leftEdge);
                // Snap the handle back; the committed table re-renders it.
                node.position({ x: handleX - HANDLE_HALF_WIDTH, y: 0 });
                const container = node.getStage()?.container();
                if (container) container.style.cursor = "default";
              }}
            />
          );
        })}
    </Group>
  );
}
