/**
 * Prefix sums of a table's column widths.
 *
 * Returns an array of length `colWidths.length + 1` where `offsets[i]` is the
 * sum of all column widths *before* column `i` (so `offsets[0] === 0`), and the
 * final entry `offsets[colWidths.length]` is the total table width.
 *
 * Computing this once per table turns the common
 * `colWidths.slice(0, col).reduce(...)` lookup — which is O(n) *inside* a loop,
 * i.e. O(n²) across all columns/cells — into an O(1) array read after an O(n)
 * precompute.
 */
export function columnOffsets(colWidths: readonly number[]): number[] {
  const offsets = new Array<number>(colWidths.length + 1);
  offsets[0] = 0;
  for (let i = 0; i < colWidths.length; i += 1) {
    offsets[i + 1] = offsets[i]! + (colWidths[i] ?? 0);
  }
  return offsets;
}
