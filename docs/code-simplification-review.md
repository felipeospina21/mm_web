# Code simplification review

Read-only review focused on making files easier to navigate and maintain. This is a prioritized set of extraction candidates, not a list of files to split just because they are long.

## Recommended first steps

1. **Split `quotation-canvas.tsx` by responsibility.** Clipboard serialization and paste transforms now live in `_lib/clipboard.ts`. Inline editing state and workflows live in `use-inline-editing.ts`, with the textarea rendered by `inline-text-editor.tsx`. Konva page and element rendering now lives in `canvas-page-renderer.tsx`; stage sizing, active-page tracking, pointer paste positioning, and deselection live in `use-canvas-stage.ts`. Table selection state lives in `use-table-selection.ts`, and page geometry helpers live in `_lib/quotation-canvas-geometry.ts`. Remaining follow-up:
   - Consider extracting image loading/rendering from the page renderer if it grows further.
2. **Extract editor state workflows from `editor-client.tsx` (924 lines).** The file combines page history, initial quotation construction, save state, quotation hydration, element/page actions, keyboard shortcuts, and PDF export. Start with `use-page-history` for history/ref synchronization and a quotation load/hydration hook for loading a saved record; leave the page as the composition layer. Avoid moving all state at once because the callbacks share refs and mutation state.
3. **Separate toolbar sections and table operations from `floating-toolbar.tsx` (279 lines).** Extract text formatting controls, table controls, and shared add/remove row/column transformations. Keep the toolbar responsible for choosing which section to show. The current component mixes rendering with table-data mutation logic.

## Smaller, low-risk cleanup

- **`template-data.ts` (734 lines):** Split static page/element factories from quotation-to-pages assembly, inventory table construction, and template interpolation. Extract one `hasNationalProductionCategory` predicate because the category normalization is duplicated for the inventory table and its footnote.
- **`client-field.tsx` (271 lines):** Move the create-client dialog and its form/contact rows into a focused component. The parent can retain client selection/query state; the dialog can own form state and emit the completed client. This would make the selection component much easier to scan.
- **Shared Escape/outside-click behavior:** `actions-menu.tsx`, `add-product-modal.tsx`, `confirm-modal.tsx`, and `searchable-select.tsx` each manage document/window listeners. A small, well-named hook may centralize listener lifecycle, but only if its API remains simpler than the four current effects.
- **`floating-toolbar.tsx` and `template-data.ts`:** Keep extraction boundaries aligned to domain concepts (text formatting, table editing, inventory construction), not generic one-use wrappers.

## Suggested order

Clipboard helpers, inline editing, page rendering, and stage interactions are extracted from `quotation-canvas.tsx`. Next extract the history workflow from `editor-client.tsx`. These boundaries separate pure transformations or cohesive state groups first, which should make subsequent changes smaller and easier to review.

## Scope note

The editor currently has no editor-specific tests, so behavior-sensitive extractions—especially clipboard, inline editing, history, and hydration—should add tests alongside the refactor. File sizes and locations were checked against the current working tree on 2026-10-21.
