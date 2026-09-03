---
description: "Use when creating or editing governed JSON artifacts: requirements, acceptance criteria, approvals, test plans, workflow state, defect reports, RTM, coverage matrices or lookup indexes. Covers stable IDs, JSON Schema plus Zod parity, approval evidence and honest coverage."
name: "Governed artifact authoring"
applyTo: ["requirements/**/*.json", "test-plans/**/*.json", "workflow/**/*.json", "traceability/**/*.json", "defects/**/*.json", "src/models/**/*.ts"]
---

# Governed artifact authoring

Every file matched here is **governed data**, not free-form JSON. It is validated at runtime by a
Zod model in `src/models/` and structurally compared against a JSON Schema.

## Always do this

1. **Copy the shape from the `ETA-351` example** instead of inventing fields. `ETA-351` is the
   only story in the repository and the reference shape for every artifact type; the file-by-file
   list is in the reference-examples table in [AGENTS.md](../../AGENTS.md). The schemas are
   `additionalProperties: false` / Zod `.strict()` — an extra key is a hard failure.
2. **Run `npm run validate:artifacts` after every edit.** Do not report success until it passes.
   Read the failure text: it names the file, JSON path and rule.
3. **Keep the JSON Schema and the Zod model in sync.** Adding a field to one without the other
   fails the `*-STRUCTURE` parity check. Schemas live beside their artifacts
   (`requirements/schemas/`, `test-plans/test-plan.schema.json`, `workflow/definitions/`,
   `traceability/schemas/`); models live in `src/models/*.model.ts`.

## Identity and versioning

- IDs are **immutable**. Merge by ID, never by array position. Patterns are in
  `src/models/common.model.ts` — a malformed ID fails validation.
- `artifactVersion` is an integer that **increments whenever approved content changes**. Never
  rewrite history in place; supersede with a new version and set `supersedes`.
- `workflowId` must be exactly `WF-<jiraStoryId>-R<release>`. One instance per story and release.

## Approval evidence

- An artifact may only be `APPROVED` if `approvalRef` points at an existing, schema-valid approval
  file. There is one generic approval schema at `requirements/schemas/approval.schema.json`.
- `approvalId` prefix must match the gate: `APR-AC-` ↔ `ACCEPTANCE_CRITERIA`,
  `APR-TP-` ↔ `TEST_PLAN`, `APR-AD-` ↔ `AUTOMATION_DESIGN`.
- Gate 1 approvals need at least one `itemDecisions` entry — one decision per acceptance criterion.
- Placeholder templates (`<APPROVE|REJECT|...>`) belong in `requirements/reviews/`, which the
  validator does not scan. Never leave a placeholder in an `approved/` folder.

## Workflow state

- `status: WAITING_FOR_HUMAN` ⇔ `pendingApproval` is non-null. Both directions are enforced.
- `status: BLOCKED` requires `errorDetails` naming the **exact** blocker and how to clear it.
- `status: COMPLETED` requires `completedAt`.
- A stage may appear in `completedStages` only once — stage execution must be idempotent.

## Traceability and coverage

- One RTM file **per business capability**. Never build a monolithic RTM.
- Every path referenced from an RTM entry must exist on disk (`SEM-RTM` checks this).
- **Never hand-write coverage numbers.** They are recomputed by `computeCoverage()` in
  `src/models/rtm.model.ts` and compared against the stored values. Denominators:
  design and automation coverage divide by approved ACs; execution coverage divides by ACs with
  executable automation; pass coverage divides by executed ACs.
- A zero denominator yields **`null`**, never 0 and never 100.
- Deferred, blocked, manual-only, failed and clarification-required ACs must be listed in `gaps`.
- `PASSED` requires a real execution record. If a test never ran, record `BLOCKED` with the reason.

## Defect artifacts

`defects/<DEF-ID>.json` is validated by `DEF-STRUCTURE` and `SEM-DEFECT-EVIDENCE`
(`npm run validate:defects`). Schema: `defects/schemas/defect-report.schema.json`. Zod:
`src/models/defect.model.ts`.

- A defect must name a **real failed execution**. `executionRecordPath` must exist and the scenario
  must be recorded there as `FAILED` or `TIMED_OUT`.
- `failure.expectedBehaviour` is the approved acceptance criterion **verbatim**. Never paraphrase
  it and never author one.
- Every path in `evidence` must exist. Evidence is copied into `reports/defects/<DEF-ID>/` because
  `test-results/` is overwritten by the next run.
- `healing.attempts` is capped at **two**. `LOCATOR_UNHEALABLE` requires exactly two attempts, none
  of which re-ran green.
- `status: HEALED` requires `jira === null`. A stale locator is not an application bug.
- `status: REPORTED` requires a `jira` block whose `linkedStory` is the story under test and whose
  `fixVersions` came verbatim off that story. A fingerprint already `REPORTED` must be recorded as
  `DUPLICATE` with `dedupeOf`, not filed twice.
- Severity, priority and root cause are **not** fields. They are human judgements.

## Never

- Invent a business rule, role, message, limit, timeout, validation rule, security policy or
  regulatory requirement. Raise an `AMB-*` ambiguity and stop.
- Mix `SAMPLE_DATA` and `REAL_JIRA_DATA` in one artifact.
- Edit `traceability/**` or `workflow/instances/**` from anywhere except the orchestrator flow.
