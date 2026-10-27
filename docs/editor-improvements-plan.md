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

- Commit directly to `main` (team decision for this effort), one self-contained
  commit per task so it can be reviewed/reverted alone.
- After each task: `pnpm typecheck && pnpm lint && pnpm test` must pass; add/adjust
  tests where the task says so.
- Follow `AGENTS.md`: kebab-case component files, interfaces over type aliases,
  small components, custom hooks to consolidate related state.

---

## Status (updated 2026-10-27)

**Done** (committed to `main`):

- ✅ **Task 1.1** — Save-button disable bug fixed; `prefer-nullish-coalescing`
  configured to ignore booleans. (`7d5aed4`)
- ✅ **Task 1.2** — Shared `_lib/line-items.ts` (dedup + `LINE_ITEM_COLS`), with
  tests. (`965f34c`)
- ✅ **Task 2.1** — Lossless, template-agnostic Zod schema for persisted `data`
  (`quotation-schema.ts`) + drift guard + `quotationDocumentInput`; wired into
  `save`. (`0fe83fe`)
- ✅ **Task 2.2** — Image `src` allowlist (`isAllowedImageSrc`) enforced in the
  schema + both sinks (pdf-export, canvas). (`83c490f`)
- ✅ **Lint cleanup** (not a numbered task) — all 16 lint errors cleared; four
  React Compiler rules downgraded to `warn`. (`3158769`)
- ✅ **Task 3.0** — Custom hooks consolidated into `_hooks/`. (`f3ffce5`)
- ✅ **Task 3.1** — Keyboard shortcuts extracted to a hook + pure `decideShortcut`
  helper (15 tests). (`2b0579d`)

**Deferred:**

- ⏸️ **Task 2.3** — Required-elements enforcement: deferred to the quotation-module
  iteration (module is feature-flagged off; see the task for details). Plan text
  retained below.

**Not started** (full detail retained in the sections below): Task 3.2,
3.3, 3.4, 3.5, 3.6; Task 4.0, 4.1, 4.2, 4.3, 4.4; Phase 5.

**Next up:** Task 3.2 — `useQuotationHistory`.

> Completed tasks (Phase 1, and 2.1 / 2.2) are collapsed to one-line references
> below; this Status block is the source of truth. Full detail remains for the
> deferred 2.3 and all not-started tasks.

---

## Phase 1 — Quick wins & correctness — ✅ COMPLETE

Task 1.1 (Save-button disable bug, `7d5aed4`) and Task 1.2 (shared
`_lib/line-items.ts` + `LINE_ITEM_COLS`, `965f34c`) are done. See the Status
section above for details.

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

### Task 2.1 — Lossless Zod schema for persisted `data` (4.1) — ✅ DONE (`0fe83fe`)

`quotation-schema.ts` (template-agnostic, `.passthrough()` lossless, drift guard,
`quotationDocumentInput`) wired into `save`. See the Status section above.

### Task 2.2 — Constrain image `src` (4.2) — ✅ DONE (`83c490f`)

`isAllowedImageSrc` allowlist enforced in the schema + both sinks (pdf-export,
canvas). See the Status section above.

### Task 2.3 — Required-elements enforcement (DEFERRED to the quotation module)

Some elements must always be present regardless of template: the non-editable
header fields and the final policies page. This is a **template/application
invariant**, deliberately kept *out* of the universal `save` schema (Task 2.1) so
the lossless round-trip and open-editor goals are not compromised — a schema that
rejected documents missing a header would make variant/edge-case snapshots
unloadable and unsavable.

> **Status: deferred — do NOT build yet.** The quotation module
> (`src/app/_my-quotations/`) that owns the enforced load/edit/save flows is
> currently **feature-flagged off** (`ENABLE_QUOTATIONS_PAGE = false`, redirects
> to `/`) and its enforced-template save/load path does not exist. Both the
> validator primitive **and** its wiring are deferred to that iteration, so the
> enforcement can be built and verified against a real flow instead of a
> speculative one. Nothing lands on the universal save path.

- **When:** with the quotation-module iteration (load / edit / delete saved
  quotations). Not before.
- **Required element IDs (from the current master template** —
  `src/app/editor/_lib/template-data.ts`**):** `customer-name`, `company-name`,
  `quotation-number`, `representative-info`, `footer`, and the final-page
  `policies-body`. Record these as named constants when built; re-verify against
  the template at build time (templates may evolve).
- **Two parts, both deferred:**
  1. **Pure validator primitive:** `findMissingRequiredElements(doc)` /
     `requiredElementsPresent(doc)` + `REQUIRED_ELEMENT_IDS` constants, in
     `_components` or `_lib`. Pure, unit-tested (present → ok; missing a header
     field → reported; missing policies → reported; free-form → reports missing
     without throwing).
  2. **Wiring:** call the primitive only in the enforced-template creation and
     the quotation module's save path, surfacing a clear user-facing error (not a
     500).
- **Acceptance (when built):**
  - A document missing the header fields or policies page fails the enforced-flow
    check with an actionable message.
  - A free-form document still **saves fine** through the universal path (the
    invariant applies only to enforced-template flows).
  - Tests for present / missing header / missing policies.
- **Effort:** medium. **Risk:** medium — must not leak into the universal save
  path and break free-form/round-trip saves.
- **Depends on:** Task 2.1 (shares the element model) and the quotation-module
  work being un-flagged.

---

## Phase 3 — Architecture + tests (interleaved, one extraction at a time)

The big, higher-risk work. The editor has **no tests**, and state is mirrored
across refs — so extract one cohesive unit, add its tests, then move on. Do not
batch these.

### Task 3.0 — Consolidate hooks into `_hooks/` (prerequisite) — ✅ DONE (`f3ffce5`)

Moved `use-table-selection`, `use-canvas-stage`, `use-inline-editing` from `_lib/`
to `_hooks/` (joining `use-representative-profile`); pure helpers stay in `_lib/`.
Mechanical `git mv` + import-path fixes; typecheck/lint/test unchanged.

### Task 3.1 — `useEditorKeyboardShortcuts` + pure keydown helper (1.1, 5) — ✅ DONE (`2b0579d`)

Extracted the global `keydown` effect into `_hooks/use-editor-keyboard-shortcuts`
and the pure `decideShortcut()` into `_lib/keyboard.ts` (15 unit tests). Behaviour
preserved exactly, incl. the Cmd/Ctrl+D quirk (unconditional preventDefault).

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
