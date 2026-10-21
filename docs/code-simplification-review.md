# Code simplification review

Read-only review focused on making files easier to navigate and maintain. This is a prioritized set of extraction candidates, not a list of files to split just because they are long.

## Recommended first steps

1. **Split `quotation-canvas.tsx` by responsibility (1,148 lines).** Keep `QuotationCanvas` as the coordinator, and move the Konva page/element rendering into a canvas/page renderer, inline text/cell editing into an editing component or hook, clipboard serialization and paste transforms into a focused clipboard module, and image loading into its own component/hook. The copy and paste handlers currently occupy about 270 lines and contain repeated parsing, cell formatting, bounds handling, and line-item subtotal logic. This is the highest readability payoff; preserve behavior with focused tests during the extraction.
2. **Extract editor state workflows from `editor-client.tsx` (924 lines).** The file combines page history, initial quotation construction, save state, quotation hydration, element/page actions, keyboard shortcuts, and PDF export. Start with `use-page-history` for history/ref synchronization and a quotation load/hydration hook for loading a saved record; leave the page as the composition layer. Avoid moving all state at once because the callbacks share refs and mutation state.
3. **Separate toolbar sections and table operations from `floating-toolbar.tsx` (279 lines).** Extract text formatting controls, table controls, and shared add/remove row/column transformations. Keep the toolbar responsible for choosing which section to show. The current component mixes rendering with table-data mutation logic.

## Smaller, low-risk cleanup

- **`template-data.ts` (734 lines):** Split static page/element factories from quotation-to-pages assembly, inventory table construction, and template interpolation. Extract one `hasNationalProductionCategory` predicate because the category normalization is duplicated for the inventory table and its footnote.
- **`client-field.tsx` (271 lines):** Move the create-client dialog and its form/contact rows into a focused component. The parent can retain client selection/query state; the dialog can own form state and emit the completed client. This would make the selection component much easier to scan.
- **Shared Escape/outside-click behavior:** `actions-menu.tsx`, `add-product-modal.tsx`, `confirm-modal.tsx`, and `searchable-select.tsx` each manage document/window listeners. A small, well-named hook may centralize listener lifecycle, but only if its API remains simpler than the four current effects.
- **`floating-toolbar.tsx` and `template-data.ts`:** Keep extraction boundaries aligned to domain concepts (text formatting, table editing, inventory construction), not generic one-use wrappers.

## Suggested order

Start with clipboard helpers from `quotation-canvas.tsx`, then split canvas rendering/editing, then extract the history workflow from `editor-client.tsx`. These boundaries separate pure transformations or cohesive state groups first, which should make subsequent changes smaller and easier to review.

## Scope note

No source files were changed in this review. The editor currently has no editor-specific tests, so behavior-sensitive extractions—especially clipboard, history, and hydration—should add tests alongside the refactor. File sizes and locations were checked against the current working tree on 2026-10-21.
