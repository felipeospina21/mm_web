# Editor improvements — implementation plan

> Execution plan derived from [`improvements.md`](./improvements.md). That doc is
> the catalog of findings (organized by theme); **this** doc is the ordered,
> actionable task list.
>
> **Organization:** tasks are split into **Pending** and **Done**. Each task is a
> `### Task N.M` whose number carries its original **phase** (1 quick wins, 2
> security, 3 architecture+tests, 4 performance, 5 cleanup, 6 e2e, 7 coverage).
> Within each section tasks are listed by phase/number.

## Conventions for every task

- Create a branch per task; one commit per task so it can be reviewed/reverted
  alone.
- After each task: `pnpm typecheck && pnpm lint && pnpm test` must pass; add/adjust
  tests where the task says so.
- Follow `AGENTS.md`: kebab-case component files, interfaces over type aliases,
  small components, custom hooks to consolidate related state.

## Status (updated 2026-11-03)

**Next up:** Phase 5 remaining cleanup — all decision-heavy: logging (5.2),
app-wide splits (5.6). Task 5.7 (useEffect audit) is complete. Phases 1–4 are
complete; Phase 6 (e2e) and Phase 7 (coverage) are not started.

**Session log — 2026-11-03** (branch-per-task; all merged to `main`):

- **Phase 4 completed:** Task 4.1 stable `dragBoundFunc` + pure `_lib/drag-bounds`
  (PR #10); Task 4.2 `React.memo` the Konva tree (PR #11); Task 4.3 precompute
  column prefix sums (PR #12); Task 4.4 parallelize PDF image loading (PR #13).
  (Task 4.0 / 4.0a landed just before: refs under a `refs` key; client store
  deferred.)
- **Phase 5 started:** `ImageElement` real props interface (PR #14); app-wide
  **toast system** replacing `alert()` + **offline-save fix**
  (`networkMode:"always"` + `navigator.onLine` guard) + top-right placement +
  subtle enter/exit animation (PR #15).
- Test baseline grew 233 → **255** tests across 30 files; lint 0 errors / 1
  warning (`set-state-in-effect`, Task 5.7). Bug lesson: React Query's default
  `networkMode:"online"` pauses mutations offline (stuck spinner, no `onError`)
  — use `"always"` for user-triggered saves.

---

# Pending

## Phase 2 — Security

### Task 2.3 — Required-elements enforcement (Phase 2) — ⏸️ DEFERRED to the quotation module

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

## Phase 4 — Performance

### Task 4.0a — Do we need a client store? (Phase 4, architecture) — ⏸️ DECIDED: DEFER (2026-11-03)

Decision is made (defer); the **store work itself is postponed**, so it lives in
Pending — revisit only if 4.1/4.2 metrics prove it.

> **Decision: defer — do NOT adopt a client store now.** Domain state is already
> well-placed after Phase 3 (`pages`+undo/redo in `useQuotationHistory`, server
> state in TanStack Query, `selectedId`+geometry in `useCanvasStage`, table
> selection in `useTableSelection`); the tree is shallow (`editor-client` →
> `QuotationCanvas` one hop, ~10 props; → `CanvasPageRenderer` next). A store today
> would relocate well-placed state and add a second paradigm + a Konva re-render
> footgun. The real issue is **prop stability / re-renders**, addressed directly by
> Tasks 4.0/4.1/4.2 — not state location. Revisit only if 4.1/4.2 metrics prove
> multiple siblings need shared read/write AND props can't be stabilized. The
> narrowest no-dependency option (Task 3.2's `useReducer` note) remains available.

## Phase 5 — Lower-priority cleanup (opportunistic)

Pick up alongside nearby work rather than as a dedicated push. `(was ref N.M)`
tags trace an item back to where it was first catalogued; **5.x is the id**.

### Task 5.2 — Logging (Phase 5, was ref 3.4)

Server paths (tRPC `timingMiddleware`, any server error handlers) should use the
existing structured logger `src/server/observability/logger.ts` (`log.*` +
`errorFields`). Note it is `server-only`, so the editor's **client-side**
`console.*` (PDF export, save `onError`) needs a client-safe logger or simply
guarded/removed logs — do not import the server logger into client code.

### Task 5.4 — `useLoadedImage` render pattern (Phase 5, was ref 2.5)

Revisit only if image flicker is observed.

### Task 5.6 — App-wide splits (Phase 5, was ref 3.8)

`template-data.ts` factories vs assembly; `client-field.tsx` create-client dialog
extraction; a shared Escape/outside-click hook for the modal components — only if
its API stays simpler than the current effects.

### Task 5.7 — Audit `useEffect` usage app-wide (Phase 5)

Keep or replace, per effect. Start with the post-mount effect added in
`editor-client.tsx` that reads `takePendingQuotationClient()` from
`sessionStorage` into `selectedClientId` (added to fix a Save-button **hydration
mismatch**: the old `useState(() => takePendingQuotationClient())` initializer
returned `null` on the server but the stored value on the client, so the button's
`disabled`/label diverged during hydration). The effect is correct but trips
`react-hooks/set-state-in-effect` (a warn under this project's policy). Decide
whether to keep it or replace it with a better idiom — `useSyncExternalStore`
with a `null` server snapshot, a `mounted` gate, or moving the handoff off
`sessionStorage` to a cookie/search param the **server** can read (removes the
effect entirely but changes the handoff mechanism). Note `selectedClientId` is
also set elsewhere, so a read-only `useSyncExternalStore` doesn't drop in cleanly.
Then **sweep every other `useEffect` in the app** (grep) and, for each, decide
keep vs. replace: is it a genuine effect (subscription, external sync, imperative
DOM), or is it compensating for something that belongs in render, an event
handler, derived state, or `useSyncExternalStore`? Record the keep/replace
decision per effect. Watch for the same SSR/browser-storage hydration trap in the
other storage-reading initializers in `editor-client.tsx` (`isManualStart`,
`hasInitialProducts`, `pendingHomeContactIdRef`, and the initial pages/meta via
`getQuotationProducts`) — they carry the same latent risk but aren't flagged today
because they don't drive a rendered attribute.

**Audit result (2026-11-04) and split into sub-tasks.** Every `useEffect` was
classified; one change per sub-task, each on its own branch, verified
independently.

_Genuine effects — KEEP, no change:_ `quotation-list.tsx:40` and
`product-catalog.tsx:42` (IntersectionObserver); `quotation-bar.tsx:13` and
`product-card.tsx:46` (`STORAGE_EVENT` subscription); `confirm-modal.tsx:37`,
`add-product-modal.tsx:88`, `actions-menu.tsx:38` (document key/click listeners);
`toast-context.tsx:110` (unmount timer cleanup) and `:169` (rAF enter
transition); `quotation-canvas.tsx:104` (scroll/visible-pages),
`use-canvas-stage.ts:44` (ResizeObserver), `use-inline-editing.ts:86` (scroll
listener); `canvas-page-renderer.tsx:294` (imperative `Image` load, see 5.4);
`use-editor-keyboard-shortcuts.ts:29` (global keydown); `editor-client.tsx:191`
(`beforeunload`).

_Sub-tasks:_

- **5.7a — `selectedClientId` hydration effect** — ✅ DONE. Replaced the
  post-mount effect with `usePendingQuotationClient` (`useSyncExternalStore`, null
  server snapshot) plus a user/load override in `editor-client.tsx`. Lint warning
  gone (0 warnings).
- **5.7b — Derived state / event-handler candidates** — ✅ DONE.
  `visiblePageNumbers` + active page now derived in render (`_lib/visible-pages`
  `withActivePage` + `useMemo`; the active page now always stays mounted);
  `use-canvas-stage` wraps `setSelectedId` to notify `onSelectionChange`
  directly (effect removed). `pagesRef.current = pages` mirror **kept** as an
  effect (render-time assignment violates `react-hooks/refs`); commented in code.
- **5.7c — Apply-on-data-arrival effects (ref-guarded)** — ✅ DONE (live ones);
  `use-quotation-load.ts:67` DEFERRED. Both live effects are genuine
  run-once-on-query-data effects (react to async data, imperatively rewrite
  pages/history/meta — not derivable in render), so **kept** with clarifying
  comments: `use-representative-profile.ts:32` (guard tests already cover
  clean/no-data/dirty/saved/pending-load) and `editor-client.tsx:359`, where a
  **phantom `selectedClientId` dep was removed** (leftover from 5.7a; never read
  in the body). `use-quotation-load.ts:67` belongs to the feature-flagged
  quotation module (2.3/3.3) — not touched until that path is live and
  verifiable.
- **5.7d — Keep-but-confirm** — ✅ DONE, both KEPT (comment-only).
  `quotation-canvas.tsx:365` is a genuine imperative Konva `Transformer.nodes()`
  sync (node lives outside React's tree). `editor-client.tsx:207` is a genuine
  external-sync effect publishing `isDraft` to the nav bar (a non-descendant
  sibling via context), with unmount cleanup; kept as state, not a ref (ref
  de-synced across remount — see 5.10). Both annotated in code.
- **5.7e — Latent storage-reading initializers** — ✅ DONE (documented, no code
  change). Verdicts, annotated in code:
  - `isManualStart` and `hasInitialProducts` — **latent risk.** They read
    browser storage at mount (false on the server, possibly true on the client)
    and feed `canSaveWhen`/`isDraft`, which drive the Save button's rendered
    `disabled` state — the **same class of mismatch 5.7a fixed**. Not reproduced
    today (`force-dynamic`, consume-on-read handoff). Harden with a shared
    SSR-safe storage read (`useSyncExternalStore`, null server snapshot) if a
    hydration warning ever appears.
  - initial pages/meta via `getQuotationProducts` — **shielded.** The canvas
    content renders inside the `ssr:false` `QuotationCanvas`, so the page bodies
    never SSR and can't mismatch; the only exposure is the Save-button path
    above.
  - `pendingHomeContactIdRef` — **safe.** A ref read only inside the
    client-seeding effect, never during render.

**All of 5.7 (a–e) is complete.** The only follow-up is the deferred
`use-quotation-load.ts:67` (quotation module, 2.3/3.3) and the optional hardening
of the two latent initializers in 5.7e if a hydration warning surfaces.

### Task 5.7f — Extract shared effect hooks (Phase 5, follow-up to the 5.7 audit)

The audit asked whether the kept effects should become custom hooks. Verdict:
only where it removes real duplication — a lone subscription effect
(Escape/outside-click, timer, image load) is clearer inline, so those stay.

- **Infinite-scroll `IntersectionObserver`** — ✅ DONE. `product-catalog.tsx` and
  `quotation-list.tsx` had an identical observer effect; extracted to
  `src/app/_hooks/use-infinite-scroll-sentinel.ts` (unit-tested: no-observe when
  no next page, default 200px margin, fetch on intersect, skip while fetching,
  skip when not intersecting, disconnect on unmount). Behaviour-preserving.
- **Modal Escape / outside-click** (`confirm-modal`, `add-product-modal`,
  `actions-menu`) — **deferred to Task 5.6**, which already scopes a shared
  Escape/outside-click hook "only if its API stays simpler than the current
  effects." Risk: a flag-laden hook (`closeOnEscape`/`closeOnOutsideClick`/
  `autoFocusRef`) muddier than the three bespoke effects.
- **`STORAGE_EVENT` sync** (`quotation-bar.tsx`, `product-card.tsx`) — **optional
  follow-up.** Mild duplication; the correct primitive is a
  `useQuotationSelection()` built on `useSyncExternalStore` (also SSR-safe,
  unlike the current mount effect). Bundle with any 5.7e storage hardening.

### Task 5.9 — Draft protection is an in-session band-aid (Phase 5) — deferred to the quotation module

`editor-client.tsx` derives `isDraft` ("unsaved content worth protecting") and
guards `beforeunload` + in-app nav (`a5aecac`). But draft-ness is inferred from
**consume-on-read `sessionStorage` handoffs** (`takePendingManualQuotation` clears
on read; product selection is read at mount) captured once at mount, so it is
fragile across **tab duplicate/clone/refresh** (storage is copied at clone time;
the manual flag may already be consumed). The durable fix is real **draft
persistence** (the feature-flagged `_my-quotations` module): persist/restore
drafts and derive `isDraft` from the loaded content, not one-shot mount flags.
Re-evaluate the whole `isDraft` derivation then. `isDraft` was named with that
future in mind.

### Task 5.10 — Nav draft-guard scope is intentionally narrow (Phase 5) — deferred

`nav-bar.tsx` only intercepts the two nav links (Nueva cotización / Editor) via
`EditorDraftProvider` (`editor-draft-context.tsx`). **Sign-out** and the catalog
floating "Cargar en el editor" bar (`quotation-bar.tsx`, a plain `<a href>`) are
**not** guarded. Sign-out from a dirty editor still discards silently; decide
whether to guard it when touching auth/nav. The context is deliberately a tiny
state-backed provider (an earlier ref-based version silently de-synced across an
editor remount — do not reintroduce a ref here).

### Task 5.11 — Direct `pdf-export.ts` tests for the remaining helpers (Phase 5)

Task 4.4 added direct tests (`parseColor`, `wrapText`, `collectImageElements`,
`resolveImages`); `drawTable` cell iteration is still only covered indirectly via
`table-ops` / `line-items` tests. Add a focused test when next touching the
exporter.

## Phase 6 — End-to-end tests (Playwright, main-flow coverage)

Complements the unit-test push (Task 3.7). Unit tests pin pure logic and hooks;
this phase locks the **main user flow** and the **editor's functionality**
end-to-end through the real Next.js app. Scope is the critical happy-paths plus a
few high-value negative paths — not exhaustive coverage.

> **The real user flow (the only one reachable today):** SKU lookup → create
> quotation → edit data in the editor → save quotation → export PDF. The product
> **catalog** (`/catalog`, `ProductCatalog`) is an **unlinked/hidden route** and
> **My Quotations** (`_my-quotations`) is **feature-flagged off**, so both are
> **out of scope** until revived (consistent with the Task 2.3 / 3.3 deferrals).

> **What writes to the DB (verified 2026-11-04):** only **Save** writes. SKU
> lookup (`resolveSkus`) is read-only (external API → normalize → return), and
> building/editing the quotation is entirely client-side (sessionStorage +
> in-memory pages); PDF export is client-side jsPDF. So the **only** rows any
> test creates are at Save: a `quotation` row (+ an optional `[E2E]`-tagged
> `client`/`client_contact`). Editor-functionality specs that stop short of Save
> create **nothing** and need no teardown.

> **Prereqs & tooling.** Playwright drives a real browser against the app wired
> to the **Supabase dev** project (`.env.development`). Pin `@playwright/test` as
> a devDep; confirm `pnpm exec playwright --version` before Task 6.0. These tests
> **require a DB and a mocked external API**, unlike the Vitest suite — so they
> live under a separate `test:e2e` script and config and do **not** run as part
> of `pnpm test`. **Run locally for now;** nightly scheduling is a later,
> optional task (6.8) to decide once the suite is stable.

> **Design constraints (agreed):**
>
> 1. **Shared dev DB, no bloat — isolate-then-delete.** No separate test
>    project/branch is available, so tests run against the shared Supabase dev DB.
>    Every row a test creates must be removed, and cleanup must be scoped so it
>    can never touch another user's data.
>    - **One stable, long-lived e2e user** — seeded once (`pnpm db:seed:dev`),
>      reused across runs. Do **not** create/delete the auth `user` per run
>      (cascade to `account`/`session`, parallel-worker races, little upside).
>      Everything a test creates is **scoped to this user's `id`**, the hard
>      safety boundary for teardown.
>    - **Created rows are `quotation` and `client`/`client_contact`, and only at
>      Save.** `quotation` has **no user-controlled text column**, so quotations
>      are deleted purely by `user_id = <e2e user>`. `client` **is** tagged with a
>      sentinel (`name LIKE '[E2E]%'`) and deleted by `user_id = <e2e user> AND
name LIKE '[E2E]%'`; `client_contact` cascades. (Tables are physically
>      prefixed `mm_web_`.)
>    - **Two-layer cleanup:** per-test `afterEach` deletes the IDs a test created
>      (captured from the save response), and a Playwright **global teardown**
>      sweeps anything leaked from a crashed run — both scoped to the e2e
>      `user_id`. Teardown uses a direct `postgres` client over `DIRECT_URL`.
> 2. **Products come from the mocked external API, not the DB.** The reachable
>    flow sources products via **SKU lookup** (`product.resolveReferences` →
>    `resolveSkus`), the only path that hits the external aggregator
>    (`externalGet`, bearer token). **No product seeding is needed** (the catalog,
>    which reads `product`/`product_variant`, is out of scope). Mock the external
>    API for determinism and to stage resolved / unresolved / malformed cases.
>    **Primary** technique: Playwright `page.route()` intercepting the
>    `/api/trpc` call (mind the tRPC **batch + superjson** envelope). **Fallback**
>    if envelope matching is fiddly: point `EXTERNAL_API_BASE_URL` at a tiny local
>    **stub server** so interception happens at the `externalGet` boundary and the
>    tRPC layer stays real. Start with `page.route`; fall back only if needed.

> **Status (Phase 6):** not started. Two independent tracks share the 6.0
> harness:
>
> - **Flow track** (one linear journey): 6.0 → 6.1 → 6.2 → 6.3 → 6.4. MVP =
>   6.0 + 6.1(a) + 6.2 + 6.3.
> - **Editor track** (the app's core, many focused specs): 6.0 → 6.5. This is the
>   largest single piece; land a **core subset first** (selection, inline edit,
>   undo/redo, duplicate/delete) to prove the canvas-interaction harness, then add
>   formatting + table ops.
>
> 6.6 (auth) underpins both. 6.7 (lookup negative paths) and 6.8 (nightly
> schedule) are follow-ups.

### Task 6.0 — Playwright setup & DB-cleanup harness (Phase 6, prerequisite) — ✅ DONE (code; needs a DB run)

Stand up the e2e infrastructure and the isolation/teardown harness **before**
writing specs, so every spec is clean-by-construction.

> **Landed:** `@playwright/test@1.64.1` (pinned); `playwright.config.ts`
> (`testDir: e2e/`, `webServer: pnpm dev:db:dev`, global setup/teardown, Chromium,
> shared `storageState`); `e2e/_support/` harness — `db.ts` (direct `postgres`
> over `DIRECT_URL`, user-scoped `deleteQuotationsForUser` /
> `deleteE2eClientsForUser` / `countE2eRowsForUser`), `env.ts`, `global-setup.ts`
> (resolve e2e user id + sign-in storageState), `global-teardown.ts` (scoped
> sweep), `mock-external.ts` (`mockResolveReferences` via `page.route`),
> `fixtures.ts` (per-test cleanup seam); `e2e/smoke.spec.ts`; `test:e2e` /
> `test:e2e:ui` scripts; `.env.example` + `.gitignore` updated; ESLint relaxes
> `react-hooks/rules-of-hooks` for `e2e/**` (Playwright's `use` fixture param).
> Verified without a DB: `typecheck`/`lint` clean, Vitest unaffected (270/270),
> `playwright test --list` finds both specs, Chromium installed, and `test:e2e`
> reaches global setup (fails with the intended "seed E2E_USER…" message).
> **Not yet run green** — needs `.env.development` (DB creds + `E2E_USER_EMAIL`/
> `E2E_USER_PASSWORD`) and `pnpm db:seed:dev` for the e2e user. Run once:
> `pnpm db:seed:dev "<e2e-email>" "<pw>" "E2E User"` then `pnpm test:e2e`.

- **Add:** `@playwright/test` (pinned devDep); `playwright.config.ts` (own
  `testDir`, e.g. `e2e/`, separate from Vitest's `src/**/*.test.*`); `test:e2e`
  (+ `test:e2e:ui`) scripts loading `.env.development`; a `webServer` entry so
  Playwright boots the app. Browser install is `pnpm exec playwright install`.
- **E2e user:** seed one dedicated user (e.g. `e2e@test.local`) via
  `pnpm db:seed:dev`; record credentials as e2e env vars. Resolve the e2e user's
  `id` once in global setup (store for teardown scoping). **No product seeding**
  — products come from the mocked external API.
- **Auth fixture:** a Playwright fixture that signs in once (credentials) and
  **reuses `storageState`** so each spec starts authenticated — except the
  dedicated login specs (6.6), which drive the form directly.
- **Cleanup harness:** a small `e2e/_support/db.ts` using a direct `postgres`
  client over `DIRECT_URL`:
  - `deleteQuotationsForUser(userId)` → `DELETE FROM mm_web_quotation WHERE
user_id = $1`.
  - `deleteE2eClientsForUser(userId)` → `DELETE FROM mm_web_client WHERE user_id
= $1 AND name LIKE '[E2E]%'` (contacts cascade).
  - Wire per-test `afterEach` (delete captured IDs) **and** `globalTeardown`
    (sweep by e2e `user_id`).
- **External-API mock helper:** `e2e/_support/mock-external.ts` exposing
  `mockResolveReferences(page, { resolved, unresolved })` via `page.route` on
  `**/api/trpc/**` (handle batch + superjson). Keep the stub-server fallback
  behind the same helper API so specs don't change if we switch techniques.
- **Acceptance:** `pnpm test:e2e` runs a trivial smoke spec (app boots, login
  page renders) green locally; a deliberately row-creating throwaway spec leaves
  **zero** residual rows for the e2e user after teardown (verify by querying
  counts before/after); `pnpm test` (Vitest) is unaffected (separate testDir).
- **Effort:** medium–large (one-time). **Risk:** medium — teardown scoping is
  safety-critical; always filter by the e2e `user_id`, never a bare `LIKE`.

## Flow track — the reachable end-to-end journey

### Task 6.1 — SKU lookup → create quotation (Phase 6, flow entry)

- **Specs** (external API mocked via `mockResolveReferences`): (a) **all
  resolved** — on `/`, pick a client + enter known SKUs → resolve → "Cargar en el
  editor" → `/editor` renders a product page per resolved product (name /
  reference / inventory table present); (b) **manual start** —
  "Crear cotización manual" with a client → `/editor` opens with blank item
  fields.
- **Entry point:** `reference-lookup.tsx`. This is the app's real entry to the
  editor (the catalog is hidden).
- **Acceptance:** resolved products reach the editor; no live external call
  (assert via interception). No DB writes.
- **Effort:** medium. **Risk:** medium (tRPC batch/superjson envelope in the
  mock — stub-server fallback de-risks). **Depends on:** 6.0.

### Task 6.2 — Edit data in the editor (flow step) (Phase 6)

- **Spec:** in the populated editor from 6.1, edit a header field / line-item
  cell → value changes; **undo** reverts; **redo** reapplies; dirty state is
  reflected (Save enables).
- **Notes:** the flow-level smoke of editing; the **exhaustive** editor coverage
  lives in the editor track (6.5). Konva renders in a real browser here.
- **Acceptance:** edit/undo/redo observable via rendered value + Save enablement.
  No DB writes.
- **Effort:** small–medium. **Risk:** medium (canvas selectors — prefer
  `data-testid`/roles). **Depends on:** 6.1.

### Task 6.3 — Save a quotation (DB write + cleanup) (Phase 6)

- **Spec:** from the edited editor, pick/create a client (tagged `[E2E] …`),
  click **Save** → success state; saved identity set; dirty clears. Capture the
  created `quotation` id (and any `client` id) from the response.
- **Cleanup:** `afterEach` deletes captured ids; global teardown sweeps by e2e
  `user_id` as backstop.
- **Acceptance:** save persists (optionally re-query by id to confirm `user_id`,
  `product_count`, `references`); after the spec, teardown leaves zero e2e-user
  quotations / `[E2E]` clients.
- **Effort:** medium. **Risk:** medium (**the only DB-writing flow** — cleanup
  correctness is the main risk; always scope by e2e `user_id`).
- **Depends on:** 6.0 (cleanup harness), 6.2.

### Task 6.4 — PDF export (flow finish) (Phase 6)

- **Spec:** from a populated editor, click **Export PDF** → assert a download
  fires (`page.waitForEvent('download')`) with a sensible filename; assert the
  file is non-empty. Do **not** assert PDF pixel contents.
- **Notes:** jsPDF runs client-side; validates export wiring, not fidelity.
- **Acceptance:** a download event fires and produces a non-empty file. No DB
  writes. **Effort:** small. **Risk:** low. **Depends on:** 6.2.

## Editor track — dedicated functionality suite (the app's core)

### Task 6.5 — Editor functionality suite (Phase 6)

The editor is the core of the app; cover its capabilities as **focused,
independent specs** (not one journey), each starting from a populated editor
reached via a shared mocked-lookup fixture. All stop short of Save, so they
create **no DB rows and need no teardown**.

- **Specs (by feature area):**
  1. **Selection & transform** — click an element selects it (floating toolbar
     appears); drag moves it; a resize handle changes size; click empty canvas
     deselects.
  2. **Inline text edit** — edit a text element's value → commit → persists.
  3. **Text formatting** (`text-format-controls`) — bold / italic / underline
     toggles, font size / family, color on a selected text element apply.
  4. **Element creation** (`editor-toolbar` / `actions-menu`) — add text / rect /
     table / image; add page → new elements/page appear.
  5. **Duplicate & delete** (`floating-toolbar`) — duplicate (button + Ctrl+D)
     copies; delete (button + Supr) removes.
  6. **Table operations** (`table-controls`) — add/remove row, add/remove column,
     select rows + remove selected → table dimensions change.
  7. **Undo/redo** — an edit, undo reverts, redo reapplies; buttons
     enable/disable correctly.
- **Selectors (main risk):** elements render to `<canvas>`, so prefer the DOM
  overlays/toolbars (inline editor, floating/format/table controls) with stable
  `data-testid`/roles; treat coordinate hit-testing as a last resort. Adding a
  few `data-testid`s to editor DOM is in scope.
- **Land incrementally:** **core subset first** — specs 1, 2, 5, 7 — to prove the
  canvas harness; then 3, 4, 6.
- **Acceptance:** each feature area asserted via rendered state; no DB writes.
- **Effort:** large (the biggest Phase 6 piece). **Risk:** medium–high (canvas
  selectors). **Depends on:** 6.0 + the mocked-lookup fixture from 6.1.

## Shared / follow-ups

### Task 6.6 — Auth flows (Phase 6, underpins both tracks)

- **Specs:** (a) **login success** — seeded credentials → lands on `/`, nav shows
  the signed-in user; (b) **invalid credentials** — wrong password →
  `role="alert"` message, stays signed out; (c) **auth guard round-trip** — visit
  `/editor` signed out → redirect to login with `callbackUrl=/editor` → after
  login returns to `/editor`; (d) **logout** — sign out → back to login,
  `/editor` blocked again.
- **Notes:** drive the login form directly (not the shared `storageState`
  fixture). Microsoft Entra login is **out of scope** (external IdP) — at most a
  render/redirect smoke check, no live SSO.
- **Acceptance:** all four asserted; no rows created. **Effort:** small.
  **Risk:** low. **Depends on:** 6.0.

### Task 6.7 — SKU lookup negative paths (Phase 6, follow-up)

- **Specs** (mocked): (a) **mixed** — some unresolved → UI reports which codes
  were not found while letting the user proceed with the resolved ones;
  (b) optional **malformed payload** → treated as unresolved (no crash).
- **Entry points:** `reference-lookup.tsx` and the editor's
  `add-product-modal.tsx` (both call `product.resolveReferences`).
- **Acceptance:** unresolved/malformed branches render correctly; no live call.
  No DB writes. **Effort:** small–medium. **Risk:** low–medium.
  **Depends on:** 6.1 (reuses the mock helper).

### Task 6.8 — Nightly scheduled run (Phase 6, optional, decide later)

Deferred by choice: **run e2e locally first**, then decide whether to schedule.
When wanted, add a GitHub Actions workflow with `on: schedule` (cron is **UTC**;
e.g. `0 7 * * *` ≈ 02:00 America/Bogotá) **plus** `workflow_dispatch` for manual
runs. Notes: scheduled runs fire only on the **default branch**, timing is
best-effort (can lag/skip under load), and workflows **auto-disable after 60 days**
of repo inactivity. The job should **build + serve the app on the runner** (not
target the shared Vercel dev deployment) so it tests the exact `main` commit;
secrets (`DATABASE_URL`, `DIRECT_URL`, `AUTH_SECRET`, external-API vars) point at
Supabase dev; add a seed step for the e2e user and a failure notification
(the shared dev DB means teardown must stay reliable under CI parallelism).
**Depends on:** a stable 6.0–6.5 suite.

## Phase 7 — Revisit unit tests & raise coverage further

Task 3.7 lifted editor statement coverage from ~13% to ~46% across three tiers.
This phase picks up where it stopped: close the remaining gaps, harden the tests
already written, and turn coverage into an enforced, ratcheting gate.

> **Status (Phase 7):** not started. Natural order: 7.1 → 7.2 (gate once
> editor-client is covered) → 7.3 → 7.4. 7.4 can be done opportunistically at any
> point. Builds on the Task 3.7 infra (jsdom + RTL + `@vitest/coverage-v8`).

### Task 7.1 — Finish the deferred editor-client coverage (Phase 7)

- **Files:** `editor-client.tsx` (0% today — the single largest editor gap),
  new `editor-client.test.tsx`.
- **Change:** add an RTL test at a stable seam. Mock `@/trpc/react` (the
  `quotation.*` / `product.*` procedures it consumes) and the `sessionStorage`
  handoffs; assert the orchestration wiring — save enablement, add/append
  products, page add/delete — without chasing Konva rendering (canvas mocked as
  in Task 3.7 Tier 3).
- **Acceptance:** editor-client has meaningful statement coverage; the mount and
  the main callbacks are exercised; no flakiness.
- **Effort:** medium. **Risk:** low–medium (mock-heavy; keep seams stable).

### Task 7.2 — Turn on a ratcheting coverage threshold (CI gate) (Phase 7)

- **Files:** `vitest.config.ts` (`coverage.thresholds`), the CI `test` job.
- **Change:** set editor-scoped `thresholds` at (or just below) the then-current
  numbers so coverage cannot regress; raise them as 7.1/7.3 land. Wire
  `pnpm test:coverage` into CI (or add `--coverage` to the `test` job). Decide
  global-vs-glob scoping explicitly so non-editor files aren't gated prematurely.
- **Acceptance:** a PR that drops editor coverage fails CI; the threshold is
  documented and matches reality.
- **Effort:** small. **Risk:** low (watch for flaky/first-run threshold misses).

### Task 7.3 — Deepen the Tier 2/3 tests (behaviour, not just render) (Phase 7)

- **Change:** push beyond smoke/render into interactions now that the infra
  exists — e.g. `use-inline-editing` open→edit→commit→Tab through a mocked
  stage; `quotation-canvas` paste/selection handlers; `canvas-page-renderer`
  image loading/placeholder/retry states; `table-node` cell/row/column select
  and resize callbacks. Add the `pdf-export` `drawTable` cell-iteration test
  (Task 5.11).
- **Acceptance:** the core editor interactions (not just that components render)
  are asserted; expected values come from worked examples, not the code.
- **Effort:** medium–large. **Risk:** low (additive).

### Task 7.4 — Harden the existing suite (Phase 7)

- **Change:** review Task 3.7's tests for brittleness and drift — prefer
  role/text queries over structure, extract the repeated `react-konva` DOM mock
  into one shared test helper (`src/test/`), and remove any assertions coupled to
  implementation detail. Re-check the test-file ESLint override stays as narrow
  as possible.
- **Acceptance:** one shared konva mock helper; no duplicated mock factories;
  tests survive a refactor of internals.
- **Effort:** small–medium. **Risk:** low.

---

# Done

## Phase 1 — Quick wins & correctness

### Task 1.1 — Save-button disable bug (Phase 1) — ✅ DONE (`7d5aed4`)

Fixed; `prefer-nullish-coalescing` configured to ignore booleans.

### Task 1.2 — Shared line-items helper (Phase 1) — ✅ DONE (`965f34c`)

Shared `_lib/line-items.ts` (dedup + `LINE_ITEM_COLS`), with tests.

### Lint cleanup (Phase 1, not a numbered task) — ✅ DONE (`3158769`)

All 16 lint errors cleared; four React Compiler rules downgraded to `warn`.

## Phase 2 — Security

> **Design constraint — lossless round-trip.** A coming quotation module will
> load saved quotations _back into the editor_ for editing, so stored `data` is
> a faithful **snapshot**: every element, position, size, style, and config must
> survive save→load exactly. The storage schema validates _structure, types, and
> bounds_ but is **template-agnostic** and **lossless** (preserves unknown keys);
> the "some elements always present" rule is enforced separately (Task 2.3).

### Task 2.1 — Lossless Zod schema for persisted `data` (Phase 2, was ref 4.1) — ✅ DONE (`0fe83fe`)

`quotation-schema.ts` (template-agnostic, `.passthrough()` lossless, drift guard,
`quotationDocumentInput`) wired into `save`.

### Task 2.2 — Constrain image `src` (Phase 2, was ref 4.2) — ✅ DONE (`83c490f`)

`isAllowedImageSrc` allowlist enforced in the schema + both sinks (pdf-export,
canvas).

## Phase 3 — Architecture + tests

### Task 3.0 — Consolidate hooks into `_hooks/` (Phase 3) — ✅ DONE (`f3ffce5`)

Moved `use-table-selection`, `use-canvas-stage`, `use-inline-editing` from `_lib/`
to `_hooks/`; pure helpers stay in `_lib/`. Mechanical `git mv` + import fixes.

### Task 3.1 — `useEditorKeyboardShortcuts` + pure keydown helper (Phase 3, was ref 1.1/5) — ✅ DONE (`2b0579d`)

Global `keydown` effect → `_hooks/use-editor-keyboard-shortcuts`; pure
`decideShortcut()` → `_lib/keyboard.ts` (15 tests). Behaviour preserved, incl. the
Cmd/Ctrl+D quirk.

### Task 3.2 — `useQuotationHistory` (Phase 3, was ref 1.1/1.3) — ✅ DONE (`76e289b`)

`pages` state + undo/redo stack → `use-quotation-history.ts`, delegating stack
math to a pure `_lib/history.ts` reducer (9 tests). Dirty/save-race stays in the
client via an `onEdit` seam.

> **Candidate follow-up (not committed):** converting the hook internals to
> `useReducer(historyReducer, …)` is a clean, isolated improvement (reducer
> already pure+tested), no new dependency/behaviour change. Low priority; the
> narrowest "reducer/store" step — see Task 4.0a.

### Task 3.3 — `useQuotationLoad` + `useQuotationPersistence` (Phase 3, was ref 1.1) — ✅ DONE (`d079212`, `4f0de7e`)

Split in two: `useQuotationPersistence` (saved identity + `quotation.save` +
`canSave`/`handleSave`; live) and `useQuotationLoad` (`byId` + auto-apply-clean +
dirty-overwrite confirm; page transforms stay in the client as an injected
`hydrateFromRow`). Load entry point is flag-gated off, so that half is extraction
-only. `beforeunload` guard stayed in `editor-client.tsx`.

### Task 3.4 — `EditorToolbar` + `floating-toolbar` split (Phase 3, was ref 1.1/1.6) — ✅ DONE (`b020887`, `85098ad`, +2b)

Header → `_components/editor-toolbar.tsx`; table-mutation logic → pure
`_lib/table-ops.ts` (12 tests); floating-toolbar rendering split into
`text-format-controls.tsx` + `table-controls.tsx`, `FloatingToolbar` a thin
orchestrator. Behaviour preserved.

### Task 3.5 — Element `role` discriminator (Phase 3, was ref 1.2) — ✅ DONE (`08acdcf`)

`role` on `TemplateElement` + pure `_lib/element-role` (`elementRole`,
`isLineItems`, `isLineItemsId`) with legacy-id back-compat (20 tests) and a schema
`role` enum; all id `startsWith`/exact-id checks replaced across editor + server
router (fixes the `derivePageFields`/`setQuotationNumber` layering leak).

### Task 3.6 — Slim down `use-inline-editing` (Phase 3) — ✅ DONE (`0006656`)

Overlay geometry → pure `_lib/editing-geometry`
(`computeContentTop`/`computeEditingBox`, 5 tests); Tab navigation → pure
`_lib/table-navigation` (`nextEditableCell`, 6 tests); hook delegates, return
surface unchanged.

### Task 3.7 — Raise editor test coverage (Phase 3, gate before Phase 4) — ✅ DONE

Editor statement coverage **~13% → ~46%** (233 tests, +63) across Tier 1 (pure
`_lib`), Tier 2 (hooks via RTL `renderHook`), Tier 3 (components via RTL with
`react-konva` mocked). Infra: jsdom + Testing Library + `@vitest/coverage-v8` +
`test:coverage`; `.test.tsx` runs under jsdom via per-file
`// @vitest-environment jsdom`. **Decisions:** (a) no failing CI coverage
`thresholds` yet (deferred to Task 7.2); (b) `editor-client.tsx` component test
deferred to Task 7.1 (tRPC-multi-procedure + sessionStorage make a full mount
brittle; logic already covered by the hook + `_lib` tests).

<details><summary>Original task detail</summary>

Lock in a safety net over the editor's **core functionality** before the Phase 4
performance work changes render behaviour. Coverage accrued opportunistically as
each extraction shipped its own pure-logic tests; this task closed the remaining
gaps deliberately, tiered — cheap pure tests first, then DOM infra only where it
pays off.

- **Tier 1 — remaining pure `_lib/` helpers:** `clipboard.ts`,
  `quotation-canvas-geometry.ts` (`getPageOffset`), `template-data.ts`, and
  `pdf-export.ts` pure helpers.
- **Tier 2 — hooks (jsdom + RTL `renderHook`):** `use-quotation-history`,
  `use-quotation-persistence`, `use-inline-editing`, `use-representative-profile`.
- **Tier 3 — components / interactions (RTL, canvas via `react-konva` mock):**
  `quotation-canvas`, `canvas-page-renderer`, `table-node`, `floating-toolbar`,
  `editor-client`. Assert on props/handlers wired to Konva nodes, not pixels.
- **CI / threshold:** optionally ratcheting `vitest --coverage` scoped to
  `src/app/editor/**` (decided: defer to Task 7.2).

</details>

## Phase 4 — Performance

### Task 4.0 — Fix refs-during-render & re-upgrade the lint rule (Phase 4, was ref 3.7) — ✅ DONE

`useCanvasStage` returns its refs (`stageRef`, `containerRef`, `pastePositionRef`)
under a dedicated `refs` key, separate from render-safe state and handlers;
`quotation-canvas.tsx` destructures them as direct identifiers and touches them
only in handlers/effects. `react-hooks/refs` re-upgraded `warn` → `error`.
Verified (233 tests).

### Task 4.1 — Stabilize per-element handlers & `dragBoundFunc` (Phase 4, was ref 2.2) — ✅ DONE

Replaced the per-element `makeDragBoundFunc(page, element)` factory with ONE
stable `dragBoundFunc` (`useCallback`); it resolves element+page from the dragged
node's `id()` via a synchronous `pagesRef` mirror and delegates to pure
`_lib/drag-bounds.ts` (`clampToPageBounds`, 5 tests). Stable prop identity
(prereq for 4.2). Verified (238 tests, +5).

### Task 4.2 — `React.memo` the Konva tree (Phase 4, was ref 2.1) — ✅ DONE (PR #11)

Wrapped `TableNode`, `CanvasPage`, `ImageElement` in `React.memo` + memoized the
`selection` bag + passed stable `selectElement` directly. **Delivered:
page-level re-render isolation** — editing an element on one page no longer
re-renders OTHER pages. Verified (238 tests).

> **Known follow-up (scoped out):** when a page DOES re-render, its per-element
> closures (`select`, `commonProps`, inline handlers) are still rebuilt, so
> per-node `TableNode`/`ImageElement` memo doesn't fire. Full per-node memoization
> needs those closures stabilized — edges toward the 4.0a-deferred store territory.
> Revisit only if a Profiler trace shows it matters.

### Task 4.3 — Precompute column prefix sums (Phase 4, was ref 2.3) — ✅ DONE (PR #12)

New pure `_lib/column-offsets.ts` (`columnOffsets` → prefix-sum array) with 4
tests. `table-node.tsx` computes `offsets`/`totalWidth` once per render and
replaces 6 `slice().reduce()`/`reduce()` calls (the 3 in the cell double-map were
the O(n²) hotspot) with O(1) reads; `editing-geometry.ts` uses the same helper.
Verified (242 tests, +4).

### Task 4.4 — Parallelize PDF image loading (Phase 4, was ref 2.4) — ✅ DONE (PR #13)

`exportPagesToPdf` pre-resolves every image in parallel (`resolveImages` over
`Promise.all` with per-image `try/catch` for error isolation), then draws in
strict document order — output identical, only the I/O overlaps. Split async
`drawImage` into `loadImageForElement` + a synchronous `drawImage`; new pure
`collectImageElements` + `resolveImages` seams with 5 tests. Verified (247 tests,
+5).

## Phase 5 — Lower-priority cleanup

### Task 5.8 — Remove the i18n layer (Phase 5) — ✅ DONE (single commit on `main`)

App is Spanish-only; `src/i18n` + `t()` + `locale` params removed in favour of colocated Spanish literals (also dropped 5 unused catalog keys). Re-introduce a message layer when the editor is extracted into a package.

### Task 5.1 — Replace client-side `alert(...)` (Phase 5, was ref 3.3) — ✅ DONE (PR #15)

App-wide `ToastProvider`/`useToast()` replaces the two `alert()` calls (save +
PDF errors); save failures routed via an injected `onSaveError` seam. Also fixed
a save-hangs-offline bug (`networkMode: "always"` + `navigator.onLine` guard).
Top-right placement + subtle enter/exit animation.

### Task 5.3 — `ImageElement` typing (Phase 5, was ref 3.5) — ✅ DONE (PR #14)

Replaced the `Record<string, unknown>` + double cast with a real
`ImageElementProps` interface (`Konva.RectConfig & Partial<Konva.ImageConfig>` —
`image` is resolved internally, so optional in the caller contract).

### Task 5.5 — Lint debt (Phase 5, was ref 3.7) — ✅ DONE (already clear)

The `clipboard.ts` regexp/unsafe-return and `quotation-canvas.tsx`
ref-reads-in-render were resolved in Phase 3 + Task 4.0 (`pnpm lint` = 0 errors).
Only the `set-state-in-effect` **warning** remains, tracked under Task 5.7.

---

## Dependency notes

- Task 2.1 (Zod schema) is a prerequisite for Task 3.5 (element `role`).
- Task 4.2 (`React.memo`) is blocked by Task 4.1 (stable props).
- Task 3.5 touches persisted `data` — kept after the hook extractions; shipped a
  legacy-id → `role` back-compat path.
- A full `useReducer` migration (finding 1.3) is intentionally **not** a task — a
  larger follow-up once the history/persistence hooks exist.
- Phase 6 Task 6.0 is a hard prerequisite for all other 6.x specs. Phase 6 is
  independent of Phase 4/5 and can proceed in parallel, but is best started after
  the core editor UI is stable so selectors don't churn.
