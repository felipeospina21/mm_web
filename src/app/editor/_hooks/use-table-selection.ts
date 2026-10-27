import { useCallback, useState } from "react";

export function useTableSelection() {
  const [selectedRows, setSelectedRows] = useState<number[]>([]);
  const [selectedColumns, setSelectedColumns] = useState<number[]>([]);
  const [selectedCells, setSelectedCells] = useState<
    Array<{ row: number; col: number }>
  >([]);
  const [rowAnchor, setRowAnchor] = useState<number | null>(null);

  const clear = useCallback(() => {
    setSelectedRows([]);
    setSelectedColumns([]);
    setSelectedCells([]);
    setRowAnchor(null);
  }, []);

  return {
    selectedRows,
    setSelectedRows,
    selectedColumns,
    setSelectedColumns,
    selectedCells,
    setSelectedCells,
    rowAnchor,
    setRowAnchor,
    clear,
  };
}
