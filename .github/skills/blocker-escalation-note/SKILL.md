---
name: blocker-escalation-note
description: Turn a recorded BLOCKER-* or AMB-* (an execution blocker or an unresolved ambiguity) into a short, precise, human-forwardable note asking exactly what is needed to unblock it. Use when a scenario, endpoint, or test-plan item is stuck on a real human decision (a missing endpoint, an unclear business rule, an unconfirmed environment fact) and the user wants something they can hand to a developer, PO, or teammate.
license: MIT
metadata:
  author: sdd-workflow-orchestrator
  version: "1.0"
---

Compose a short, precise, human-forwardable note from a blocker or ambiguity that is already
recorded in a governed artifact (an execution record, an RTM entry, a requirement's `AMB-*`, or a
workflow `errorDetails`). This skill never invents the blocker itself — it only restates one that
already exists on disk, in plain language a non-agent can act on.

**This is a communication aid, not a governed artifact.** It never creates or edits anything under
`requirements/`, `test-plans/`, `traceability/`, `workflow/`, or `defects/` — those stay exactly as
already recorded. It produces a short note only.

## Input

A blocker/ambiguity id (e.g., `BLOCKER-EC-12000-002`, `AMB-EC-12000-001`), a scenario id
(`TS-<JIRA>-<nnn>`), or a plain description of which stuck item the user means. If ambiguous, ask
which one — never guess which blocker the user wants escalated.

## Steps

1. **Find the real source.** Locate the blocker/ambiguity's actual recorded text — in
   `traceability/executions/<EXECUTION-ID>.json` (`blockerId`/`blockerReason`), the RTM's `gaps`
   entry, `workflow/instances/<workflowId>.json`'s `errorDetails`, or the requirement's `AMB-*`
   entry. Quote its substance faithfully; never paraphrase away a caveat or soften a fact.

2. **Identify what would actually resolve it.** State the concrete fact(s) a human needs to supply
   or confirm — a URL, an auth mechanism, a business rule, a yes/no on whether a feature is
   deployed, etc. Distinguish **required** (blocking) from **nice-to-have** (reduces risk but isn't
   strictly necessary), as already established for this story if that distinction exists.

3. **State what's already tried.** One or two lines on what was checked and ruled out (e.g., "not
   in `ecore-api-discovery.json`," "confirmed via live network capture during the real UI flow on
   <date>") so the reader does not suggest something already eliminated.

4. **Compose the note.** Keep it to the essentials — title, the question(s), why it's blocking,
   what's already been ruled out. No filler, no restating the whole story background. Format:

   ```markdown
   ## <Scenario/story id>: <one-line summary of what's blocked>

   **Blocked on:** <BLOCKER-ID or AMB-ID>

   **What's needed:**
   1. <concrete fact #1>
   2. <concrete fact #2 if any>

   **Already ruled out / checked:** <one or two lines>

   **Once answered:** <what happens next — e.g., "I can draft the Gate 2 revision and move this to
   automation">
   ```

5. **Deliver it.** Show the note in chat by default. Only write it to a file if the user asks to
   persist it — and then only under `docs/` (never under a governed folder), following the same
   "docs is for human-facing evaluation notes" convention already used for the framework-readiness
   evaluations in this repo.

## Guardrails

- Never invent a business rule, endpoint, or answer to fill the gap — the note asks the question,
  it does not answer it.
- Never soften or omit a caveat the blocker already recorded (e.g., "the framework cannot discover
  this" stays in, even if it makes the note longer).
- Never mark the blocker resolved, remove it from its governed artifact, or change its `status` —
  only a real fix (an artifact update going through the normal stage) does that.
- One note per blocker/ambiguity per request — do not bundle unrelated blockers into one note
  unless the user explicitly asks for a combined summary.
