"use client";

import { t } from "@/i18n/messages";
import type { PageData } from "./types";
import { ActionsMenu } from "./actions-menu";
import type { SavedIdentity } from "../_hooks/use-quotation-persistence";

interface EditorToolbarProps {
  pages: PageData[];
  activePageNumber: number;
  saved: SavedIdentity | null;
  isDirty: boolean;
  canUndo: boolean;
  canRedo: boolean;
  canSave: boolean;
  isSaving: boolean;
  isExporting: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onAddElement: (type: "text" | "rect" | "table" | "image") => void;
  onAddPage: () => void;
  onDeletePage: (pageNumber: number) => void;
  onAddProducts: () => void;
  onSave: () => void;
  onExportPdf: () => void;
}

/**
 * The slim editor header: title, saved/draft + unsaved badges, the actions
 * dropdown, and the Save / Export-PDF buttons. Presentational only — all state
 * and handlers are owned by the editor container.
 */
export function EditorToolbar({
  pages,
  activePageNumber,
  saved,
  isDirty,
  canUndo,
  canRedo,
  canSave,
  isSaving,
  isExporting,
  onUndo,
  onRedo,
  onAddElement,
  onAddPage,
  onDeletePage,
  onAddProducts,
  onSave,
  onExportPdf,
}: EditorToolbarProps) {
  // A page is deletable when it is not the (first) header page, not the fixed
  // policies page, and there is more than the header + policies left.
  const canDeletePage =
    pages.length > 2 &&
    pages[activePageNumber - 1]?.elements.some(
      (element) => element.id === "policies-body",
    ) !== true &&
    activePageNumber > 1;

  return (
    <header className="flex min-h-12 shrink-0 flex-wrap items-center justify-between gap-y-2 border-b border-neutral-200 bg-white px-2 py-2 sm:h-12 sm:flex-nowrap sm:px-4 sm:py-0">
      <div className="flex min-w-0 items-center gap-2 sm:gap-3">
        <h1 className="truncate text-sm font-semibold sm:text-base">
          {t("editor.title")}
        </h1>
        {/* Draft until saved; shows the DB-assigned number once persisted. */}
        {saved ? (
          <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-semibold whitespace-nowrap text-green-800 sm:px-2.5 sm:text-xs">
            {t("editor.quotationNumber", { number: saved.quotationNumber })}
          </span>
        ) : (
          <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-semibold whitespace-nowrap text-neutral-500 sm:px-2.5 sm:text-xs">
            {t("editor.draft")}
          </span>
        )}
        {/* Unsaved-changes indicator. */}
        {isDirty && (
          <span className="hidden items-center gap-1 text-xs font-medium text-amber-600 sm:flex">
            <span
              className="h-1.5 w-1.5 rounded-full bg-amber-500"
              aria-hidden="true"
            />
            {t("editor.unsaved")}
          </span>
        )}
      </div>
      <div className="flex w-full items-center justify-end gap-1 sm:w-auto sm:gap-2">
        <ActionsMenu
          canUndo={canUndo}
          canRedo={canRedo}
          onUndo={onUndo}
          onRedo={onRedo}
          onAddElement={onAddElement}
          onAddPage={onAddPage}
          onDeletePage={() => onDeletePage(activePageNumber)}
          canDeletePage={canDeletePage}
          onAddProducts={onAddProducts}
        />
        <button
          onClick={onSave}
          disabled={isSaving || !canSave}
          className="rounded bg-green-600 px-2 py-1.5 text-xs whitespace-nowrap text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50 sm:px-3 sm:text-sm"
        >
          {isSaving
            ? t("editor.saving")
            : saved
              ? t("editor.save")
              : t("editor.saveQuotation")}
        </button>
        <button
          onClick={onExportPdf}
          disabled={!saved || isExporting}
          className="bg-primary rounded px-2 py-1.5 text-xs whitespace-nowrap text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 sm:px-3 sm:text-sm"
        >
          {isExporting ? t("editor.exporting") : t("editor.exportPdf")}
        </button>
      </div>
    </header>
  );
}
