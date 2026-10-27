# Editor improvements — implementation plan

> Execution plan derived from [`improvements.md`](./improvements.md). That doc is
> the catalog of findings (organized by theme); **this** doc is the ordered,
> actionable task list. Tasks are ordered by importance/relevance, not by the
> theme sections in the catalog. Each task lists the target files, the change,
> and acceptance criteria.
>
> References like "(3.6)" point back to the numbered finding in
> `improvements.md`. Line numbers were taken from the working tree on
> 2026-10-27 and may drift — re-confirm before editing.

## Conventions for every task

- Branch off `main` (do **not** commit to `main` directly).
- After each task: `pnpm typecheck && pnpm lint && pnpm test` must pass; add/adjust
  tests where the task says so.
- Keep each task a self-contained commit so it can be reviewed/reverted alone.
- Follow `AGENTS.md`: kebab-case component files, interfaces over type aliases,
  small components, custom hooks to consolidate related state.

---

## Phase 1 — Quick wins & correctness (low risk, high leverage)

These are cheap, safe, and some fix real bugs. Doing them first also makes the
later architecture/testing work cleaner (one canonical line-item module to
refactor and test).

### Task 1.1 — Fix the Save-button disable bug (3.6)

- **File:** `src/app/editor/editor-client.tsx` (~line 900).
- **Change:** `disabled={saveMutation.isPending ?? !canSave}` →
  `disabled={saveMutation.isPending || !canSave}`. `isPending` is always a
  boolean, so `??` never falls through and `!canSave` is currently dead — the
  button is not disabled when the form can't be saved.
- **Acceptance:**
  - With no client selected / nothing dirty (`canSave === false`) and no save in
    flight, the Save button renders `disabled`.
  - While a save is in flight, it is still `disabled`.
  - Manual: selecting a client + making an edit enables it.
- **Effort:** trivial. **Risk:** none.

### Task 1.2 — Extract shared line-item logic (3.1) + name column indices (3.2)

- **Files:** new `src/app/editor/_lib/line-items.ts`; update
  `src/app/editor/_lib/use-inline-editing.ts` and
  `src/app/editor/_lib/clipboard.ts`.
- **Change:**
  - Create `line-items.ts` exporting `formatEditedCell`, `setLineItemSubtotal`
    (pick one name — `clipboard.ts` currently calls it `updateLineItemSubtotal`),
    and `export const LINE_ITEM_COLS = { quantity: 0, price: 3, subtotal: 4 } as const`.
  - Replace the duplicated copies in `use-inline-editing.ts` and `clipboard.ts`
    with imports from the new module.
  - Replace magic `0 / 3 / 4` column checks across the editor with
    `LINE_ITEM_COLS.*`.
- **Acceptance:**
  - No duplicate `formatEditedCell` / subtotal definitions remain
    (grep confirms a single source).
  - New unit test `src/app/editor/_lib/line-items.test.ts` covers: header row
    passthrough, quantity digit-stripping (col 0), price formatting to
    `$ x.xxx` COP (col 3), empty/invalid price → `""`, subtotal =
    quantity × price.
  - `pnpm test` green; editing a line-item quantity/price still recomputes the
    subtotal in the UI (manual check).
- **Effort:** small. **Risk:** low (pure functions; covered by new tests).

---

## Phase 2 — Security (additive, no restructuring)

Highest impact-per-effort after the quick wins. Both are mostly additive and do
not require touching the editor's component structure.

### Task 2.1 — Real Zod schema for persisted quotation `data` (4.1)

- **Files:** `src/server/api/routers/quotation.ts` (the `saveInput` at ~line 13);
  likely a new `src/app/editor/_components/types-schema.ts` (or colocated) holding
  the Zod schemas; keep `types.ts` as the inferred-type source.
- **Change:** replace `data: z.custom<PageData[]>(Array.isArray)` with a real
  schema for `PageData[]` / `TemplateElement` / `TableData` that validates element
  `type`, required numeric geometry, bounded string lengths, and the known shapes.
  Derive the TS types from the schema (`z.infer`) so `types.ts` and the validator
  cannot drift.
- **Acceptance:**
  - `save` rejects malformed `data` (missing `type`, non-array cells, absurd
    sizes) with a Zod error; accepts a real editor document.
  - New test in `src/server/api/routers/` (or a schema test) covering a valid
    document, a malformed element, and a malformed table.
  - A round-trip save → `byId` still returns the same document for a valid payload
    (no false rejections of real data — test with a fixture captured from the
    editor).
- **Effort:** medium. **Risk:** medium — **must not reject legitimate existing
  documents**. Capture a real saved `data` fixture first and assert it parses.

### Task 2.2 — Constrain image `src` (4.2)

- **Files:** the new schema from Task 2.1 (element `src` field);
  `src/app/editor/_lib/pdf-export.ts` (the `fetch(new URL(src, …))` path);
  optionally `canvas-page-renderer.tsx` (`new Image().src`).
- **Change:** restrict `src` to `data:` URLs (the upload path already produces
  these) or an explicit allowlist of trusted hosts. Validate in the schema so bad
  `src` values can never be persisted; defensively guard the `fetch`/`Image` paths
  too.
- **Acceptance:**
  - Schema rejects `http(s)://` (or non-allowlisted) `src`; accepts `data:image/*`.
  - `exportPagesToPdf` never fetches an arbitrary origin; a disallowed `src`
    degrades to the existing placeholder rather than making a network request.
  - Test covering allowed vs disallowed `src`.
- **Effort:** small–medium. **Risk:** low–medium (confirm the upload flow only
  emits `data:` URLs so nothing legitimate breaks).

---

## Phase 3 — Architecture + tests (interleaved, one extraction at a time)

The big, higher-risk work. The editor has **no tests**, and state is mirrored
across refs — so extract one cohesive unit, add its tests, then move on. Do not
batch these.

### Task 3.1 — `useEditorKeyboardShortcuts` + pure keydown decision helper (1.1, 5)

- **Files:** new `src/app/editor/_hooks/use-editor-keyboard-shortcuts.ts` and a
  pure helper (e.g. `_lib/keyboard.ts`); update `editor-client.tsx` to consume it.
- **Change:** move the window `keydown` effect (undo/redo, delete/backspace with
  INPUT/TEXTAREA guard, Cmd/Ctrl+D) out of `editor-client.tsx`. Factor the
  decision ("given this event + focus + selection, what action?") into a pure
  function.
- **Acceptance:**
  - Unit tests on the pure helper: modifier variants, focus in input/textarea
    (and contenteditable/select), empty selection, `preventDefault` expectations.
  - Manual: all shortcuts behave exactly as before.
- **Effort:** small–medium. **Risk:** low (behavior-preserving; now tested).
- **Start here** in Phase 3: it is the most isolated piece of `editor-client.tsx`.

### Task 3.2 — `useQuotationHistory` (1.1, 1.3)

- **Files:** new `src/app/editor/_hooks/use-quotation-history.ts`; update
  `editor-client.tsx`.
- **Change:** move `historyRef` / `historyIndexRef` / `commitHistory` / `undo` /
  `redo` / `canUndo` / `canRedo` into a hook. Keep the `pages`/`pagesRef` mirror
  behaviour for now (a `useReducer` migration is a later, separate step — note it
  but don't bundle it).
- **Acceptance:**
  - Unit tests: push → undo → redo sequences, boundary conditions (undo at index
    0, redo at end), `canUndo/canRedo` flags.
  - Manual: undo/redo + the dirty indicator behave as before.
- **Effort:** medium. **Risk:** medium (shared refs) — tests are the safety net.

### Task 3.3 — `useQuotationLoad` + `useQuotationPersistence` (1.1)

- **Files:** new hooks under `src/app/editor/_hooks/`; update `editor-client.tsx`.
- **Change:** extract the load query + `hydrateFromRow` + confirm-discard flow
  (`useQuotationLoad`), and the save mutation + dirty / revision refs +
  `beforeunload` (`useQuotationPersistence`).
- **Acceptance:**
  - Tests for the hydration mapping (company/customer capitalization, line-item
    subtotal recompute, logo backfill) as a pure transform where possible.
  - Manual: save, reload a saved quotation, and the dirty-overwrite confirm modal
    all behave as before.
- **Effort:** medium–large. **Risk:** medium.

### Task 3.4 — `EditorToolbar` component + `floating-toolbar` split (1.1, 1.6)

- **Files:** new `src/app/editor/_components/editor-toolbar.tsx`; split
  `floating-toolbar.tsx` into text-format / table / shared-actions pieces.
- **Change:** move the header toolbar JSX out of `editor-client.tsx`; separate the
  toolbar's table-mutation logic from its rendering.
- **Acceptance:** toolbar renders/behaves identically; `editor-client.tsx` is
  materially shorter; `pnpm lint` clean.
- **Effort:** medium. **Risk:** low–medium.

### Task 3.5 — Element `role` discriminator (1.2)

- **Files:** `src/app/editor/_components/types.ts` (+ the Zod schema from Task
  2.1); then `editor-client.tsx`, `use-inline-editing.ts`, `clipboard.ts`,
  `canvas-page-renderer.tsx`, and `src/server/api/routers/quotation.ts`.
- **Change:** add `role` to `TemplateElement` (or an `elementRole()` helper +
  constants) and replace the hand-matched `startsWith(...)` / exact-id string
  checks. Fix the server layering leak (`derivePageFields` reaching into editor
  string conventions) by deriving from `role`.
- **Acceptance:**
  - No `startsWith("line-items-"|"product-name-"|…)` or magic exact-id checks
    remain (grep confirms).
  - Existing saved documents still resolve roles correctly — provide a migration
    or a back-compat mapping from legacy id prefixes to `role` so old `data`
    loads.
  - Tests for the role mapping + a loaded-legacy-document fixture.
- **Effort:** large. **Risk:** high (touches persisted data + 5 files) — depends
  on Task 2.1's schema and should land after the hook extractions so the surface
  is smaller. **Do this last in Phase 3.**

---

## Phase 4 — Performance (ride on the cleaner, tested code)

Do after Phase 3: `React.memo` is blocked by unstable props, and stabilizing them
is easier post-decomposition.

### Task 4.1 — Stabilize per-element handlers & `dragBoundFunc` (2.2)

- **Files:** `canvas-page-renderer.tsx`, `quotation-canvas.tsx`.
- **Change:** stop building fresh `onMouseDown`/`onDragEnd`/`onDblClick` closures
  and `makeDragBoundFunc(page, element)` per element per render. Pass
  `page.id`/`element.id` and resolve in the handler, or memoize the factories.
- **Acceptance:** drag/select/edit behaviour unchanged; prop identities stable
  across renders (prerequisite for 4.2).
- **Effort:** medium. **Risk:** medium (event wiring).

### Task 4.2 — `React.memo` the Konva tree (2.1)

- **Files:** `table-node.tsx`, `canvas-page-renderer.tsx` (`CanvasPage`,
  `ImageElement`).
- **Change:** wrap in `React.memo`. Only effective once Task 4.1 lands.
- **Acceptance:** editing one element no longer re-renders every element (verify
  with React Profiler on a multi-page quotation); output visually identical.
- **Effort:** small. **Risk:** low (after 4.1).

### Task 4.3 — Precompute column prefix sums (2.3)

- **Files:** `table-node.tsx`, `use-inline-editing.ts`, `clipboard.ts`.
- **Change:** compute a cumulative column-offset array once per table instead of
  `colWidths.slice(0, col).reduce(...)` inside loops (currently O(n²)).
- **Acceptance:** identical offsets/rendering; a unit test for the offset helper.
- **Effort:** small. **Risk:** low.

### Task 4.4 — Parallelize PDF image loading (2.4)

- **Files:** `src/app/editor/_lib/pdf-export.ts`.
- **Change:** pre-resolve all image data URLs with `Promise.all`, then draw into
  jsPDF sequentially (drawing order preserved; only the async load is
  parallelized).
- **Acceptance:** exported PDF is byte-for-content identical for a fixture; export
  of a multi-image quotation is measurably faster; placeholder-on-failure
  behaviour preserved.
- **Effort:** small–medium. **Risk:** low–medium (watch ordering).

---

## Phase 5 — Lower-priority cleanup (opportunistic)

Pick up alongside nearby work rather than as a dedicated push.

- **Replace client-side `alert(...)`** in save `onError` and PDF export with the
  app's modal/toast pattern (3.3).
- **Logging (3.4):** server paths (tRPC `timingMiddleware`, any server error
  handlers) should use the existing structured logger `src/server/observability/logger.ts`
  (`log.*` + `errorFields`). Note it is `server-only`, so the editor's
  **client-side** `console.*` (PDF export, save `onError`) needs a client-safe
  logger or simply guarded/removed logs — do not import the server logger into
  client code.
- **`ImageElement` typing (3.5):** replace `Record<string, unknown>` +
  `as unknown as …` with a real props interface.
- **`useLoadedImage` render pattern (2.5):** revisit only if image flicker is
  observed.
- **Lint debt (3.7):** move ref reads out of render in `quotation-canvas.tsx`
  (the "Cannot access refs during render" errors); fix `prefer-regexp-exec` /
  `no-unsafe-return` in `clipboard.ts` and others.
- **App-wide splits (3.8):** `template-data.ts` factories vs assembly;
  `client-field.tsx` create-client dialog extraction; a shared
  Escape/outside-click hook for the modal components — only if its API stays
  simpler than the current effects.

---

## Dependency notes

- Task 2.1 (Zod schema) is a prerequisite for Task 3.5 (element `role`) — the
  discriminator should be defined in the same schema.
- Task 4.2 (`React.memo`) is blocked by Task 4.1 (stable props).
- Task 3.5 is the riskiest item (touches persisted `data`); keep it after the
  hook extractions so the diff surface is smaller, and ship a legacy-id →
  `role` back-compat path.
- A full `useReducer` migration (finding 1.3) is intentionally **not** a task
  here — it is a larger follow-up once the history/persistence hooks exist. Add
  it as its own plan when ready.
