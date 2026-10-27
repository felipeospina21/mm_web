<!-- hippo:start -->

## Project Memory (Hippo)

At the start of every task, run:

```bash
hippo context --auto --budget 1500
```

Read the output before writing any code.

On errors or unexpected behaviour, record it right then, while you work,
never as a closing step:

```bash
hippo remember "<description of what went wrong>" --error
```

When you learn something that should outlive this session (a decision and
its reason, a user preference, a lesson), record it right then, while you
work, never as a closing step. Leave out secrets and personal details:

```bash
hippo remember "<what you learned and why>"
```

When Hippo's Codex wrapper is installed, session-end capture runs automatically.
If the wrapper is not installed, capture a brief summary manually:

```bash
hippo capture --stdin <<< '<decisions, errors, lessons: 2-5 bullets>'
```

<!-- hippo:end -->

## Conventions

- component names are kebab case (all lower) ex: nav-bar.tsx
- prefer interfaces over type alias unless strcitly necesary or some value out of it.
- avoid huge components with a lot of markup and logic, divide in smaller reusable components.
- create custom hooks to consolidate hooks logic, ex: a useState and a useEffect are related.

## Editor refactor effort (docs/editor-improvements-plan.md)

- Work the plan task-by-task. For each task, briefly discuss problem/fix/
  architecture and wait for explicit confirmation before coding. Keep
  explanations brief.
- Commit directly to `main`, one self-contained commit per task; keep unrelated
  concerns in separate commits. After each task, mark it done in the plan's
  Status block (the source of truth) and collapse the finished task section to a
  one-line reference with its commit SHA.
- Layout: custom hooks live in `src/app/editor/_hooks/` (`use-*`); pure
  decision/transform logic lives in `src/app/editor/_lib/` WITH unit tests
  (e.g. history.ts, keyboard.ts, table-ops.ts, line-items.ts). Hooks stay thin;
  keep cross-cutting concerns (dirty flag, save-race `editRevisionRef`) in the
  caller via injected callbacks/seams (e.g. `onEdit`).
- Extractions must be behaviour-preserving and verified: always
  `rm -rf .next/types && pnpm typecheck`, then `pnpm lint`, then `pnpm test`.
- Verification baselines (don't chase these): `pnpm lint` = 0 errors / 12
  warnings (React Compiler rules intentionally downgraded to `warn`;
  `react-hooks/refs` MUST be re-upgraded to error after the Task 4.0 root fix);
  `pnpm test` has ONE pre-existing unrelated failure in
  `src/server/external/schema.test.ts`.
- The quotation module (`src/app/_my-quotations/`) is feature-flagged OFF, so the
  editor's load-saved-quotation path is not reachable end-to-end — enforcement/
  load work that depends on it is deferred (see plan Tasks 2.3, 3.3).
