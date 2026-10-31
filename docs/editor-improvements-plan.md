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

- create a branch per task
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
- ✅ **Task 3.2** — `pages`/undo-redo history extracted to `useQuotationHistory` +
  pure `_lib/history` reducer (9 tests). (`76e289b`)
- ✅ **Task 3.3** — Persistence extracted to `useQuotationPersistence` (`d079212`)
  and load orchestration to `useQuotationLoad` (`4f0de7e`). Load path is
  flag-gated off, so that half is extraction-only (not reachable yet).
- ✅ **Task 3.4** — `EditorToolbar` header extracted; floating-toolbar logic moved
  to pure `_lib/table-ops` (12 tests) + rendering split into text-format/table
  subcomponents. (`b020887`, `85098ad`, +2b)
- ✅ **Task 3.5** — Element `role` discriminator: `role` on `TemplateElement` +
  pure `_lib/element-role` (`elementRole`/`isLineItems`/`isLineItemsId`) with a
  legacy-id back-compat mapping (20 tests, incl. a legacy-document fixture);
  schema `role` enum; all id `startsWith`/exact-id checks replaced across the
  editor + server router (fixes the `derivePageFields`/`setQuotationNumber`
  layering leak). (`08acdcf`)
- ✅ **Task 3.6** — `use-inline-editing` slimmed: overlay geometry → pure
  `_lib/editing-geometry` (`computeContentTop`/`computeEditingBox`, 5 tests) and
  Tab navigation → pure `_lib/table-navigation` (`nextEditableCell`, 6 tests);
  hook delegates, return surface unchanged. (`0006656`)

**Deferred:**

- ⏸️ **Task 2.3** — Required-elements enforcement: deferred to the quotation-module
  iteration (module is feature-flagged off; see the task for details). Plan text
  retained below.

**Not started** (full detail retained in the sections below):
Task 3.7; Task 4.0a, 4.0, 4.1, 4.2, 4.3, 4.4; Phase 5.

**Next up:** Task 3.7 — raise editor test coverage (gate before Phase 4). Lock a
safety net over core editor functionality before the memoization work changes
render behaviour. React Testing Library is the agreed tool for hook/component
tests.

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
> load saved quotations _back into the editor_ for editing, so stored `data` is
> a faithful **snapshot**: every element, position, size, style, and config must
> survive save→load exactly — whether the user used the default template, a fully
> custom one, or added/removed elements. The editor must also stay **open**
> (multiple/free-form templates). Therefore the storage schema validates
> _structure, types, and bounds_ but is **template-agnostic** and **lossless**
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
invariant**, deliberately kept _out_ of the universal `save` schema (Task 2.1) so
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

### Task 3.2 — `useQuotationHistory` (1.1, 1.3) — ✅ DONE (`76e289b`)

Extracted `pages` state + undo/redo stack into `_hooks/use-quotation-history.ts`,
delegating the stack math to a pure `_lib/history.ts` reducer (9 unit tests).
Dirty/save-race bookkeeping stays in the client via an `onEdit` seam; the four
inline baseline resets now call the hook's `resetHistory`. Behaviour preserved.

> **Candidate follow-up (not committed):** `useQuotationHistory` currently holds
> the stack in a `historyRef` + `useState` flags. Because the stack math already
> lives in the pure, unit-tested `_lib/history.ts`, converting the hook internals
> to `useReducer(historyReducer, …)` would be a clean, isolated improvement with
> **no new dependency** and no behaviour change (tests already cover the reducer).
> Low priority; do it only if it simplifies a later task. This is the narrowest
> "reducer/store" step — see Task 4.0a for the broader client-store decision.

### Task 3.3 — `useQuotationLoad` + `useQuotationPersistence` (1.1) — ✅ DONE (`d079212`, `4f0de7e`)

Split in two commits: `useQuotationPersistence` (saved identity + `quotation.save`
mutation + `canSave` + `handleSave`; live, verifiable) and `useQuotationLoad`
(`byId` query + auto-apply-when-clean + dirty-overwrite confirm; the page
transforms stay in the client as an injected `hydrateFromRow`). The load path's
entry point (My Quotations) is feature-flagged off, so that half is a
behaviour-preserving extraction not reachable end-to-end yet. The `beforeunload`
dirty-guard stayed in `editor-client.tsx` (separate concern). Pure hydration-
transform tests were NOT added (transform left inline); revisit if that logic is
later extracted. typecheck/lint/test unchanged.

### Task 3.4 — `EditorToolbar` component + `floating-toolbar` split (1.1, 1.6) — ✅ DONE (`b020887`, `85098ad`, +2b)

Three parts: (1) extracted the header into `_components/editor-toolbar.tsx`
(`b020887`); (2a) moved the table-mutation logic into pure `_lib/table-ops.ts`
with 12 unit tests (`85098ad`); (2b) split the floating-toolbar rendering into
`text-format-controls.tsx` + `table-controls.tsx`, leaving `FloatingToolbar` as a
thin orchestrator. Behaviour preserved throughout.

### Task 3.5 — Element `role` discriminator (1.2) — ✅ DONE (`08acdcf`)

`role` on `TemplateElement` + pure `_lib/element-role` (`elementRole`,
`isLineItems`, `isLineItemsId`) with a legacy-id back-compat mapping and a
schema `role` enum; all id `startsWith`/exact-id checks replaced across the
editor and the server router. See the Status block above.

### Task 3.6 — Slim down the `use-inline-editing` hook — ✅ DONE (`0006656`)

Overlay geometry extracted to pure `_lib/editing-geometry`
(`computeContentTop`/`computeEditingBox`) and Tab navigation to pure
`_lib/table-navigation` (`nextEditableCell`); the hook delegates, return surface
unchanged. See the Status block above.

### Task 3.7 — Raise editor test coverage (gate before Phase 4)

Lock in a safety net over the editor's **core functionality** before the Phase 4
performance work changes render behaviour (4.1/4.2 restructure props and add
`React.memo`, which can silently break interactions). Coverage so far has
accrued opportunistically as each extraction shipped its own pure-logic tests;
this task closes the remaining gaps deliberately, prioritizing the editor.

**Current state (2026-10-30):** tests are **pure Vitest, `environment: "node"`,
no DOM**, and `include` is `*.test.ts` only (no `.test.tsx`). So hooks and Konva
components are entirely untested at their own level; coverage lives in `_lib/`
pure helpers + the schema. This task is therefore **tiered** — cheap pure tests
first, then opt into DOM infra only where it pays off.

- **Tier 1 — remaining pure `_lib/` helpers (no new infra, do first):**
  - `clipboard.ts` (paste parsing / cell fill, line-items branch),
    `quotation-canvas-geometry.ts` (`getPageOffset`), `template-data.ts`
    (page building, interpolation, role tagging, `buildPagesFromQuotation`),
    and `pdf-export.ts` pure helpers (`wrapText`, `parseColor`, `drawTable`
    cell iteration — see the Phase 5 note; coordinate with Task 4.4).
  - Acceptance: each gets focused unit tests; expected values from worked
    examples (no tautological asserts).

- **Tier 2 — hooks (jsdom + React Testing Library — approved):**
  - Add the infra: `environment: "jsdom"` (or per-file `@vitest-environment`),
    extend `include` to `*.test.tsx`, add `@testing-library/react` (use its
    `renderHook`). React Testing Library is the agreed tool for hook/component
    tests. One-time setup.
  - Cover the hooks carrying real logic: `use-quotation-history` (undo/redo +
    `onEdit`/dirty seam), `use-quotation-persistence` (save gating, save-race
    `editRevisionRef`, success re-sync), `use-inline-editing` (open/commit/Tab
    via the now-pure helpers), `use-representative-profile`.
  - Acceptance: behaviour pinned via the hook's public return, not internals.

- **Tier 3 — components / interactions (React Testing Library; highest value):**
  - `quotation-canvas.tsx`, `canvas-page-renderer.tsx`, `table-node.tsx`,
    `floating-toolbar.tsx`, `editor-client.tsx`. Use React Testing Library to
    drive real user interactions (render, query by role/text, fire events).
    Konva does **not** render in jsdom cleanly — so for canvas components, mock
    `react-konva` (render children / stub the Konva nodes) and assert on the
    props/handlers wired to them, rather than pixels. Non-canvas UI
    (`floating-toolbar`, modals, toolbar) tests normally through RTL.
  - Acceptance: cover the core flows — select/drag intent, inline edit commit,
    add/append products, save enablement — via RTL at the cheapest stable seam;
    do **not** chase pixel/canvas rendering in unit tests (defer true visual
    checks to the manual plan / a future Playwright e2e layer).

- **CI / threshold (decision):** optionally turn on `vitest --coverage` (v8)
  and set a **ratcheting** threshold scoped to `src/app/editor/**` (start at the
  current number, raise as tiers land) so coverage can't regress. Add a
  `test:coverage` script and wire it into the CI `test` job if adopted. Decide
  adopt/defer explicitly and record it.

- **Scope guard:** "core functionality, mainly the editor" — prioritize the
  editor over app-wide coverage; Tiers 1–2 are the must-haves, Tier 3 is
  best-effort at stable seams. Pure logic over DOM wherever a seam allows it.
- **Effort:** large (spread across tiers). **Risk:** low (additive; tests only).
- **Do before Phase 4.** Tier 1 has no dependencies; Tier 2/3 benefit from the
  completed Phase 3 hook/helper extractions (smaller, well-defined seams).

---

## Phase 4 — Performance (ride on the cleaner, tested code)

Do after Phase 3: `React.memo` is blocked by unstable props, and stabilizing them
is easier post-decomposition. We need metrics for before/after to measure implementation
impact.

### Task 4.0a — Decision point: do we need a client store? (architecture)

Before the memoization work, make an explicit, evidence-based call on whether the
editor's shared client state warrants a store (Zustand / `useSyncExternalStore` /
Context+reducer) instead of the current container-owned state + prop passing.

- **Context:** after Phase 3 the real domain state (`pages` + undo/redo) lives in
  `useQuotationHistory`; server state is TanStack Query; the tree is shallow
  (`editor-client` → `QuotationCanvas` is one hop, ~10 props — a container/child
  boundary, not deep drilling). So today a store would mostly _relocate_ state,
  not cut coupling, while adding a second state paradigm and a re-render footgun
  that matters for the Konva canvas.
- **Decide with real data from 4.0/4.1/4.2:** adopt a store **only if** the
  memoization work shows that _multiple sibling components_ (canvas, floating
  toolbar, future `EditorToolbar`, inline editors) independently need to
  read/write shared `selectedId`/`pages`/selection, and props can't be stabilized
  cleanly. A store's main win here is selector-based subscriptions that avoid
  whole-tree re-renders — a performance concern, hence its placement in Phase 4.
- **If adopted:** prefer the narrowest fit. `useSyncExternalStore` or a tiny
  Context+reducer may suffice before reaching for Zustand; weigh the extra
  dependency against the selector ergonomics.
- **Anti-goal:** do **not** adopt a store mid-decomposition — it tends to freeze
  the current state shape into the store API and make later refactors harder.
- **Outcome:** record the decision (adopt / defer / reject) with the metric that
  drove it, then proceed.

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

### Review-later notes (added 2026-10-29)

Captured from a bug-fix / small-feature session. None block anything today; each
needs a second look in the stage noted.

- **Draft protection is an in-session band-aid — revisit with the quotation
  module.** `editor-client.tsx` derives `isDraft` ("unsaved content worth
  protecting") and guards `beforeunload` + in-app nav (`a5aecac`). But draft-ness
  is inferred from **consume-on-read `sessionStorage` handoffs**
  (`takePendingManualQuotation` clears on read; product selection is read at
  mount) captured once at mount, so it is fragile across **tab
  duplicate/clone/refresh** (storage is copied at clone time; the manual flag may
  already be consumed). The durable fix is real **draft persistence** (the
  feature-flagged `_my-quotations` module): persist/restore drafts and derive
  `isDraft` from the loaded content, not one-shot mount flags. Re-evaluate the
  whole `isDraft` derivation then. `isDraft` was named with that future in mind.
- **Nav draft-guard scope is intentionally narrow.** `nav-bar.tsx` only
  intercepts the two nav links (Nueva cotización / Editor) via `EditorDraftProvider`
  (`editor-draft-context.tsx`). **Sign-out** and the catalog floating
  "Cargar en el editor" bar (`quotation-bar.tsx`, a plain `<a href>`) are **not**
  guarded. Sign-out from a dirty editor still discards silently; decide whether
  to guard it when touching auth/nav. The context is deliberately a tiny
  state-backed provider (an earlier ref-based version silently de-synced across
  an editor remount — do not reintroduce a ref here).
- **`pdf-export.ts` still has no direct unit tests.** The ragged-table export
  crash (`2e1f841`) was fixed and covered **indirectly** via `table-ops` /
  `line-items` tests, plus defensive coercion in `drawTable`/`wrapText`. The
  exporter's own pure helpers (`wrapText`, `parseColor`, `drawTable` cell
  iteration) remain untested — add a focused test when Task 4.4 (parallelize PDF
  image loading) touches this file.

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
- **Audit `useEffect` usage app-wide (keep or replace).** Start with the
  post-mount effect added in `editor-client.tsx` that reads
  `takePendingQuotationClient()` from `sessionStorage` into `selectedClientId`
  (added to fix a Save-button **hydration mismatch**: the old
  `useState(() => takePendingQuotationClient())` initializer returned `null` on
  the server but the stored value on the client, so the button's `disabled`/label
  diverged during hydration). The effect is correct but trips
  `react-hooks/set-state-in-effect` (a warn under this project's policy). Decide
  whether to keep it or replace it with a better idiom — `useSyncExternalStore`
  with a `null` server snapshot, a `mounted` gate, or moving the handoff off
  `sessionStorage` to a cookie/search param the **server** can read (removes the
  effect entirely but changes the handoff mechanism). Note `selectedClientId` is
  also set elsewhere, so a read-only `useSyncExternalStore` doesn't drop in
  cleanly. Then **sweep every other `useEffect` in the app** (grep) and, for each,
  decide keep vs. replace: is it a genuine effect (subscription, external sync,
  imperative DOM), or is it compensating for something that belongs in render, an
  event handler, derived state, or `useSyncExternalStore`? Record the
  keep/replace decision per effect. Watch for the same SSR/browser-storage
  hydration trap in the other storage-reading initializers in `editor-client.tsx`
  (`isManualStart`, `hasInitialProducts`, `pendingHomeContactIdRef`, and the
  initial pages/meta via `getQuotationProducts`) — they carry the same latent
  risk but aren't flagged today because they don't drive a rendered attribute.
- **Review the i18n implementation — is it needed?** The editor/toolbar use a
  `t(...)` helper from `@/i18n/messages` with a single `defaultLocale`. Assess
  whether full internationalization is actually a requirement: if the app is
  effectively single-locale (currently `es-CO`-flavoured), the `t()` indirection
  may be adding ceremony without payoff. Decide to (a) keep and properly
  multi-locale it, or (b) simplify to plain strings/constants. Scope the
  blast radius first (grep usages) before changing anything.

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
