"use client";

import { t } from "@/i18n/messages";

interface TableControlsProps {
  /** Whether the table supports structural edits (add/remove row/column). */
  isEditable: boolean;
  /** Whether selected rows can be deleted. */
  isRowDeletable: boolean;
  /** Number of currently selected rows (drives the remove-rows disabled state). */
  selectedRowCount: number;
  onAddRow: () => void;
  onRemoveRow: () => void;
  onAddColumn: () => void;
  onRemoveColumn: () => void;
  onRemoveSelectedRows: () => void;
}

/** Add/remove row & column controls, plus remove-selected-rows. */
export function TableControls({
  isEditable,
  isRowDeletable,
  selectedRowCount,
  onAddRow,
  onRemoveRow,
  onAddColumn,
  onRemoveColumn,
  onRemoveSelectedRows,
}: TableControlsProps) {
  return (
    <>
      {isEditable && (
        <>
          <span className="text-xs text-neutral-700">{t("toolbar.table")}</span>
          <button
            className="h-7 rounded border border-neutral-300 bg-neutral-100 px-2.5 text-xs"
            onClick={onAddRow}
            title={t("toolbar.addRow")}
          >
            + {t("toolbar.row")}
          </button>
          <button
            className="h-7 rounded border border-neutral-300 bg-neutral-100 px-2.5 text-xs"
            onClick={onRemoveRow}
            title={t("toolbar.removeRow")}
          >
            − {t("toolbar.row")}
          </button>
          <button
            className="h-7 rounded border border-neutral-300 bg-neutral-100 px-2.5 text-xs"
            onClick={onAddColumn}
            title={t("toolbar.addColumn")}
          >
            + {t("toolbar.column")}
          </button>
          <button
            className="h-7 rounded border border-neutral-300 bg-neutral-100 px-2.5 text-xs"
            onClick={onRemoveColumn}
            title={t("toolbar.removeColumn")}
          >
            − {t("toolbar.column")}
          </button>
        </>
      )}

      {isRowDeletable && (
        <button
          className="h-7 rounded border border-neutral-300 bg-neutral-100 px-2.5 text-xs disabled:cursor-not-allowed disabled:opacity-50"
          onClick={onRemoveSelectedRows}
          disabled={selectedRowCount === 0}
          title={t("toolbar.removeSelectedRows")}
        >
          {t("toolbar.removeSelectedRows")}
        </button>
      )}
    </>
  );
}
