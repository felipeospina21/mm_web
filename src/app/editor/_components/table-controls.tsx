"use client";

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
          <span className="text-xs text-neutral-700">Tabla</span>
          <button
            className="h-7 rounded border border-neutral-300 bg-neutral-100 px-2.5 text-xs"
            onClick={onAddRow}
            title="Agregar fila"
          >
            + {"Fila"}
          </button>
          <button
            className="h-7 rounded border border-neutral-300 bg-neutral-100 px-2.5 text-xs"
            onClick={onRemoveRow}
            title="Eliminar última fila"
          >
            − {"Fila"}
          </button>
          <button
            className="h-7 rounded border border-neutral-300 bg-neutral-100 px-2.5 text-xs"
            onClick={onAddColumn}
            title="Agregar columna"
          >
            + {"Col."}
          </button>
          <button
            className="h-7 rounded border border-neutral-300 bg-neutral-100 px-2.5 text-xs"
            onClick={onRemoveColumn}
            title="Eliminar última columna"
          >
            − {"Col."}
          </button>
        </>
      )}

      {isRowDeletable && (
        <button
          className="h-7 rounded border border-neutral-300 bg-neutral-100 px-2.5 text-xs disabled:cursor-not-allowed disabled:opacity-50"
          onClick={onRemoveSelectedRows}
          disabled={selectedRowCount === 0}
          title="Eliminar filas seleccionadas"
        >
          Eliminar filas seleccionadas
        </button>
      )}
    </>
  );
}
