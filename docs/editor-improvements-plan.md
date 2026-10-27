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

> **Design constraint — lossless round-trip.** A coming quotation module will
> load saved quotations *back into the editor* for editing, so stored `data` is
> a faithful **snapshot**: every element, position, size, style, and config must
> survive save→load exactly — whether the user used the default template, a fully
> custom one, or added/removed elements. The editor must also stay **open**
> (multiple/free-form templates). Therefore the storage schema validates
> *structure, types, and bounds* but is **template-agnostic** and **lossless**
> (preserves unknown keys) — it must not require any specific element IDs and
> must not strip fields it did not model. The "some elements are always present"
> rule (header + policies page) is enforced **separately** (see Task 2.3), not in
> this universal schema.

### Task 2.1 — Real (lossless) Zod schema for persisted quotation `data` (4.1)

- **Files:** `src/server/api/routers/quotation.ts` (the `saveInput` ~line 13);
  new `src/app/editor/_components/quotation-schema.ts` holding the Zod schemas;
  re-export inferred types so `types.ts` and the validator cannot drift.
- **Change:** replace `data: z.custom<PageData[]>(Array.isArray)` with real
  schemas for `PageData` / `TemplateElement` / `TableData` that validate element
  `type` (enum), numeric geometry, and **generous** string/array bounds (bounds
  exist to stop absurd abuse, not to constrain real content). Each object schema
  uses **`.passthrough()`** so unknown/future keys are preserved (lossless) —
  never `.strip()`. No required "magic" IDs anywhere. Leave `src` loosely typed
  here; Task 2.2 tightens it.
- **Acceptance:**
  - `save` rejects non-structural garbage (non-array `data`, element missing
    `type`, non-array `cells`, absurd sizes) with a Zod error.
  - **Lossless proof:** an element carrying an extra unmodeled key round-trips
    through `parse()` with that key intact.
  - Fixtures parse: (1) the current default-template document, (2) a free-form
    document with none of the standard IDs, (3) the lossless-extra-key case.
  - No required-element checks in this schema (that is Task 2.3).
- **Effort:** medium. **Risk:** medium — **must not reject or mutate legitimate
  documents**. Capture a real default-template `data` fixture first and assert it
  parses unchanged.

### Task 2.2 — Constrain image `src` (4.2)

- **Files:** the schema from Task 2.1 (element `src` field);
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

### Task 2.3 — Required-elements enforcement (separate from storage schema)

Some elements must always be present regardless of template: the non-editable
header fields and the final policies page. This is a **template/application
invariant**, deliberately kept *out* of the universal `save` schema (Task 2.1) so
the lossless round-trip and open-editor goals are not compromised — a schema that
rejected documents missing a header would make variant/edge-case snapshots
unloadable and unsavable.

- **When:** alongside the upcoming **quotation module** iteration (load / edit /
  delete saved quotations), not necessarily before Task 2.2.
- **Files:** a new validator (e.g. `_components/required-elements.ts` or a
  template-scoped rule) + wherever enforced-template save/load flows live.
- **Change:** a `requiredElementsPresent(doc)` (or template-scoped) check run in
  the flows that demand it — enforced-template creation and the quotation module's
  save path — surfacing a clear user-facing error, not a 500.
- **Acceptance:**
  - A document missing the header fields or policies page fails the enforced-flow
    check with an actionable message.
  - A free-form document still **saves fine** through the universal path (the
    invariant applies only to enforced-template flows).
  - Tests for present / missing header / missing policies.
- **Effort:** medium. **Risk:** medium — must not leak into the universal save
  path and break free-form/round-trip saves.
- **Depends on:** Task 2.1 (shares the element model) and the quotation-module
  work.

---

## Phase 3 — Architecture + tests (interleaved, one extraction at a time)

The big, higher-risk work. The editor has **no tests**, and state is mirrored
across refs — so extract one cohesive unit, add its tests, then move on. Do not
batch these.

### Task 3.0 — Consolidate hooks into `_hooks/` (prerequisite)

The editor's custom hooks are split across two folders: `use-table-selection.ts`,
`use-canvas-stage.ts`, and `use-inline-editing.ts` live in `_lib/`, while
`use-representative-profile.ts` already lives in `_hooks/`. The rest of Phase 3
adds new hooks and assumes `_hooks/` is their home, so settle the convention
first.

- **Files:** move `src/app/editor/_lib/use-table-selection.ts`,
  `use-canvas-stage.ts`, and `use-inline-editing.ts` (and their colocated tests,
  if any) into `src/app/editor/_hooks/`. Keep pure, non-hook helpers
  (`clipboard.ts`, `line-items.ts`, `quotation-canvas-geometry.ts`,
  `pdf-export.ts`, …) in `_lib/`.
- **Change:** `git mv` the files, then fix import paths in the movers and their
  consumers (`quotation-canvas.tsx`, `editor-client.tsx`, etc.). Pure mechanical
  move — no logic changes.
- **Acceptance:** `_lib/` holds only non-hook modules; all `use-*` hooks live in
  `_hooks/`; `pnpm typecheck && pnpm lint && pnpm test` unchanged.
- **Effort:** small. **Risk:** low (mechanical; the type/lint pass catches any
  missed import).
- **Do this first in Phase 3** so later tasks (3.1–3.5) land hooks in one place.

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
  is smaller.

### Task 3.6 — Slim down the `use-inline-editing` hook

`useInlineEditing` is a legitimate hook (it owns editing state via
`useState`/`useEffect`), but it currently also absorbs two concerns that are not
stateful and would be better as pure, testable helpers:

1. **Overlay geometry is duplicated 3×.** The `editingBox` math
   (`stageBox.left + offset.x + element.x + colWidths.slice(0, col).reduce(...)`,
   `top: contentTopRef.current - scrollTop`) is repeated in `openTextEditor`,
   `openCellEditor`, and the Tab branch of `handleEditorKeyDown`.
2. **Table navigation is pure logic in a `useCallback`.** The "find next editable
   cell, skip the subtotal column, commit current cell, move selection" block in
   `handleEditorKeyDown` is ~60 lines that use no hook features beyond closing
   over refs.

- **Files:** `src/app/editor/_hooks/use-inline-editing.ts` (post Task 3.0 move);
  new pure helpers in `_lib/` (e.g. `editing-geometry.ts` with
  `computeEditingBox(...)`, and `nextEditableCell(table, cell, isLineItems)` —
  colocate with `line-items.ts` if it keeps them small).
- **Change:** extract the box math and the next-cell search into pure functions;
  the hook keeps the `useState`/`useEffect`/`useCallback` state wiring and
  delegates. Overlaps with Task 3.1's "extract pure decisions, then test them"
  approach and benefits from the element-`role` work (Task 3.5) replacing the
  `startsWith("line-items-")` checks inside it.
- **Acceptance:** overlay positioning and Tab navigation behave identically; unit
  tests cover `computeEditingBox` and `nextEditableCell` (including the
  subtotal-column skip and header-row wrap); hook surface (return shape) is
  unchanged for `quotation-canvas.tsx`.
- **Effort:** medium. **Risk:** low–medium (behavior-preserving; now tested).

---

## Phase 4 — Performance (ride on the cleaner, tested code)

Do after Phase 3: `React.memo` is blocked by unstable props, and stabilizing them
is easier post-decomposition.

### Task 4.0 — Fix refs-during-render & re-upgrade the lint rule (3.7)

`quotation-canvas.tsx` reads ref-bundled values during render (the
`react-hooks/refs` React Compiler rule fires ~9×). As a stopgap the rule is
currently downgraded to **`warn`** in `eslint.config.js` (alongside the other
React Compiler rules) so it does not block CI — this is explicitly **temporary**.

- **Files:** `src/app/editor/_components/quotation-canvas.tsx`,
  `src/app/editor/_hooks/use-canvas-stage.ts` (post Task 3.0 move),
  `eslint.config.js`.
- **Change:** stop accessing ref values during render. The `useCanvasStage`
  return bundles refs (`stageRef`, `containerRef`, `pastePositionRef`) with state
  (`selectedId`, `stageSize`); the lint can't prove render-time `stage.*` reads
  aren't ref reads. Separate refs from render-safe state (or read refs only in
  handlers/effects) so the rule is satisfied at the root. Then **re-upgrade
  `react-hooks/refs` from `warn` back to `error`** in `eslint.config.js` and
  remove the TEMPORARY comment.
- **Acceptance:** `pnpm lint` passes with `react-hooks/refs` set to `error` again;
  canvas selection / paste-position / scroll behaviour unchanged.
- **Effort:** medium. **Risk:** medium (touches a 585-line untested component —
  pairs well with the Phase 3 decomposition + any tests added there).
- **Do before Task 4.1** (same file + ref area); the warn→error flip is the
  completion signal.

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
