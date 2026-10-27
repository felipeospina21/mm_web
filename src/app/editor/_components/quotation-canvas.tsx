"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ClipboardEvent as ReactClipboardEvent } from "react";
import { Layer, Stage, Transformer } from "react-konva";
import type Konva from "konva";
import FloatingToolbar from "./floating-toolbar";
import { InlineTextEditor } from "./inline-text-editor";
import { CanvasPageRenderer } from "./canvas-page-renderer";
import { useInlineEditing } from "../_lib/use-inline-editing";
import { useCanvasStage } from "../_lib/use-canvas-stage";
import { useTableSelection } from "../_lib/use-table-selection";
import type { PageData, TemplateElement } from "./types";
import { PAGE_GAP, PAGE_HEIGHT, PAGE_WIDTH, STAGE_BG } from "./types";
import {
  cloneElement,
  findSelectedTable,
  getTableClipboardText,
  makePastedElement,
  pasteIntoTable,
} from "../_lib/clipboard";
import { getPageOffset } from "../_lib/quotation-canvas-geometry";

interface QuotationCanvasProps {
  pages: PageData[];
  onElementChange: (
    pageId: string,
    elementId: string,
    patch: Partial<TemplateElement>,
  ) => void;
  onDeleteElement: (elementId: string) => void;
  onDuplicateElement: (elementId: string) => void;
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

/** Compatibility export for consumers that import page geometry from the canvas. */
export { getPageOffset } from "../_lib/quotation-canvas-geometry";

export default function QuotationCanvas({
  pages,
  onElementChange,
  onDeleteElement,
  onDuplicateElement,
  onSelectionChange,
  onActivePageChange,
  activePageNumber,
  onPasteImage,
  onPasteElement,
}: QuotationCanvasProps) {
  const scrollTopRef = useRef(0);
  const [scrollTop, setScrollTop] = useState(0);
  const [visiblePageNumbers, setVisiblePageNumbers] = useState<Set<number>>(
    () => new Set([1, 2, 3]),
  );
  const visiblePageNumbersRef = useRef(visiblePageNumbers);
  const stage = useCanvasStage({
    pages,
    onActivePageChange,
    onSelectionChange,
    scrollTopRef,
  });
  const tableSelection = useTableSelection();
  const inlineEditing = useInlineEditing({
    pages,
    stageRef: stage.stageRef,
    containerRef: stage.containerRef,
    scrollTopRef,
    onElementChange,
  });
  const transformerRef = useRef<Konva.Transformer | null>(null);
  const elementClipboardRef = useRef<TemplateElement | null>(null);

  useEffect(() => {
    const container = stage.containerRef.current;
    if (!container) return;

    const updateVisiblePages = () => {
      scrollTopRef.current = container.scrollTop;
      setScrollTop(container.scrollTop);
      const pageStride = PAGE_HEIGHT + PAGE_GAP;
      const firstVisiblePage = Math.max(
        1,
        Math.floor((container.scrollTop - PAGE_GAP) / pageStride) + 1,
      );
      const lastVisiblePage = Math.min(
        pages.length,
        Math.ceil(
          (container.scrollTop + container.clientHeight - PAGE_GAP) /
            pageStride,
        ) + 1,
      );
      const next = new Set<number>();
      for (
        let pageNumber = Math.max(1, firstVisiblePage - 1);
        pageNumber <= Math.min(pages.length, lastVisiblePage + 1);
        pageNumber += 1
      ) {
        next.add(pageNumber);
      }
      setVisiblePageNumbers((current) => {
        if (
          current.size === next.size &&
          [...current].every((pageNumber) => next.has(pageNumber))
        ) {
          return current;
        }
        visiblePageNumbersRef.current = next;
        return next;
      });
    };

    updateVisiblePages();
    container.addEventListener("scroll", updateVisiblePages, { passive: true });
    const observer = new ResizeObserver(updateVisiblePages);
    observer.observe(container);
    return () => {
      container.removeEventListener("scroll", updateVisiblePages);
      observer.disconnect();
    };
  }, [pages.length, stage.containerRef, scrollTopRef]);

  useEffect(() => {
    if (visiblePageNumbersRef.current.has(activePageNumber)) return;
    const next = new Set(visiblePageNumbersRef.current).add(activePageNumber);
    visiblePageNumbersRef.current = next;
    setVisiblePageNumbers(next);
  }, [activePageNumber]);

  const handlePaste = useCallback(
    (event: ReactClipboardEvent<HTMLDivElement>) => {
      const target = event.target as HTMLElement;
      if (target.closest("input, textarea, [contenteditable='true']")) return;
      const clipboardText = event.clipboardData.getData("text/plain");
      // Prefer real clipboard images over the editor's in-memory element copy.
      // The latter remains available after copying an editor element, while
      // image clipboard payloads commonly have no plain text.
      const image = Array.from(event.clipboardData.items).find((item) =>
        item.type.startsWith("image/"),
      );
      const file = image?.getAsFile();
      if (file) {
        event.preventDefault();
        const reader = new FileReader();
        reader.onload = () => {
          if (typeof reader.result !== "string") return;
          const { pageNumber, x, y } = stage.pastePositionRef.current;
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
        return;
      }
      if (!clipboardText && elementClipboardRef.current) {
        const { pageNumber, x, y } = stage.pastePositionRef.current;
        if (!pages.some((page) => page.pageNumber === pageNumber)) return;
        event.preventDefault();
        onPasteElement(
          pageNumber,
          makePastedElement(
            elementClipboardRef.current,
            x,
            y,
            PAGE_WIDTH,
            PAGE_HEIGHT,
          ),
        );
        return;
      }

      const selectedTable = findSelectedTable(pages, stage.selectedId);
      if (
        clipboardText &&
        selectedTable?.element.isEditable &&
        selectedTable.table
      ) {
        const result = pasteIntoTable(
          clipboardText,
          selectedTable.table,
          selectedTable.element,
          {
            rows: tableSelection.selectedRows,
            columns: tableSelection.selectedColumns,
            cells: tableSelection.selectedCells,
          },
        );
        if (result) {
          event.preventDefault();
          onElementChange(selectedTable.page.id, selectedTable.element.id, {
            ...(result.height === undefined ? {} : { height: result.height }),
            table: { ...selectedTable.table, cells: result.cells },
          });
          if (result.selectedRows)
            tableSelection.setSelectedRows(result.selectedRows);
          if (result.clearSelectedCells) tableSelection.setSelectedCells([]);
          return;
        }
      }

    },
    [
      onPasteElement,
      onElementChange,
      onPasteImage,
      pages,
      stage.selectedId,
      tableSelection,
    ],
  );

  const handleCopy = useCallback(
    (event: ReactClipboardEvent<HTMLDivElement>) => {
      const target = event.target as HTMLElement;
      if (target.closest("input, textarea, [contenteditable='true']")) return;
      const selectedElement = pages
        .flatMap((page) => page.elements)
        .find((element) => element.id === stage.selectedId);
      const selectedTable = pages
        .flatMap((page) => page.elements)
        .find((element) => element.id === stage.selectedId && element.table);
      if (!selectedTable?.table) {
        if (!selectedElement) return;
        event.preventDefault();
        elementClipboardRef.current = cloneElement(selectedElement);
        event.clipboardData.setData("text/plain", "");
        return;
      }
      const clipboardText = getTableClipboardText(selectedTable.table, {
        rows: tableSelection.selectedRows,
        columns: tableSelection.selectedColumns,
        cells: tableSelection.selectedCells,
      });
      if (clipboardText === null) {
        if (!selectedElement) return;
        event.preventDefault();
        elementClipboardRef.current = cloneElement(selectedElement);
        event.clipboardData.setData("text/plain", "");
        return;
      }
      event.preventDefault();
      event.clipboardData.setData("text/plain", clipboardText);
    },
    [pages, stage.selectedId, tableSelection],
  );

  const makeDragBoundFunc = useCallback(
    (page: PageData, element: TemplateElement) => {
      return (pos: Konva.Vector2d): Konva.Vector2d => {
        const pageOffset = getPageOffset(page.pageNumber);
        const visiblePageY = pageOffset.y - scrollTopRef.current;
        return {
          x: Math.min(
            Math.max(pos.x, pageOffset.x),
            pageOffset.x + PAGE_WIDTH - element.width,
          ),
          y: Math.min(
            Math.max(pos.y, visiblePageY),
            visiblePageY + PAGE_HEIGHT - element.height,
          ),
        };
      };
    },
    [scrollTopRef],
  );

  const handleDragEnd = useCallback(
    (pageId: string, event: Konva.KonvaEventObject<DragEvent>) => {
      const page = pages.find((item) => item.id === pageId);
      if (!page) return;
      const offset = getPageOffset(page.pageNumber);
      onElementChange(pageId, event.target.id(), {
        x: event.target.x() - offset.x,
        y: event.target.y() - offset.y,
      });
    },
    [onElementChange, pages],
  );

  const handleTransformEnd = useCallback(
    (pageId: string, event: Konva.KonvaEventObject<Event>) => {
      const node = event.target as Konva.Shape;
      const page = pages.find((item) => item.id === pageId);
      if (!page) return;
      const offset = getPageOffset(page.pageNumber);
      const scaleX = node.scaleX();
      const scaleY = node.scaleY();
      node.scaleX(1);
      node.scaleY(1);
      const element = page.elements.find((item) => item.id === node.id());
      if (element?.type === "table" && element.table) {
        onElementChange(pageId, node.id(), {
          x: node.x() - offset.x,
          y: node.y() - offset.y,
          table: {
            ...element.table,
            colWidths: element.table.colWidths.map((width) =>
              Math.max(30, Math.round(width * scaleX)),
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

  useEffect(() => {
    const transformer = transformerRef.current;
    const canvasStage = transformer?.getStage();
    if (!transformer || !canvasStage) return;
    const selectedElement = pages
      .flatMap((page) => page.elements)
      .find((element) => element.id === stage.selectedId);
    const selectedNode = canvasStage.findOne(`#${stage.selectedId}`);
    transformer.nodes(
      selectedElement?.isEditable && selectedNode ? [selectedNode] : [],
    );
  }, [stage.selectedId, pages]);

  const handleSelectRow = useCallback(
    (elementId: string, pageNumber: number, row: number, extend: boolean) => {
      stage.setSelectedId(elementId);
      onActivePageChange(pageNumber);
      if (row === 0) {
        tableSelection.clear();
        return;
      }
      if (
        extend &&
        stage.selectedId === elementId &&
        tableSelection.rowAnchor !== null
      ) {
        const start = Math.min(tableSelection.rowAnchor, row);
        const end = Math.max(tableSelection.rowAnchor, row);
        tableSelection.setSelectedRows(
          Array.from({ length: end - start + 1 }, (_, index) => start + index),
        );
        tableSelection.setSelectedCells([]);
        return;
      }
      tableSelection.setSelectedRows([row]);
      tableSelection.setSelectedColumns([]);
      tableSelection.setSelectedCells([]);
      tableSelection.setRowAnchor(row);
    },
    [onActivePageChange, stage, tableSelection],
  );

  const handleSelectColumn = useCallback(
    (
      elementId: string,
      pageNumber: number,
      column: number,
      extend: boolean,
    ) => {
      stage.setSelectedId(elementId);
      onActivePageChange(pageNumber);
      tableSelection.setRowAnchor(null);
      tableSelection.setSelectedRows([]);
      tableSelection.setSelectedCells([]);
      tableSelection.setSelectedColumns((current) =>
        !extend
          ? [column]
          : current.includes(column)
            ? current.filter((item) => item !== column)
            : [...current, column].sort((a, b) => a - b),
      );
    },
    [onActivePageChange, stage, tableSelection],
  );

  const handleSelectCell = useCallback(
    (
      elementId: string,
      pageNumber: number,
      row: number,
      col: number,
      extend: boolean,
    ) => {
      stage.setSelectedId(elementId);
      onActivePageChange(pageNumber);
      tableSelection.setRowAnchor(null);
      tableSelection.setSelectedRows([]);
      tableSelection.setSelectedColumns([]);
      if (row === 0) {
        tableSelection.setSelectedCells([]);
        return;
      }
      tableSelection.setSelectedCells((current) => {
        const alreadySelected = current.some(
          (cell) => cell.row === row && cell.col === col,
        );
        if (!extend) return [{ row, col }];
        return alreadySelected ? current : [...current, { row, col }];
      });
    },
    [onActivePageChange, stage, tableSelection],
  );

  return (
    <div
      ref={stage.containerRef}
      tabIndex={0}
      onCopy={handleCopy}
      onPaste={handlePaste}
      onKeyDown={(event) => {
        if (
          event.key !== "Tab" ||
          (event.target as HTMLElement).closest("input, textarea")
        )
          return;
        const page = pages.find((item) =>
          item.elements.some((element) => element.id === stage.selectedId),
        );
        const element = page?.elements.find(
          (item) => item.id === stage.selectedId && item.table,
        );
        const table = element?.table;
        if (!page || !element || !table?.cells.length) return;
        const selectedCell = tableSelection.selectedCells.at(-1) ?? {
          row: 1,
          col: -1,
        };
        let row = selectedCell.row;
        let col = selectedCell.col;
        for (
          let step = 0;
          step < table.cells.length * table.colWidths.length;
          step += 1
        ) {
          col += 1;
          if (col >= table.colWidths.length) {
            row += 1;
            col = 0;
          }
          if (row >= table.cells.length) {
            row = 1;
            col = 0;
          }
          if (!(element.id.startsWith("line-items-") && col === 4)) break;
        }
        if (row < table.cells.length && table.cells[row]?.[col] !== undefined) {
          event.preventDefault();
          inlineEditing.openCellEditor(page, element, row, col);
        }
      }}
      className="relative h-full w-full overflow-auto overscroll-contain"
      style={{ background: STAGE_BG }}
    >
      <Stage
        ref={stage.stageRef}
        width={Math.max(stage.stageSize.width, PAGE_WIDTH + 80)}
        height={Math.max(stage.stageSize.height, 1)}
        style={{ background: STAGE_BG, position: "sticky", top: 0, zIndex: 1 }}
        onMouseDown={(event) =>
          stage.handleStageMouseDown(event, tableSelection.clear)
        }
        onTouchStart={(event) =>
          stage.handleStageTouchStart(event, tableSelection.clear)
        }
        onMouseMove={stage.updateActivePageFromPointer}
      >
        <Layer y={-scrollTop}>
          <CanvasPageRenderer
            pages={pages}
            visiblePageNumbers={visiblePageNumbers}
            activePageNumber={activePageNumber}
            selectedId={stage.selectedId}
            selection={{
              rows: tableSelection.selectedRows,
              columns: tableSelection.selectedColumns,
              cells: tableSelection.selectedCells,
            }}
            onSelectElement={(id, pageNumber) =>
              stage.selectElement(id, pageNumber)
            }
            onActivePageChange={onActivePageChange}
            onDragEnd={handleDragEnd}
            onTransformEnd={handleTransformEnd}
            makeDragBoundFunc={makeDragBoundFunc}
            onOpenTextEditor={inlineEditing.openTextEditor}
            onOpenCellEditor={inlineEditing.openCellEditor}
            onSelectRow={handleSelectRow}
            onSelectColumn={handleSelectColumn}
            onSelectCell={handleSelectCell}
          />
          <Transformer
            ref={transformerRef}
            rotateEnabled={false}
            keepRatio={false}
            boundBoxFunc={(oldBox, newBox) =>
              newBox.width < 20 || newBox.height < 10 ? oldBox : newBox
            }
          />
        </Layer>
      </Stage>
      <div
        aria-hidden="true"
        style={{
          height: Math.max(
            0,
            pages.length * (PAGE_HEIGHT + PAGE_GAP) +
              PAGE_GAP -
              Math.max(stage.stageSize.height, 1),
          ),
        }}
      />
      {inlineEditing.editingBox && (
        <InlineTextEditor
          id={inlineEditing.editingId ?? ""}
          isCell={inlineEditing.editingCell !== null}
          box={inlineEditing.editingBox}
          value={inlineEditing.editorValue}
          inputMode={inlineEditing.inputMode}
          onChange={inlineEditing.handleEditorChange}
          onBlur={inlineEditing.commitTextEdit}
          onKeyDown={(event) =>
            inlineEditing.handleEditorKeyDown(event, event.currentTarget.value)
          }
        />
      )}
      {stage.selectedId &&
        pages.some((page) =>
          page.elements.some(
            (element) =>
              element.id === stage.selectedId &&
              (element.isEditable ?? element.isRowDeletable),
          ),
        ) && (
          <FloatingToolbar
            pages={pages}
            selectedId={stage.selectedId}
            selectedRows={tableSelection.selectedRows}
            onClearSelectedRows={() => {
              tableSelection.setSelectedRows([]);
              tableSelection.setSelectedCells([]);
              tableSelection.setRowAnchor(null);
            }}
            onElementChange={onElementChange}
            onDeleteElement={(id) => {
              onDeleteElement(id);
              stage.setSelectedId(null);
            }}
            onDuplicateElement={onDuplicateElement}
          />
        )}
    </div>
  );
}
