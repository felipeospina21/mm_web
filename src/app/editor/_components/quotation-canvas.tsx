"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ClipboardEvent as ReactClipboardEvent } from "react";
import {
  Stage,
  Layer,
  Rect,
  Text,
  Group,
  Transformer,
  Image as KonvaImage,
} from "react-konva";
import type Konva from "konva";
import TableNode from "./table-node";
import FloatingToolbar from "./floating-toolbar";
import type { PageData, TemplateElement } from "./types";
import { t } from "@/i18n/messages";
import { theme } from "@/lib/theme";
import { PAGE_GAP, PAGE_HEIGHT, PAGE_WIDTH, STAGE_BG } from "./types";

function formatEditedCell(value: string, row: number, col: number): string {
  if (row === 0) return value;
  if (col === 0) return value.replace(/\D/g, "");
  if (col === 3) {
    const amount = Number(value.replace(/\D/g, ""));
    return value.trim() === "" || !Number.isFinite(amount)
      ? ""
      : `$ ${amount.toLocaleString("es-CO")}`;
  }
  return value;
}

interface QuotationCanvasProps {
  pages: PageData[];
  onElementChange: (
    pageId: string,
    elementId: string,
    patch: Partial<TemplateElement>,
  ) => void;
  /** Delete the element with the given id */
  onDeleteElement: (elementId: string) => void;
  /** Duplicate the element with the given id */
  onDuplicateElement: (elementId: string) => void;
  /** Notifies the page of selection changes (for keyboard shortcuts) */
  onSelectionChange: (elementId: string | null) => void;
  onActivePageChange: (pageNumber: number) => void;
  activePageNumber: number;
  onDeletePage: (pageNumber: number) => void;
  onPasteImage: (
    src: string,
    pageNumber: number,
    x: number,
    y: number,
    width: number,
    height: number,
  ) => void;
  onPasteElement: (pageNumber: number, element: TemplateElement) => void;
}

/**
 * Computes the absolute top-left position of a page on the stage.
 * Pages are stacked vertically with a fixed gap.
 */
export function getPageOffset(pageNumber: number): { x: number; y: number } {
  const index = pageNumber - 1;
  return {
    x: 40,
    y: 40 + index * (PAGE_HEIGHT + PAGE_GAP),
  };
}

export default function QuotationCanvas({
  pages,
  onElementChange,
  onDeleteElement,
  onDuplicateElement,
  onSelectionChange,
  onActivePageChange,
  activePageNumber,
  onDeletePage,
  onPasteImage,
  onPasteElement,
}: QuotationCanvasProps) {
  const stageRef = useRef<Konva.Stage | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [stageSize, setStageSize] = useState({
    width: 0,
    height: 0,
  });
  /** id of the currently selected element (globally unique across pages) */
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedTableRows, setSelectedTableRows] = useState<number[]>([]);
  const [selectedTableColumns, setSelectedTableColumns] = useState<number[]>([]);
  const [selectedTableCells, setSelectedTableCells] = useState<
    Array<{ row: number; col: number }>
  >([]);
  const [tableRowAnchor, setTableRowAnchor] = useState<number | null>(null);
  /** id of the text element being inline-edited */
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingBox, setEditingBox] = useState<{
    left: number;
    top: number;
    width: number;
    height: number;
    fontSize: number;
    color: string;
  } | null>(null);
  const [editingCell, setEditingCell] = useState<{
    row: number;
    col: number;
  } | null>(null);
  const [editingTextValue, setEditingTextValue] = useState("");
  const [editingCellValue, setEditingCellValue] = useState("");
  const transformerRef = useRef<Konva.Transformer | null>(null);
  const pastePositionRef = useRef({ pageNumber: 1, x: 100, y: 100 });
  const elementClipboardRef = useRef<TemplateElement | null>(null);

  const updateActivePageFromPointer = useCallback(() => {
    const stage = stageRef.current;
    const point = stage?.getPointerPosition();
    if (!point) return;
    const pageNumber =
      Math.floor((point.y - 40) / (PAGE_HEIGHT + PAGE_GAP)) + 1;
    const page = pages.find((item) => item.pageNumber === pageNumber);
    if (!page || point.x < 40 || point.x > 40 + PAGE_WIDTH) return;
    const offset = getPageOffset(pageNumber);
    pastePositionRef.current = {
      pageNumber,
      x: Math.max(0, Math.min(PAGE_WIDTH - 300, point.x - offset.x)),
      y: Math.max(0, Math.min(PAGE_HEIGHT - 200, point.y - offset.y)),
    };
    onActivePageChange(pageNumber);
  }, [onActivePageChange, pages]);

  const handlePaste = useCallback(
    (event: ReactClipboardEvent<HTMLDivElement>) => {
      const target = event.target as HTMLElement;
      if (target.closest("input, textarea, [contenteditable='true']")) return;
      const clipboardText = event.clipboardData.getData("text/plain");

      if (!clipboardText && elementClipboardRef.current) {
        const { pageNumber, x, y } = pastePositionRef.current;
        const page = pages.find((item) => item.pageNumber === pageNumber);
        if (!page) return;
        const copy = elementClipboardRef.current;
        const pastedElement: TemplateElement = {
          ...copy,
          id: `${copy.id}-copy-${Date.now()}`,
          x: Math.max(0, Math.min(PAGE_WIDTH - copy.width, x + 20)),
          y: Math.max(0, Math.min(PAGE_HEIGHT - copy.height, y + 20)),
          table: copy.table
            ? {
                ...copy.table,
                cells: copy.table.cells.map((row) => [...row]),
                colWidths: [...copy.table.colWidths],
              }
            : undefined,
        };
        event.preventDefault();
        onPasteElement(pageNumber, pastedElement);
        return;
      }

      const selectedTablePage = pages.find((page) =>
        page.elements.some(
          (element) => element.id === selectedId && element.table,
        ),
      );
      const selectedTable = selectedTablePage?.elements.find(
        (element) => element.id === selectedId && element.table,
      );
      const tableData = selectedTable?.table;
      const targetRows = selectedTableRows
        .filter((row) => row > 0)
        .sort((a, b) => a - b);
      const targetColumns = [...selectedTableColumns].sort((a, b) => a - b);
      const targetCells = [...selectedTableCells].sort(
        (a, b) => a.row - b.row || a.col - b.col,
      );

      if (
        clipboardText &&
        selectedTablePage &&
        selectedTable &&
        tableData &&
        selectedTable.isEditable &&
        targetCells.length > 0
      ) {
        const sourceRows = clipboardText
          .replace(/\r\n/g, "\n")
          .replace(/\n$/, "")
          .split("\n")
          .map((row) => row.split("\t"));
        const start = targetCells[0]!;
        const cells = tableData.cells.map((row) => [...row]);
        const columnCount = tableData.colWidths.length;

        sourceRows.forEach((sourceRow, rowOffset) => {
          sourceRow.forEach((value, colOffset) => {
            const rowIndex = start.row + rowOffset;
            const colIndex = start.col + colOffset;
            if (rowIndex === 0 || colIndex >= columnCount) return;
            while (cells.length <= rowIndex) {
              cells.push(Array.from({ length: columnCount }, () => ""));
            }
            const row = cells[rowIndex];
            if (!row || (selectedTable.id.startsWith("line-items-") && colIndex === 4)) return;
            row[colIndex] = formatEditedCell(value, rowIndex, colIndex);
            if (selectedTable.id.startsWith("line-items-")) {
              const quantity = row[0]?.replace(/\D/g, "") ?? "";
              const price = row[3]?.replace(/\D/g, "") ?? "";
              row[4] = quantity && price
                ? `$ ${(Number(quantity) * Number(price)).toLocaleString("es-CO")}`
                : "";
            }
          });
        });

        event.preventDefault();
        onElementChange(selectedTablePage.id, selectedTable.id, {
          table: { ...tableData, cells },
        });
        setSelectedTableCells([]);
        return;
      }

      if (
        clipboardText &&
        selectedTablePage &&
        selectedTable &&
        tableData &&
        selectedTable.isEditable &&
        targetColumns.length > 0
      ) {
        const sourceRows = clipboardText
          .replace(/\r\n/g, "\n")
          .replace(/\n$/, "")
          .split("\n")
          .map((row) => row.split("\t"));
        const startColumn = targetColumns[0]!;
        const cells = tableData.cells.map((row) => [...row]);
        const columnCount = tableData.colWidths.length;

        sourceRows.forEach((sourceRow, rowOffset) => {
          const rowIndex = rowOffset + 1;
          while (cells.length <= rowIndex) {
            cells.push(Array.from({ length: columnCount }, () => ""));
          }
          const row = cells[rowIndex];
          if (!row) return;
          sourceRow.forEach((value, colOffset) => {
            const colIndex = startColumn + colOffset;
            if (colIndex >= columnCount || (selectedTable.id.startsWith("line-items-") && colIndex === 4)) return;
            row[colIndex] = formatEditedCell(value, rowIndex, colIndex);
          });
          if (selectedTable.id.startsWith("line-items-")) {
            const quantity = row[0]?.replace(/\D/g, "") ?? "";
            const price = row[3]?.replace(/\D/g, "") ?? "";
            row[4] = quantity && price
              ? `$ ${(Number(quantity) * Number(price)).toLocaleString("es-CO")}`
              : "";
          }
        });

        event.preventDefault();
        onElementChange(selectedTablePage.id, selectedTable.id, {
          height: tableData.rowHeight * cells.length,
          table: { ...tableData, cells },
        });
        return;
      }

      if (
        clipboardText &&
        selectedTablePage &&
        selectedTable &&
        tableData &&
        selectedTable.isEditable &&
        targetRows.length > 0
      ) {
        const sourceRows = clipboardText
          .replace(/\r\n/g, "\n")
          .replace(/\n$/, "")
          .split("\n")
          .map((row) => row.split("\t"));
        const startRow = targetRows[0]!;
        const cells = tableData.cells.map((row) => [...row]);
        const columnCount = tableData.colWidths.length;

        sourceRows.forEach((sourceRow, rowOffset) => {
          const rowIndex = startRow + rowOffset;
          while (cells.length <= rowIndex) {
            cells.push(Array.from({ length: columnCount }, () => ""));
          }
          const row = cells[rowIndex];
          if (!row) return;

          sourceRow.slice(0, columnCount).forEach((value, colIndex) => {
            if (
              selectedTable.id.startsWith("line-items-") &&
              colIndex === 4
            ) {
              return;
            }
            row[colIndex] = formatEditedCell(value, rowIndex, colIndex);
          });

          if (selectedTable.id.startsWith("line-items-")) {
            const quantity = row[0]?.replace(/\D/g, "") ?? "";
            const price = row[3]?.replace(/\D/g, "") ?? "";
            row[4] =
              quantity && price
                ? `$ ${(Number(quantity) * Number(price)).toLocaleString("es-CO")}`
                : "";
          }
        });

        event.preventDefault();
        onElementChange(selectedTablePage.id, selectedTable.id, {
          height: tableData.rowHeight * cells.length,
          table: { ...tableData, cells },
        });
        setSelectedTableRows(
          sourceRows.map((_, rowOffset) => startRow + rowOffset),
        );
        setSelectedTableCells([]);
        return;
      }

      const image = Array.from(event.clipboardData.items).find((item) =>
        item.type.startsWith("image/"),
      );
      const file = image?.getAsFile();
      if (!file) return;
      event.preventDefault();
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result !== "string") return;
        const { pageNumber, x, y } = pastePositionRef.current;
        const imageElement = new window.Image();
        imageElement.onload = () => {
          const scale = Math.min(
            1,
            300 / imageElement.naturalWidth,
            200 / imageElement.naturalHeight,
          );
          onPasteImage(
            reader.result as string,
            pageNumber,
            x,
            y,
            imageElement.naturalWidth * scale,
            imageElement.naturalHeight * scale,
          );
        };
        imageElement.src = reader.result;
      };
      reader.readAsDataURL(file);
    },
    [
      onPasteImage,
      onPasteElement,
      onElementChange,
      pages,
      selectedId,
      selectedTableRows,
      selectedTableColumns,
      selectedTableCells,
    ],
  );

  const handleCopy = useCallback(
    (event: ReactClipboardEvent<HTMLDivElement>) => {
      const target = event.target as HTMLElement;
      if (target.closest("input, textarea, [contenteditable='true']")) return;
      const selectedElement = pages
        .flatMap((page) => page.elements)
        .find((element) => element.id === selectedId);
      const selectedTable = pages
        .flatMap((page) => page.elements)
        .find((element) => element.id === selectedId && element.table);
      if (!selectedTable?.table) return;

      const rows = selectedTableRows
        .filter((row) => row > 0 && row < selectedTable.table!.cells.length)
        .sort((a, b) => a - b);
      const selectedCells = selectedTableCells
        .filter(({ row, col }) =>
          row > 0 && row < selectedTable.table!.cells.length && col >= 0,
        )
        .sort((a, b) => a.row - b.row || a.col - b.col);
      const columns = selectedTableColumns
        .filter((col) => col >= 0 && col < selectedTable.table!.colWidths.length)
        .sort((a, b) => a - b);
      if (rows.length === 0 && columns.length === 0 && selectedCells.length === 0) {
        if (!selectedElement) return;
        event.preventDefault();
        elementClipboardRef.current = {
          ...selectedElement,
          table: selectedElement.table
            ? {
                ...selectedElement.table,
                cells: selectedElement.table.cells.map((row) => [...row]),
                colWidths: [...selectedElement.table.colWidths],
              }
            : undefined,
        };
        event.clipboardData.setData("text/plain", "");
        return;
      }

      event.preventDefault();
      event.clipboardData.setData(
        "text/plain",
        rows.length > 0
          ? rows
              .map((rowIndex) => selectedTable.table!.cells[rowIndex]?.join("\t") ?? "")
              .join("\n")
          : columns.length > 0
            ? selectedTable.table!.cells
                .slice(1)
                .map((row) => columns.map((col) => row[col] ?? "").join("\t"))
                .join("\n")
          : (() => {
              const minRow = Math.min(...selectedCells.map(({ row }) => row));
              const maxRow = Math.max(...selectedCells.map(({ row }) => row));
              const minCol = Math.min(...selectedCells.map(({ col }) => col));
              const maxCol = Math.max(...selectedCells.map(({ col }) => col));
              const selectedCellSet = new Set(
                selectedCells.map(({ row, col }) => `${row}:${col}`),
              );
              return Array.from({ length: maxRow - minRow + 1 }, (_, rowOffset) =>
                Array.from({ length: maxCol - minCol + 1 }, (_, colOffset) => {
                  const row = minRow + rowOffset;
                  const col = minCol + colOffset;
                  return selectedCellSet.has(`${row}:${col}`)
                    ? (selectedTable.table!.cells[row]?.[col] ?? "")
                    : "";
                }).join("\t"),
              ).join("\n");
            })(),
      );
    },
    [pages, selectedId, selectedTableRows, selectedTableColumns, selectedTableCells],
  );

  /** Notify the page whenever the selection changes */
  useEffect(() => {
    onSelectionChange(selectedId);
  }, [selectedId, onSelectionChange]);

  // Keep the stage sized to its container (not the window) so it fits
  // beside the inventory panel and under the toolbar. Pages scroll inside.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const updateSize = () => {
      const { width, height } = container.getBoundingClientRect();
      setStageSize({ width, height });
    };

    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  /**
   * Restricts dragging so the element can never leave its parent page.
   * dragBoundFunc receives the ABSOLUTE position Konva wants to apply
   * and must return the clamped absolute position.
   */
  const makeDragBoundFunc = useCallback(
    (page: PageData, element: TemplateElement) => {
      return (pos: Konva.Vector2d): Konva.Vector2d => {
        const pageOffset = getPageOffset(page.pageNumber);
        const maxX = pageOffset.x + PAGE_WIDTH - element.width;
        const maxY = pageOffset.y + PAGE_HEIGHT - element.height;
        return {
          x: Math.min(Math.max(pos.x, pageOffset.x), maxX),
          y: Math.min(Math.max(pos.y, pageOffset.y), maxY),
        };
      };
    },
    [],
  );

  /** Commit drag result (absolute coords -> page-relative) */
  const handleDragEnd = useCallback(
    (pageId: string, e: Konva.KonvaEventObject<DragEvent>) => {
      const node = e.target;
      const page = pages.find((p) => p.id === pageId);
      if (!page) return;
      const offset = getPageOffset(page.pageNumber);
      onElementChange(pageId, node.id(), {
        x: node.x() - offset.x,
        y: node.y() - offset.y,
      });
    },
    [onElementChange, pages],
  );

  /** Commit transformer result (resize) back into page-relative geometry */
  const handleTransformEnd = useCallback(
    (pageId: string, e: Konva.KonvaEventObject<Event>) => {
      const node = e.target as Konva.Shape;
      const page = pages.find((p) => p.id === pageId);
      if (!page) return;
      const offset = getPageOffset(page.pageNumber);
      const scaleX = node.scaleX();
      const scaleY = node.scaleY();
      // Reset scale and bake it into width/height
      node.scaleX(1);
      node.scaleY(1);

      // Tables: bake scale into colWidths/rowHeight instead of width/height
      const element = page.elements.find((el) => el.id === node.id());
      if (element?.type === "table" && element.table) {
        onElementChange(pageId, node.id(), {
          x: node.x() - offset.x,
          y: node.y() - offset.y,
          table: {
            ...element.table,
            colWidths: element.table.colWidths.map((w) =>
              Math.max(30, Math.round(w * scaleX)),
            ),
            rowHeight: Math.max(
              20,
              Math.round(element.table.rowHeight * scaleY),
            ),
          },
        });
        return;
      }

      onElementChange(pageId, node.id(), {
        x: node.x() - offset.x,
        y: node.y() - offset.y,
        width: Math.max(20, node.width() * scaleX),
        height: Math.max(20, node.height() * scaleY),
      });
    },
    [onElementChange, pages],
  );

  /** Double-click on a text element starts inline editing */
  const handleTextDblClick = useCallback(
    (page: PageData, element: TemplateElement) => {
      const stage = stageRef.current;
      if (!stage) return;
      const stageBox = stage.container().getBoundingClientRect();
      const offset = getPageOffset(page.pageNumber);
      // Position of the element in page coordinates -> browser coordinates
      // (stage is not scaled, so stage coords == page pixels)
      const left = stageBox.left + offset.x + element.x;
      const top = stageBox.top + offset.y + element.y;
      setEditingId(element.id);
      setEditingCell(null);
      setEditingTextValue(element.text);
      setEditingBox({
        left,
        top,
        width: element.width,
        height: element.height,
        fontSize: element.fontSize,
        color: element.fill,
      });
    },
    [],
  );

  /** Double-click on an editable table cell starts inline editing. */
  const handleCellDblClick = useCallback(
    (page: PageData, element: TemplateElement, row: number, col: number) => {
      const stage = stageRef.current;
      if (!stage || !element.table || !element.isEditable) return;
      if (element.id.startsWith("line-items-") && col === 4) return;
      const stageBox = stage.container().getBoundingClientRect();
      const offset = getPageOffset(page.pageNumber);
      const { colWidths, rowHeight } = element.table;
      const left =
        stageBox.left +
        offset.x +
        element.x +
        colWidths.slice(0, col).reduce((a, b) => a + b, 0);
      const top = stageBox.top + offset.y + element.y + row * rowHeight;
      setEditingId(element.id);
      setEditingCell({ row, col });
      setEditingTextValue("");
      const currentValue = element.table.cells[row]?.[col] ?? "";
      setEditingCellValue(
        row > 0 && col === 0
          ? currentValue.replace(/\D/g, "")
          : row > 0 && col === 3
            ? currentValue.replace(/[^\d-]/g, "")
            : currentValue,
      );
      setEditingBox({
        left,
        top,
        width: colWidths[col] ?? 0,
        height: rowHeight,
        fontSize: element.table.fontSize,
        color: row === 0 ? element.table.headerColor : "#333333",
      });
    },
    [],
  );

  /** Commit edited text and close the textarea overlay */
  const commitTextEdit = useCallback(
    (newText: string) => {
      if (editingId) {
        const page = pages.find((p) =>
          p.elements.some((el) => el.id === editingId),
        );
        if (page) {
          if (editingCell) {
            const element = page.elements.find((item) => item.id === editingId);
            if (element?.table) {
              const cells = element.table.cells.map((row) => [...row]);
              const targetRow = cells[editingCell.row];
              if (targetRow) {
                targetRow[editingCell.col] = formatEditedCell(
                  newText,
                  editingCell.row,
                  editingCell.col,
                );
                if (
                  element.id.startsWith("line-items-") &&
                  editingCell.row > 0
                ) {
                  const quantity = targetRow[0]?.replace(/\D/g, "") ?? "";
                  const price = targetRow[3]?.replace(/\D/g, "") ?? "";
                  targetRow[4] =
                    quantity && price
                      ? `$ ${(Number(quantity) * Number(price)).toLocaleString("es-CO")}`
                      : "";
                }
                onElementChange(page.id, editingId, {
                  table: { ...element.table, cells },
                });
              }
            }
          } else {
            onElementChange(page.id, editingId, { text: newText });
          }
        }
      }
      setEditingId(null);
      setEditingCell(null);
      setEditingTextValue("");
      setEditingCellValue("");
      setEditingBox(null);
    },
    [editingId, editingCell, onElementChange, pages],
  );

  /** Attach the transformer to the selected node */
  useEffect(() => {
    const transformer = transformerRef.current;
    if (!transformer) return;
    const stage = transformer.getStage();
    if (!stage) return;
    const selectedElement = pages
      .flatMap((page) => page.elements)
      .find((element) => element.id === selectedId);
    const selectedNode = stage.findOne(`#${selectedId}`);
    if (selectedElement?.isEditable && selectedNode) {
      transformer.nodes([selectedNode]);
    } else {
      transformer.nodes([]);
    }
  }, [selectedId, pages]);

  /** Deselect when clicking empty stage area */
  const handleStageMouseDown = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      containerRef.current?.focus({ preventScroll: true });
      // Deselect if clicked on empty area (the Stage itself or a page rect)
      const clickedOnEmpty = e.target === e.target.getStage();
      if (clickedOnEmpty) {
        setSelectedId(null);
        setSelectedTableCells([]);
        setSelectedTableRows([]);
        setSelectedTableColumns([]);
      }
      updateActivePageFromPointer();
    },
    [updateActivePageFromPointer],
  );

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      onCopy={handleCopy}
      onPaste={handlePaste}
      className="relative h-full w-full overflow-auto overscroll-contain"
      style={{ background: STAGE_BG }}
    >
      <Stage
        ref={stageRef}
        width={Math.max(stageSize.width, PAGE_WIDTH + 80)}
        height={Math.max(
          stageSize.height,
          pages.length * (PAGE_HEIGHT + PAGE_GAP) + PAGE_GAP,
        )}
        style={{ background: STAGE_BG }}
        onMouseDown={handleStageMouseDown}
        onTouchStart={(event) => {
          containerRef.current?.focus({ preventScroll: true });
          if (event.target === event.target.getStage()) {
            setSelectedId(null);
            setSelectedTableCells([]);
            setSelectedTableRows([]);
            setSelectedTableColumns([]);
          }
          updateActivePageFromPointer();
        }}
        onMouseMove={updateActivePageFromPointer}
      >
        <Layer>
          {pages.map((page) => {
            const offset = getPageOffset(page.pageNumber);
            return (
              <Group
                key={page.id}
                onMouseDown={() => onActivePageChange(page.pageNumber)}
                onTouchStart={() => onActivePageChange(page.pageNumber)}
              >
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
                {page.pageNumber === activePageNumber && (
                  <Rect
                    x={offset.x - 3}
                    y={offset.y - 3}
                    width={PAGE_WIDTH + 6}
                    height={PAGE_HEIGHT + 6}
                    stroke={theme.colors.primary}
                    strokeWidth={3}
                    listening={false}
                  />
                )}
                {page.elements.map((element) => {
                  const absX = offset.x + element.x;
                  const absY = offset.y + element.y;
                  const commonProps = {
                    id: element.id,
                    x: absX,
                    y: absY,
                    draggable: element.isDraggable,
                    dragBoundFunc: makeDragBoundFunc(page, element),
                    onMouseDown: () => {
                      setSelectedId(element.id);
                      onActivePageChange(page.pageNumber);
                      const pointer = stageRef.current?.getPointerPosition();
                      if (pointer) {
                        pastePositionRef.current = {
                          pageNumber: page.pageNumber,
                          x: Math.max(0, pointer.x - offset.x),
                          y: Math.max(0, pointer.y - offset.y),
                        };
                      }
                    },
                    onTouchStart: () => {
                      setSelectedId(element.id);
                      onActivePageChange(page.pageNumber);
                    },
                    onDragEnd: (e: Konva.KonvaEventObject<DragEvent>) =>
                      handleDragEnd(page.id, e),
                    onDblClick: () => {
                      if (element.type === "text" && element.isEditable) {
                        handleTextDblClick(page, element);
                      }
                    },
                    onDblTap: () => {
                      if (element.type === "text" && element.isEditable) {
                        handleTextDblClick(page, element);
                      }
                    },
                  };
                  if (element.type === "table" && element.table) {
                    return (
                      <TableNode
                        key={element.id}
                        id={element.id}
                        x={absX}
                        y={absY}
                        table={element.table}
                        isDraggable={element.isDraggable}
                        isSelected={selectedId === element.id}
                        selectedRows={
                          selectedId === element.id ? selectedTableRows : []
                        }
                        selectedColumns={
                          selectedId === element.id ? selectedTableColumns : []
                        }
                        selectedCells={
                          selectedId === element.id ? selectedTableCells : []
                        }
                        onSelect={() => {
                          setSelectedId(element.id);
                          onActivePageChange(page.pageNumber);
                        }}
                        onSelectRow={(row, extendSelection) => {
                          setSelectedId(element.id);
                          onActivePageChange(page.pageNumber);
                          if (row === 0) {
                            setSelectedTableRows([]);
                            setSelectedTableColumns([]);
                            setSelectedTableCells([]);
                            setTableRowAnchor(null);
                            return;
                          }

                          if (
                            extendSelection &&
                            selectedId === element.id &&
                            tableRowAnchor !== null
                          ) {
                            const start = Math.min(tableRowAnchor, row);
                            const end = Math.max(tableRowAnchor, row);
                            setSelectedTableRows(
                              Array.from(
                                { length: end - start + 1 },
                                (_, index) => start + index,
                              ),
                            );
                            setSelectedTableCells([]);
                            return;
                          }

                          setSelectedTableRows([row]);
                          setSelectedTableColumns([]);
                          setSelectedTableCells([]);
                          setTableRowAnchor(row);
                        }}
                        onSelectColumn={(column, extendSelection) => {
                          setSelectedId(element.id);
                          onActivePageChange(page.pageNumber);
                          setTableRowAnchor(null);
                          setSelectedTableRows([]);
                          setSelectedTableCells([]);
                          setSelectedTableColumns((current) => {
                            if (!extendSelection) return [column];
                            return current.includes(column)
                              ? current.filter((item) => item !== column)
                              : [...current, column].sort((a, b) => a - b);
                          });
                        }}
                        onSelectCell={(row, col, extendSelection) => {
                          setSelectedId(element.id);
                          onActivePageChange(page.pageNumber);
                          setTableRowAnchor(null);
                          setSelectedTableRows([]);
                          setSelectedTableColumns([]);
                          if (row === 0) {
                            setSelectedTableCells([]);
                            return;
                          }
                          setSelectedTableCells((current) => {
                            const alreadySelected = current.some(
                              (cell) => cell.row === row && cell.col === col,
                            );
                            if (!extendSelection) return [{ row, col }];
                            return alreadySelected
                              ? current
                              : [...current, { row, col }];
                          });
                        }}
                        onDblClickCell={(row, col) => {
                          if (element.isEditable) {
                            handleCellDblClick(page, element, row, col);
                          }
                        }}
                        onDragEnd={(e) => handleDragEnd(page.id, e)}
                        onTransformEnd={(e) => handleTransformEnd(page.id, e)}
                        dragBoundFunc={makeDragBoundFunc(page, element)}
                      />
                    );
                  }
                  if (element.type === "image") {
                    return (
                      <ImageElement
                        key={element.id}
                        element={element}
                        {...commonProps}
                        onTransformEnd={(e: Konva.KonvaEventObject<Event>) =>
                          handleTransformEnd(page.id, e)
                        }
                      />
                    );
                  }
                  if (element.type === "rect") {
                    return (
                      <Rect
                        key={element.id}
                        {...commonProps}
                        width={element.width}
                        height={element.height}
                        fill={element.fill}
                        onTransformEnd={(e) => handleTransformEnd(page.id, e)}
                      />
                    );
                  }
                  return (
                    <Text
                      key={element.id}
                      {...commonProps}
                      width={element.width}
                      height={element.height}
                      text={element.text}
                      fontSize={element.fontSize}
                      lineHeight={element.lineHeight}
                      fill={element.fill}
                      fontFamily={element.fontFamily ?? "Arial"}
                      fontStyle={
                        [
                          element.fontWeight === "bold" ? "bold" : "",
                          element.italic ? "italic" : "",
                        ]
                          .filter(Boolean)
                          .join(" ") || "normal"
                      }
                      textDecoration={
                        element.underline ? "underline" : "normal"
                      }
                      onTransformEnd={(e) => handleTransformEnd(page.id, e)}
                    />
                  );
                })}
              </Group>
            );
          })}
          {/* Transformer for the selected element */}
          <Transformer
            ref={transformerRef}
            rotateEnabled={false}
            keepRatio={false}
            boundBoxFunc={(oldBox, newBox) => {
              // Enforce minimum size
              if (newBox.width < 20 || newBox.height < 10) {
                return oldBox;
              }
              return newBox;
            }}
          />
        </Layer>
      </Stage>
      {/* Inline text editing overlay */}
      {editingBox && (
        <textarea
          key={`${editingId}-${editingCell ? `${editingCell.row}-${editingCell.col}` : "text"}`}
          autoFocus
          className="border-primary fixed z-[100] m-0 resize-none border-2 border-dashed bg-white/95 p-0 outline-none"
          style={{
            left: editingBox.left,
            top: editingBox.top,
            width: editingBox.width,
            height: editingBox.height,
            fontSize: editingBox.fontSize,
            color: editingBox.color,
          }}
          value={editingCell ? editingCellValue : editingTextValue}
          inputMode={
            editingCell && editingCell.row > 0 &&
            (editingCell.col === 0 || editingCell.col === 3)
              ? "numeric"
              : undefined
          }
          onChange={(e) => {
            const raw = e.currentTarget.value;
            if (!editingCell) {
              setEditingTextValue(raw);
              return;
            }
            if (editingCell.row > 0 && editingCell.col === 0) {
              setEditingCellValue(raw.replace(/\D/g, ""));
            } else if (editingCell.row > 0 && editingCell.col === 3) {
              setEditingCellValue(raw.replace(/\D/g, ""));
            } else {
              setEditingCellValue(raw);
            }
          }}
          onBlur={(e) => commitTextEdit(e.currentTarget.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.preventDefault();
              const element = pages
                .flatMap((page) => page.elements)
                .find((item) => item.id === editingId);
              const original = editingCell
                ? (element?.table?.cells[editingCell.row]?.[editingCell.col] ??
                  "")
                : (element?.text ?? "");
              commitTextEdit(original);
            }
          }}
          // Prevent Konva from stealing the events
          onMouseDown={(e) => e.stopPropagation()}
          onWheel={(e) => e.stopPropagation()}
        />
      )}
      {/* Table structure controls + formatting toolbar for the selected element */}
      {selectedId &&
        !editingId &&
        pages.some((page) =>
          page.elements.some(
            (element) =>
              element.id === selectedId &&
              (element.isEditable ?? element.isRowDeletable),
          ),
        ) && (
          <FloatingToolbar
            pages={pages}
            selectedId={selectedId}
            selectedRows={selectedTableRows}
            onClearSelectedRows={() => {
              setSelectedTableRows([]);
              setSelectedTableCells([]);
              setTableRowAnchor(null);
            }}
            onElementChange={onElementChange}
            onDeleteElement={(id) => {
              onDeleteElement(id);
              setSelectedId(null);
            }}
            onDuplicateElement={onDuplicateElement}
          />
        )}
    </div>
  );
}

type LoadedImageState = {
  src: string;
  image: HTMLImageElement | null;
  status: "idle" | "loading" | "loaded" | "error";
  retry: () => void;
};

/** Loads an image for Konva and exposes its loading state to the canvas. */
function useLoadedImage(src: string | undefined): LoadedImageState {
  const [retryCount, setRetryCount] = useState(0);
  const [state, setState] = useState<LoadedImageState>({
    src: "",
    image: null,
    status: "idle",
    retry: () => setRetryCount((count) => count + 1),
  });

  const retry = useCallback(() => setRetryCount((count) => count + 1), []);

  useEffect(() => {
    if (!src) return;

    let active = true;
    const img = new window.Image();
    // External product images (e.g. S3) must be fetched anonymously so the
    // canvas isn't tainted — otherwise stage.toDataURL() during PDF export
    // throws a security error. Requires the host to send permissive CORS
    // headers (S3 public buckets typically do).
    img.crossOrigin = "anonymous";
    img.onload = () => {
      if (active) setState({ src, image: img, status: "loaded", retry });
    };
    img.onerror = () => {
      if (active) setState({ src, image: null, status: "error", retry });
    };
    img.src = src;
    return () => {
      active = false;
      img.onload = null;
      img.onerror = null;
    };
  }, [src, retryCount, retry]);

  // Show loading immediately when `src` changes, before the effect updates
  // state, and avoid briefly rendering the previous source's image.
  if (!src) return { src: "", image: null, status: "idle", retry };
  if (state.src !== src) return { src, image: null, status: "loading", retry };
  return state;
}

/**
 * Renders an image element. Shows a placeholder rect when no src is set.
 * The src is set via the FloatingToolbar file picker.
 */
function ImageElement({
  element,
  ...rest
}: {
  element: TemplateElement;
} & Record<string, unknown>) {
  const imageState = useLoadedImage(element.src);
  const shapeProps = rest as unknown as Konva.RectConfig & Konva.ImageConfig;
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
    );
  }
  if (imageState.status === "loading" || imageState.status === "error") {
    const x = typeof shapeProps.x === "number" ? shapeProps.x : element.x;
    const y = typeof shapeProps.y === "number" ? shapeProps.y : element.y;
    const failed = imageState.status === "error";

    return (
      <>
        <Rect
          {...shapeProps}
          width={element.width}
          height={element.height}
          fill={failed ? "#fef2f2" : "#f3f4f6"}
          stroke={failed ? "#fca5a5" : "#d1d5db"}
          strokeWidth={1}
        />
        <Text
          x={x + 8}
          y={y + 8}
          width={Math.max(0, element.width - 16)}
          height={Math.max(0, element.height - 16)}
          text={
            failed
              ? `${t("image.failed")} · ${t("image.retry")}`
              : t("image.loading")
          }
          fontSize={13}
          fill={failed ? "#b91c1c" : "#525252"}
          align="center"
          verticalAlign="middle"
          wrap="word"
          listening={false}
        />
        {failed && (
          <Rect
            x={x}
            y={y}
            width={element.width}
            height={element.height}
            fill="rgba(0,0,0,0)"
            onMouseEnter={(event) => {
              const container = event.target.getStage()?.container();
              if (container) container.style.cursor = "pointer";
            }}
            onMouseLeave={(event) => {
              const container = event.target.getStage()?.container();
              if (container) container.style.cursor = "default";
            }}
            onClick={(event) => {
              event.cancelBubble = true;
              imageState.retry();
            }}
            onTap={(event) => {
              event.cancelBubble = true;
              imageState.retry();
            }}
          />
        )}
      </>
    );
  }
  return (
    <KonvaImage
      {...shapeProps}
      image={imageState.image ?? undefined}
      width={element.width}
      height={element.height}
    />
  );
}
