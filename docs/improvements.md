# Improvements backlog

> Consolidated from three earlier docs (editor audit, code-simplification review,
> and editor test-gaps). Scope is primarily the quotation editor
> (`src/app/editor/**`) plus the server routers it depends on, with a few
> app-wide cleanup items. Findings are prioritized within each section.
>
> Last verified against the working tree: 2026-10-27. Nothing here changes code —
> it is an analysis/planning document.

Overall the editor is a capable, well-commented canvas editor with genuinely
solid server authorization. The main weaknesses are a God component, brittle
string-prefix "typing" of elements, duplicated logic, missing memoization, a few
validation gaps, and no editor-specific test coverage.

---

## 1. Architecture

### 1.1 `editor-client.tsx` is a God component (~960 lines)

It owns undo/redo history, dirty tracking, save/load mutations, client
hydration, product appending, page CRUD, element CRUD, keyboard shortcuts, PDF
export, and all the toolbar JSX. This is the biggest structural issue and it
directly hurts readability and testability.

- Extract cohesive hooks (the `AGENTS.md` convention explicitly calls for this):
  - `useQuotationHistory` — the `historyRef` / `historyIndexRef` /
    `commitHistory` / `undo` / `redo` cluster.
  - `useQuotationPersistence` — save mutation + dirty / `editRevisionRef` /
    `saveRevisionRef` + `beforeunload`.
  - `useQuotationLoad` — load query + `hydrateFromRow` + confirm-discard.
  - `useEditorKeyboardShortcuts` — the `keydown` effect.
- Extract the header toolbar JSX into an `EditorToolbar` component.
- Avoid moving all state at once: the callbacks share refs and mutation state, so
  extract one cohesive group at a time (start with history), leaving the page as
  the composition layer.

### 1.2 Element identity is encoded in string ID prefixes

`startsWith("line-items-")`, `"product-name-"`, `"product-reference-"`, and
exact IDs `"policies-body"`, `"representative-info"`, `"footer"`,
`"company-name"`, `"customer-name"` are matched by hand across **five** files
(`editor-client`, `use-inline-editing`, `clipboard`, `canvas-page-renderer`, and
even the server `quotation.ts`). This is the most pervasive design smell — it is
untyped, unsearchable-by-type, and a typo silently breaks behavior.

- Add a discriminator to `TemplateElement` (e.g.
  `role?: "line-items" | "product-name" | "policies-body" | …`) or a small
  `elementRole(element)` helper + constants module. Replace the `startsWith` /
  magic-string checks with it. The server reaching into `editor-client`'s string
  conventions (`derivePageFields`) is a layering leak that this would fix.

### 1.3 State is mirrored between `useState` and refs

`pages`/`pagesRef`, plus `historyRef`, `metaRef`, `activePageNumberRef`,
`selectedIdRef`. This is a deliberate pattern to read latest state inside
callbacks without re-subscribing, and it is used carefully — but it is fragile
(every setter must update both) and is the kind of thing a `useReducer` + a
single `dispatch` would make far safer. A reducer would also naturally host the
history stack.

### 1.4 `use-representative-profile` takes 7 props including 4 refs + 2 setters

A sign the data flow is being threaded manually. This mostly resolves once
history/persistence become hooks that own their own refs.

### 1.5 `quotation-canvas.tsx` responsibility split (largely done)

Previous extractions already landed: clipboard serialization/paste transforms
(`_lib/clipboard.ts`), inline editing state + textarea
(`use-inline-editing.ts` / `inline-text-editor.tsx`), Konva page/element
rendering (`canvas-page-renderer.tsx`), stage sizing / active-page / pointer
paste / deselection (`use-canvas-stage.ts`), table selection
(`use-table-selection.ts`), and page geometry (`_lib/quotation-canvas-geometry.ts`).
Remaining follow-up: consider extracting image loading/rendering from the page
renderer if it grows further.

### 1.6 `floating-toolbar.tsx` (279 lines) mixes rendering with table mutations

Extract text-formatting controls, table controls, and the shared add/remove
row/column transformations. Keep the toolbar responsible only for choosing which
section to show.

---

## 2. Performance

### 2.1 No memoization on the Konva render tree

`CanvasPage`, `TableNode`, and the per-element `Text` / `Rect` / `Image` are
plain functions. Any edit replaces the `pages` array, so **every element on every
visible page re-renders** on each keystroke/drag. For a multi-page quotation with
tables this is the dominant cost.

- Wrap `TableNode`, `CanvasPage`, and `ImageElement` in `React.memo`. Note this
  requires fixing 2.2 and 2.3 (unstable props currently defeat memo).

### 2.2 Inline closures create new function identities every render

`commonProps` builds fresh `onMouseDown` / `onDragEnd` / `onDblClick` closures
and `makeDragBoundFunc(page, element)` for every element every render — so
memoizing children would not help until these are stabilized (e.g. pass
`page.id` / `element.id` and look up in the handler, or `useCallback` the
factories).

### 2.3 Repeated `colWidths.slice(0, col).reduce(...)` prefix sums

In `TableNode` (per cell render), `use-inline-editing`, and `clipboard`, column X
offsets are recomputed with O(n) reduces inside loops → O(n²) per table render.
Precompute a cumulative-offset array once.

### 2.4 PDF export loads images sequentially

`exportPagesToPdf` does `for (page) { for (element) await drawElement }` — every
image is fetched/resized/decoded one at a time. For a many-product quotation this
serializes all network + canvas work. Pre-resolve all image data URLs with
`Promise.all` first, then draw synchronously. (Drawing order into jsPDF must stay
sequential, but the expensive async *loading* should be parallelized.)

### 2.5 `useLoadedImage` has a subtle reload pattern

The `return state.src === src ? state : {…"loading"}` computed-during-render
pattern plus `setState` in the effect can cause an extra render cycle. Minor;
worth a look if image flicker appears.

---

## 3. Code readability & best practices

### 3.1 Duplicated line-item logic

`formatEditedCell` and `setLineItemSubtotal` / `updateLineItemSubtotal` are
duplicated verbatim in `use-inline-editing.ts` and `clipboard.ts` (the latter
just renamed `set`→`update`). Extract to a shared `_lib/line-items.ts`. These
encode business rules (quantity = col 0, price = col 3, subtotal = col 4, COP
formatting) that must not drift between the two copies.

### 3.2 Magic column indices

Column indices 0/3/4 for quantity/price/subtotal are repeated everywhere. Name
them (`const LINE_ITEM_COLS = { quantity: 0, price: 3, subtotal: 4 }`).

### 3.3 `alert(...)` for error UX

Used in both save (`onError`) and PDF export. Works, but inconsistent with the
app's `ConfirmModal` / toast patterns and not stylable/testable. Prefer an
in-app notification.

### 3.4 `console.error` / `console.log` in production paths

The save error handler, PDF export, and the tRPC `timingMiddleware` all log to
console. Fine in dev; route through a logger or strip in prod.

### 3.5 `ImageElement` discards prop typing

It uses `Record<string, unknown>` + `as unknown as Konva.RectConfig &
Konva.ImageConfig`. Give it a real props interface.

### 3.6 Save button disable is a real bug

`disabled={saveMutation.isPending ?? !canSave}` in the editor header: `isPending`
is a boolean, never nullish, so `?? !canSave` is dead code. The Save button is
**not** actually disabled when `!canSave` while idle. Almost certainly should be
`saveMutation.isPending || !canSave`.

### 3.7 Pre-existing lint debt in this module

Confirmed via `pnpm lint`:

- `quotation-canvas.tsx` — 11 "Cannot access refs during render" errors plus an
  exhaustive-deps warning. These are legitimate (reading `scrollTopRef.current`,
  `pastePositionRef` in render/JSX) — they can tear under concurrent rendering
  and should move into event handlers/effects.
- `clipboard.ts` and others — `prefer-regexp-exec` and `no-unsafe-return` errors.

### 3.8 App-wide cleanup (outside the editor)

- **`template-data.ts` (727 lines):** Split static page/element factories from
  quotation-to-pages assembly, inventory table construction, and template
  interpolation. Extract one `hasNationalProductionCategory` predicate — the
  category normalization is duplicated for the inventory table and its footnote.
- **`client-field.tsx` (271 lines):** Move the create-client dialog and its
  form/contact rows into a focused component. The parent keeps client
  selection/query state; the dialog owns form state and emits the completed
  client.
- **Shared Escape/outside-click behavior:** `actions-menu.tsx`,
  `add-product-modal.tsx`, `confirm-modal.tsx`, and `searchable-select.tsx` each
  manage document/window listeners. A small, well-named hook could centralize
  listener lifecycle — but only if its API stays simpler than the four current
  effects.

---

## 4. Security

The server side is **better than typical** — credit where due:

- `save` and `byId` both enforce `userId` ownership (`and(eq(id), eq(userId))`),
  with a role gate (`canAccessAllQuotations`) for privileged read. `clientId` is
  verified to belong to the user before save. Inputs use `z.string().uuid()`.
  This correctly prevents IDOR.
- No `dangerouslySetInnerHTML` anywhere in the module. Konva draws text, it does
  not parse HTML, so there is no XSS vector in text rendering.

Gaps:

### 4.1 Quotation `data` is effectively unvalidated (top security item)

`saveInput.data` is `z.custom<PageData[]>(Array.isArray)` — it only checks "is an
array," then stores the blob in JSONB and later re-renders it (into the Konva
canvas and PDF). A client can persist arbitrary JSON shapes. Define a real Zod
schema for `PageData` / `TemplateElement` and parse it.

### 4.2 Image `src` accepts arbitrary values

Images are stored as `src` strings and later `fetch(new URL(src,
window.location.href))` in `pdf-export` and `new Image().src = src` in the
canvas. Pasted/loaded content could carry arbitrary URLs → SSRF-adjacent fetches
from the user's browser and attacker-origin content embedded in exported PDFs.
Constrain `src` to `data:` URLs (what the upload path produces) or an allowlist
of trusted hosts, and validate it in the `PageData` schema from 4.1.

---

## 5. Testing gaps

The editor currently has **no tests** under `src/app/editor` (verified: the only
test files live elsewhere). Behavior-sensitive extractions — especially
clipboard, inline editing, history, and hydration — should add tests alongside
the refactor.

### Highest priority

- **Global shortcuts and focus:** `editor-client.tsx` handles Cmd/Ctrl+Z,
  Shift+Cmd/Ctrl+Z, Delete/Backspace, and Cmd/Ctrl+D at the window level. Only
  deletion checks for `INPUT` and `TEXTAREA`; shortcuts may also fire from
  contenteditable elements, selects, or other controls. Cover typing focus,
  modifier variants, no selection, and preventing browser defaults.
- **Clipboard row/column selection:** table selections are serialized to
  tab/newline-delimited text and pasted back into tables. Verify row/column
  precedence, non-contiguous selection, header exclusion, bounds/row growth, and
  that calculated line-item totals are preserved or recomputed correctly.
- **Clipboard paste routing:** paste can update selected table cells or create an
  image at the remembered paste position. Cover text vs. image clipboard
  payloads, missing/invalid payloads, and that paste does not target a stale
  selection or position after changing pages/elements.

### Other gaps

- **Escape and listener cleanup:** `actions-menu.tsx` closes on Escape/outside
  click; other modal components also attach Escape handlers. Verify closing
  behavior and that listeners are removed on close/unmount.
- **Delete/duplicate selection:** verify shortcuts act on the currently selected
  element, do nothing when selection is empty, and update undo history and
  selection consistently.
- **Table edit keyboard behavior:** verify Escape cancels edits, Enter/blur
  commits, and shortcut handlers do not interfere while the cell editor is active.

### Suggested first tests

Extract the editor keydown decisions and table clipboard serialization/paste
transforms into small pure helpers (overlaps with 1.1, 3.1). Unit test those
helpers, then add focused component tests for focus suppression, selection
routing, and listener cleanup.

---

## 6. Suggested order of attack

1. **Quick wins / bugs:** fix the `isPending ?? !canSave` disable bug (3.6);
   dedupe `formatEditedCell` / subtotal into `_lib/line-items.ts` (3.1); name the
   column-index constants (3.2).
2. **Security:** real Zod schema for `PageData` / `TemplateElement` on `save`
   (4.1); constrain image `src` (4.2).
3. **Architecture:** extract `useQuotationHistory`, `useQuotationPersistence`,
   `useQuotationLoad`, `EditorToolbar` from `editor-client.tsx` (1.1); introduce
   an element-`role` discriminator to kill the string-prefix matching (1.2). Add
   tests alongside each extraction (section 5).
4. **Performance:** stabilize the per-element handler / dragBound closures, then
   `React.memo` `TableNode` / `CanvasPage` (2.1, 2.2); precompute column offsets
   (2.3); parallelize PDF image loading (2.4).
