# Editor key logic: test coverage gaps

Quick review of keyboard and clipboard behavior in the quotation editor. The current test suite has no tests for `src/app/editor`, so the behaviors below are uncovered.

## Highest priority

- **Global shortcuts and focus:** `editor-client.tsx` handles Cmd/Ctrl+Z, Shift+Cmd/Ctrl+Z, Delete/Backspace, and Cmd/Ctrl+D at the window level. Only deletion checks for `INPUT` and `TEXTAREA`; shortcuts may also fire from contenteditable elements, selects, or other controls. Cover typing focus, modifier variants, no selection, and preventing browser defaults.
- **Clipboard row/column selection:** `quotation-canvas.tsx` serializes selected rows, columns, or cells to tab/newline-delimited text and pastes that text back into tables. Verify row/column precedence, non-contiguous selection, header exclusion, bounds/row growth, and that calculated line-item totals are preserved or recomputed correctly.
- **Clipboard paste routing:** Paste can update selected table cells or create an image at the remembered paste position. Cover text vs. image clipboard payloads, missing/invalid payloads, and ensure paste does not target a stale selection or position after changing pages/elements.

## Other gaps

- **Escape and listener cleanup:** `actions-menu.tsx` closes on Escape/outside click; other modal components also attach Escape handlers. Verify closing behavior and that listeners are removed on close/unmount.
- **Delete/duplicate selection:** Verify shortcuts act on the currently selected element, do nothing when selection is empty, and update undo history and selection consistently.
- **Table edit keyboard behavior:** Verify Escape cancels edits, Enter/blur commits, and shortcut handlers do not interfere while the cell editor is active.

## Suggested first tests

Extract the editor keydown decisions and table clipboard serialization/paste transforms into small pure helpers. Unit test those helpers, then add focused component tests for focus suppression, selection routing, and listener cleanup.
