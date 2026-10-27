"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import type Konva from "konva";
import type { PageData, TemplateElement } from "../_components/types";
import type { EditingBox } from "../_components/inline-text-editor";
import { getPageOffset } from "./quotation-canvas-geometry";

interface InlineEditingOptions {
  pages: PageData[];
  stageRef: { current: Konva.Stage | null };
  /** The scrollable canvas container. Used both to compute overlay positions
   * and to keep the overlay aligned with its cell while scrolling. */
  containerRef: { current: HTMLDivElement | null };
  /** Live scroll offset of the canvas container, used to keep the overlay
   * textarea aligned with its cell while the canvas scrolls. */
  scrollTopRef: { current: number };
  onElementChange: (
    pageId: string,
    elementId: string,
    patch: Partial<TemplateElement>,
  ) => void;
}

function formatEditedCell(
  value: string,
  row: number,
  col: number,
  isLineItemsTable: boolean,
): string {
  if (row === 0 || !isLineItemsTable) return value;
  if (col === 0) return value.replace(/\D/g, "");
  if (col === 3) {
    const amount = Number(value.replace(/\D/g, ""));
    return value.trim() === "" || !Number.isFinite(amount)
      ? ""
      : `$ ${amount.toLocaleString("es-CO")}`;
  }
  return value;
}

function setLineItemSubtotal(row: string[]): void {
  const quantity = row[0]?.replace(/\D/g, "") ?? "";
  const price = row[3]?.replace(/\D/g, "") ?? "";
  row[4] =
    quantity && price
      ? `$ ${(Number(quantity) * Number(price)).toLocaleString("es-CO")}`
      : "";
}

function getCellInputValue(
  value: string,
  element: TemplateElement,
  row: number,
  col: number,
): string {
  if (!element.id.startsWith("line-items-") || row === 0) return value;
  if (col === 0) return value.replace(/\D/g, "");
  if (col === 3) return value.replace(/[^\d-]/g, "");
  return value;
}

export function useInlineEditing({
  pages,
  stageRef,
  containerRef,
  scrollTopRef,
  onElementChange,
}: InlineEditingOptions) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingBox, setEditingBox] = useState<EditingBox | null>(null);
  const [editingCell, setEditingCell] = useState<{
    row: number;
    col: number;
  } | null>(null);
  const [editingTextValue, setEditingTextValue] = useState("");
  const [editingCellValue, setEditingCellValue] = useState("");
  const editingCellValueRef = useRef("");
  /**
   * Top of the active overlay in *content space* — i.e. the viewport `top`
   * the textarea would have if the canvas were scrolled to the top. The
   * canvas renders its Konva layer with `y={-scrollTop}` while the Stage
   * container itself is `position: sticky; top: 0`, so the on-screen cell
   * moves by `-scrollTop`. We store the un-scrolled top here and subtract the
   * live scroll offset so the textarea tracks the cell as the user scrolls.
   */
  const contentTopRef = useRef(0);

  const resetEditing = useCallback(() => {
    setEditingId(null);
    setEditingCell(null);
    setEditingTextValue("");
    setEditingCellValue("");
    editingCellValueRef.current = "";
    setEditingBox(null);
  }, []);

  /**
   * While an overlay is open, keep its `top` aligned with the underlying cell
   * as the canvas container scrolls. Without this the fixed-position textarea
   * would stay put and drift out of bounds of its cell.
   */
  useEffect(() => {
    if (!editingId) return;
    const container = containerRef.current;
    if (!container) return;
    const sync = () => {
      setEditingBox((current) =>
        current
          ? { ...current, top: contentTopRef.current - container.scrollTop }
          : current,
      );
    };
    container.addEventListener("scroll", sync, { passive: true });
    return () => container.removeEventListener("scroll", sync);
  }, [editingId, containerRef]);

  const openTextEditor = useCallback(
    (page: PageData, element: TemplateElement) => {
      const stage = stageRef.current;
      if (!stage) return;
      const stageBox = stage.container().getBoundingClientRect();
      const offset = getPageOffset(page.pageNumber);
      const scrollTop = scrollTopRef.current;
      contentTopRef.current = stageBox.top + offset.y + element.y;
      setEditingId(element.id);
      setEditingCell(null);
      setEditingTextValue(element.text);
      setEditingBox({
        left: stageBox.left + offset.x + element.x,
        top: contentTopRef.current - scrollTop,
        width: element.width,
        height: element.height,
        fontSize: element.fontSize,
        color: element.fill,
      });
    },
    [stageRef, scrollTopRef],
  );

  const openCellEditor = useCallback(
    (page: PageData, element: TemplateElement, row: number, col: number) => {
      const stage = stageRef.current;
      if (!stage || !element.table || !element.isEditable) return;
      if (element.id.startsWith("line-items-") && col === 4) return;
      const stageBox = stage.container().getBoundingClientRect();
      const offset = getPageOffset(page.pageNumber);
      const scrollTop = scrollTopRef.current;
      const { colWidths, rowHeight } = element.table;
      const value = getCellInputValue(
        element.table.cells[row]?.[col] ?? "",
        element,
        row,
        col,
      );
      contentTopRef.current =
        stageBox.top + offset.y + element.y + row * rowHeight;
      setEditingId(element.id);
      setEditingCell({ row, col });
      setEditingTextValue("");
      setEditingCellValue(value);
      editingCellValueRef.current = value;
      setEditingBox({
        left:
          stageBox.left +
          offset.x +
          element.x +
          colWidths.slice(0, col).reduce((a, b) => a + b, 0),
        top: contentTopRef.current - scrollTop,
        width: colWidths[col] ?? 0,
        height: rowHeight,
        fontSize: element.table.fontSize,
        color: row === 0 ? element.table.headerColor : "#333333",
      });
    },
    [stageRef, scrollTopRef],
  );

  const commitTextEdit = useCallback(
    (newText: string) => {
      if (editingId) {
        const page = pages.find((item) =>
          item.elements.some((element) => element.id === editingId),
        );
        if (page) {
          if (editingCell) {
            const element = page.elements.find((item) => item.id === editingId);
            if (element?.table) {
              const cells = element.table.cells.map((row) => [...row]);
              const row = cells[editingCell.row];
              if (row) {
                const lineItems = element.id.startsWith("line-items-");
                row[editingCell.col] = formatEditedCell(
                  newText,
                  editingCell.row,
                  editingCell.col,
                  lineItems,
                );
                if (lineItems && editingCell.row > 0) setLineItemSubtotal(row);
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
      resetEditing();
    },
    [editingId, editingCell, onElementChange, pages, resetEditing],
  );

  const handleEditorChange = useCallback(
    (raw: string) => {
      if (!editingCell) {
        setEditingTextValue(raw);
        return;
      }
      const lineItems =
        editingId?.startsWith("line-items-") && editingCell.row > 0;
      const value =
        lineItems && (editingCell.col === 0 || editingCell.col === 3)
          ? raw.replace(/\D/g, "")
          : raw;
      editingCellValueRef.current = value;
      setEditingCellValue(value);
    },
    [editingCell, editingId],
  );

  const handleEditorKeyDown = useCallback(
    (event: KeyboardEvent<HTMLTextAreaElement>, currentValue: string) => {
      if (event.key === "Tab" && editingCell) {
        event.preventDefault();
        const page = pages.find((item) =>
          item.elements.some((element) => element.id === editingId),
        );
        const element = page?.elements.find((item) => item.id === editingId);
        const table = element?.table;
        if (!page || !element || !table) return;

        const cellCount = table.cells.reduce(
          (count, row) => count + row.length,
          0,
        );
        let nextRow = editingCell.row;
        let nextCol = editingCell.col;
        let foundNextCell = false;
        for (let step = 0; step < cellCount; step += 1) {
          nextCol += 1;
          if (nextCol >= table.colWidths.length) {
            nextRow += 1;
            nextCol = 0;
          }
          if (nextRow >= table.cells.length) {
            nextRow = 0;
            nextCol = 0;
          }
          if (!(element.id.startsWith("line-items-") && nextCol === 4)) {
            foundNextCell = true;
            break;
          }
        }
        if (!foundNextCell) return;

        const { colWidths, rowHeight } = table;
        const cells = table.cells.map((row) => [...row]);
        const currentRow = cells[editingCell.row];
        if (currentRow) {
          const lineItems = element.id.startsWith("line-items-");
          currentRow[editingCell.col] = formatEditedCell(
            currentValue,
            editingCell.row,
            editingCell.col,
            lineItems,
          );
          if (lineItems && editingCell.row > 0) setLineItemSubtotal(currentRow);
          onElementChange(page.id, element.id, { table: { ...table, cells } });
        }

        const stage = stageRef.current;
        if (!stage) return;
        const stageBox = stage.container().getBoundingClientRect();
        const offset = getPageOffset(page.pageNumber);
        const scrollTop = scrollTopRef.current;
        const nextValue = getCellInputValue(
          table.cells[nextRow]?.[nextCol] ?? "",
          element,
          nextRow,
          nextCol,
        );
        contentTopRef.current =
          stageBox.top + offset.y + element.y + nextRow * rowHeight;
        setEditingCell({ row: nextRow, col: nextCol });
        setEditingCellValue(nextValue);
        editingCellValueRef.current = nextValue;
        setEditingBox({
          left:
            stageBox.left +
            offset.x +
            element.x +
            colWidths.slice(0, nextCol).reduce((a, b) => a + b, 0),
          top: contentTopRef.current - scrollTop,
          width: colWidths[nextCol] ?? 0,
          height: rowHeight,
          fontSize: table.fontSize,
          color: nextRow === 0 ? table.headerColor : "#333333",
        });
        return;
      }

      if (event.key === "Escape") {
        event.preventDefault();
        const element = pages
          .flatMap((page) => page.elements)
          .find((item) => item.id === editingId);
        const original = editingCell
          ? (element?.table?.cells[editingCell.row]?.[editingCell.col] ?? "")
          : (element?.text ?? "");
        commitTextEdit(original);
      }
    },
    [commitTextEdit, editingCell, editingId, onElementChange, pages, stageRef, scrollTopRef],
  );

  return {
    editingId,
    editingBox,
    editingCell,
    editingTextValue,
    editingCellValue,
    inputMode:
      editingCell &&
      editingId?.startsWith("line-items-") &&
      editingCell.row > 0 &&
      (editingCell.col === 0 || editingCell.col === 3)
        ? ("numeric" as const)
        : undefined,
    editorValue: editingCell ? editingCellValue : editingTextValue,
    openTextEditor,
    openCellEditor,
    commitTextEdit,
    handleEditorChange,
    handleEditorKeyDown,
  };
}
