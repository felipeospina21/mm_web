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

const FONT_SIZES = [10, 12, 14, 16, 18, 20, 24, 28, 32, 36, 48];
const FONT_FAMILIES = [
  "Arial",
  "Helvetica",
  "Times New Roman",
  "Georgia",
  "Courier New",
  "Verdana",
  "system-ui",
];

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
      {isText && (
        <>
          <label className="flex items-center gap-1 text-xs text-neutral-700">
            {t("toolbar.font")}
            <select
              value={element.fontFamily ?? "Arial"}
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
            {t("toolbar.size")}
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
              element.fontWeight === "bold" ? "font-extrabold" : "font-normal"
            }`}
            title={t("toolbar.bold")}
            onClick={() =>
              patch({
                fontWeight: element.fontWeight === "bold" ? "normal" : "bold",
              })
            }
          >
            B
          </button>
          <button
            className={`h-7 w-7 rounded border border-neutral-300 bg-neutral-100 text-[13px] ${
              element.italic ? "italic" : ""
            }`}
            title={t("toolbar.italic")}
            onClick={() => patch({ italic: !element.italic })}
          >
            I
          </button>
          <button
            className={`h-7 w-7 rounded border border-neutral-300 bg-neutral-100 text-[13px] ${
              element.underline ? "underline" : ""
            }`}
            title={t("toolbar.underline")}
            onClick={() => patch({ underline: !element.underline })}
          >
            U
          </button>
          <label className="flex items-center gap-1 text-xs text-neutral-700">
            {t("toolbar.color")}
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
          {t("toolbar.image")}
          <input
            type="file"
            accept="image/*"
            onChange={(e) => handleImageUpload(e.target.files?.[0])}
            className="text-[11px]"
          />
        </label>
      )}

      {isTable && element.isEditable && (
        <>
          <span className="text-xs text-neutral-700">{t("toolbar.table")}</span>
          <button
            className="h-7 rounded border border-neutral-300 bg-neutral-100 px-2.5 text-xs"
            onClick={() => addRowAction()}
            title={t("toolbar.addRow")}
          >
            + {t("toolbar.row")}
          </button>
          <button
            className="h-7 rounded border border-neutral-300 bg-neutral-100 px-2.5 text-xs"
            onClick={() => removeRowAction()}
            title={t("toolbar.removeRow")}
          >
            − {t("toolbar.row")}
          </button>
          <button
            className="h-7 rounded border border-neutral-300 bg-neutral-100 px-2.5 text-xs"
            onClick={() => addColumnAction()}
            title={t("toolbar.addColumn")}
          >
            + {t("toolbar.column")}
          </button>
          <button
            className="h-7 rounded border border-neutral-300 bg-neutral-100 px-2.5 text-xs"
            onClick={() => removeColumnAction()}
            title={t("toolbar.removeColumn")}
          >
            − {t("toolbar.column")}
          </button>
        </>
      )}

      {isTable && element.isRowDeletable && (
        <button
          className="h-7 rounded border border-neutral-300 bg-neutral-100 px-2.5 text-xs disabled:cursor-not-allowed disabled:opacity-50"
          onClick={removeSelectedRowsAction}
          disabled={selectedRows.length === 0}
          title={t("toolbar.removeSelectedRows")}
        >
          {t("toolbar.removeSelectedRows")}
        </button>
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
