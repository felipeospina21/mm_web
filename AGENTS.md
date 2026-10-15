

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
