"use client";

import type { PageData, TemplateElement } from "./types";
import { t } from "@/i18n/messages";
import {
  addColumn,
  addRow,
  removeColumn,
  removeRow,
  removeSelectedRows,
} from "../_lib/table-ops";
import { TextFormatControls } from "./text-format-controls";
import { TableControls } from "./table-controls";

interface FloatingToolbarProps {
  pages: PageData[];
  selectedId: string;
  onElementChange: (
    pageId: string,
    elementId: string,
    patch: Partial<TemplateElement>,
  ) => void;
  onDeleteElement: (elementId: string) => void;
  onDuplicateElement: (elementId: string) => void;
  selectedRows: number[];
  onClearSelectedRows: () => void;
}

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
  selectedRows,
  onClearSelectedRows,
}: FloatingToolbarProps) {
  const page = pages.find((p) => p.elements.some((el) => el.id === selectedId));
  const element = page?.elements.find((el) => el.id === selectedId);
  if (!page || (!element?.isEditable && !element?.isRowDeletable)) return null;

  const patch = (p: Partial<TemplateElement>) =>
    onElementChange(page.id, element.id, p);

  const isText = element.type === "text";
  const isTable = element.type === "table" && element.table;
  const isImage = element.type === "image";

  const handleImageUpload = (file: File | undefined) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        patch({ src: reader.result });
      }
    };
    reader.readAsDataURL(file);
  };

  const addRowAction = () => {
    if (!element.table) return;
    patch(addRow(element.table));
  };

  const removeRowAction = () => {
    if (!element.table) return;
    const result = removeRow(element.table);
    if (result) patch(result);
  };

  const removeSelectedRowsAction = () => {
    if (!element.table) return;
    const result = removeSelectedRows(element.table, selectedRows);
    if (!result) return;
    patch(result);
    onClearSelectedRows();
  };

  const addColumnAction = () => {
    if (!element.table) return;
    patch(addColumn(element.table));
  };

  const removeColumnAction = () => {
    if (!element.table) return;
    const result = removeColumn(element.table);
    if (result) patch(result);
  };

  return (
    <div
      className="fixed top-28 left-2 z-40 flex max-w-[calc(100vw-16px)] -translate-x-0 items-center gap-2 overflow-x-auto rounded-md bg-white px-2.5 py-1.5 shadow-[0_2px_10px_rgba(0,0,0,0.35)] sm:top-16 sm:left-1/2 sm:-translate-x-1/2"
      onMouseDown={(e) => e.stopPropagation()}
    >
      {isText && <TextFormatControls element={element} patch={patch} />}

      {isImage && (
        <label className="flex items-center gap-1 text-xs text-neutral-700">
          {t("toolbar.image")}
          <input
            type="file"
            accept="image/*"
            onChange={(e) => handleImageUpload(e.target.files?.[0])}
            className="text-[11px]"
          />
        </label>
      )}

      {isTable && (
        <TableControls
          isEditable={Boolean(element.isEditable)}
          isRowDeletable={Boolean(element.isRowDeletable)}
          selectedRowCount={selectedRows.length}
          onAddRow={addRowAction}
          onRemoveRow={removeRowAction}
          onAddColumn={addColumnAction}
          onRemoveColumn={removeColumnAction}
          onRemoveSelectedRows={removeSelectedRowsAction}
        />
      )}

      <span className="h-5 w-px bg-neutral-200" />

      <button
        className="h-7 rounded border border-neutral-300 bg-neutral-100 px-2.5 text-xs"
        title={t("toolbar.duplicate")}
        onClick={() => onDuplicateElement(element.id)}
      >
        {t("toolbar.duplicateShort")}
      </button>
      <button
        className="h-7 rounded border border-neutral-300 bg-neutral-100 px-2.5 text-xs text-red-700"
        title={t("toolbar.delete")}
        onClick={() => onDeleteElement(element.id)}
      >
        {t("toolbar.deleteShort")}
      </button>
    </div>
  );
}
