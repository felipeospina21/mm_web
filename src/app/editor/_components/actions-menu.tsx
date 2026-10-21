"use client";

import { useEffect, useRef, useState } from "react";
import { t } from "@/i18n/messages";
import { ActionsMenuItem } from "./actions-menu-item";

interface ActionsMenuProps {
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onAddElement: (type: "text" | "rect" | "table" | "image") => void;
  onAddPage: () => void;
  onDeletePage: () => void;
  canDeletePage: boolean;
  onAddProducts: () => void;
}

/**
 * Collapsible "Actions" dropdown for the editor toolbar. Groups the
 * undo/redo and add-element options (plus a link back to the catalog to
 * add products) behind a single toggle so the toolbar stays slim.
 */
export function ActionsMenu({
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onAddElement,
  onAddPage,
  onDeletePage,
  canDeletePage,
  onAddProducts,
}: ActionsMenuProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Close on outside click or Escape.
  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="flex items-center gap-1.5 rounded border border-neutral-300 bg-neutral-100 px-2 py-1.5 text-xs hover:bg-neutral-200 sm:px-3 sm:text-sm"
      >
        {t("actions.label")}
        <svg
          className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`}
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden="true"
        >
          <path
            fillRule="evenodd"
            d="M5.23 7.21a.75.75 0 011.06.02L10 11.17l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
            clipRule="evenodd"
          />
        </svg>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-20 mt-2 w-48 rounded-lg border border-neutral-200 bg-white p-1.5 shadow-lg"
        >
          <ActionsMenuItem onClick={onUndo} disabled={!canUndo}>
            {t("actions.undo")}
          </ActionsMenuItem>
          <ActionsMenuItem onClick={onRedo} disabled={!canRedo}>
            {t("actions.redo")}
          </ActionsMenuItem>

          <div className="my-1 h-px bg-neutral-100" aria-hidden="true" />

          <ActionsMenuItem onClick={onAddPage}>
            {t("actions.addPage")}
          </ActionsMenuItem>
          <ActionsMenuItem onClick={onDeletePage} disabled={!canDeletePage}>
            {t("actions.deletePage")}
          </ActionsMenuItem>

          <div className="my-1 h-px bg-neutral-100" aria-hidden="true" />

          <ActionsMenuItem onClick={() => onAddElement("text")}>
            {t("actions.addText")}
          </ActionsMenuItem>
          <ActionsMenuItem onClick={() => onAddElement("rect")}>
            {t("actions.addShape")}
          </ActionsMenuItem>
          <ActionsMenuItem onClick={() => onAddElement("table")}>
            {t("actions.addTable")}
          </ActionsMenuItem>
          <ActionsMenuItem onClick={() => onAddElement("image")}>
            {t("actions.addImage")}
          </ActionsMenuItem>

          <div className="my-1 h-px bg-neutral-100" aria-hidden="true" />

          <ActionsMenuItem
            onClick={() => {
              onAddProducts();
              setOpen(false);
            }}
          >
            {t("actions.addProducts")}
          </ActionsMenuItem>
        </div>
      )}
    </div>
  );
}
