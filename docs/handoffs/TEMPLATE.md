# Handoff: <from agent> → <to agent>

> The Orchestrator uses this structure when delegating. It is what the receiving agent sees; it does not see the conversation. Copy it into the subagent prompt or save it as `docs/handoffs/<task-id>-<from>-<to>.md`.

## Task

- **ID:** T-NNN / US-NNN / BUG-NNN
- **Goal (one sentence):**
- **Branch:** `feat/<slug>` (base: `main`)

## Inputs to read first

- `docs/01-requirements.md` → US-NNN
- `docs/02-architecture.md` → section <n>, ADR-NNNN
- Relevant code: `src/<path>`

## Acceptance criteria

<paste the Gherkin scenarios verbatim>

## Constraints

- Do not touch: <files / areas>
- Must follow: <ADR / convention>
- Out of scope: <items>

## Previous round (if a rework)

<Reviewer / QA findings, verbatim, each with the expected fix>

## Expected output

<Exactly what to deliver and in what format, e.g. "code + unit tests in the branch, lint and tests green, report in Portuguese with manual test steps">
