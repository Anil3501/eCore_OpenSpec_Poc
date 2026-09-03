# Framework File Creation Sequence


This document lists **every file created**, in the order it is created, when a Jira story is taken
end-to-end through this OpenSpec-based, orchestrator-driven Playwright-BDD framework — from the
first retrieval step to the final traceability update. It follows
[workflow/definitions/sdd-jira-to-automation.workflow.json](../workflow/definitions/sdd-jira-to-automation.workflow.json)
and uses the real reference story `ETA-351` (capability `account-access`, test plan `TP-ETA-351-001`)
for concrete filenames. Replace `<JIRA-ID>`, `<capability>`, `<TEST-PLAN-ID>`, `<feature>`,
`<change-name>`, `<DEF-ID>`, `<EXECUTION-ID>` with your own story's values.

Three **human approval gates** (🔒) halt the workflow until a schema-valid approval artifact is
placed on disk — a chat message is never an approval. Files are grouped by workflow stage in the
exact sequence the orchestrator drives them.

---

## 0. Workflow bootstrap (once per story + release)

| # | File | Created by |
| - | --- | --- |
| 1 | `workflow/instances/WF-<JIRA-ID>-R<release>.json` | SDD Workflow Orchestrator (durable state, created first and updated after every stage) |

---

## Stage 1 — JIRA_RETRIEVAL

Agent: **jira-requirement-analysis** (via Atlassian MCP, or `npm run jira:fetch` REST fallback)

| # | File | Notes |
| - | --- | --- |
| 2 | `reports/jira/<JIRA-ID>.jira.json` | Verbatim snapshot only, when the REST fallback is used. Never a governed artifact. |
| 3 | `requirements/raw/<JIRA-ID>.json` | Raw Jira story promoted into the governed raw folder |

## Stage 2 — REQUIREMENT_NORMALIZATION

| # | File | Notes |
| - | --- | --- |
| 4 | `requirements/normalized/<JIRA-ID>.json` | Requirements + ACs normalized with stable `REQ-*` / `AC-*` IDs |

## Stage 3 — AC_ANALYSIS

| # | File | Notes |
| - | --- | --- |
| — | `requirements/normalized/<JIRA-ID>.json` (updated) | Same file enriched with proposed ACs / `AMB-*` ambiguities; no new file |

## Stage 4 — AC_REVIEW_PACKAGE

| # | File | Notes |
| - | --- | --- |
| 5 | `requirements/reviews/<JIRA-ID>-ac-review.md` | Nine-section human-readable Gate 1 review package |
| 6 | `requirements/reviews/<JIRA-ID>-ac-approval.template.json` | Fillable approval template |
| 7 | `traceability/capabilities/<capability>.rtm.proposed.json` | Proposed RTM rows (isolated, not yet merged) |

## 🔒 Gate 1 — AC_APPROVAL (human)

| # | File | Notes |
| - | --- | --- |
| 8 | `requirements/approved/<JIRA-ID>-ac-approval.json` | **Human-authored approval artifact.** This is the actual Gate 1 approval evidence. |
| 9 | `requirements/approved/<JIRA-ID>.json` | Approved requirements artifact promoted by the orchestrator's controlled merge |

---

## Stage 5 — OPENSPEC_GENERATION

Agent: **OpenSpec** (via `openspec-propose` skill). Only approved ACs from step 8/9 may be used.

| # | File | Notes |
| - | --- | --- |
| 10 | `openspec/changes/<change-name>/proposal.md` | Why / what / impact |
| 11 | `openspec/changes/<change-name>/tasks.md` | Implementation checklist |
| 12 | `openspec/changes/<change-name>/design.md` | Technical design (when warranted) |
| 13 | `openspec/changes/<change-name>/.openspec.yaml` | Change metadata |
| 14 | `openspec/changes/<change-name>/specs/<capability>/spec.md` | Delta spec — business behaviour only, no selectors/code |

## Stage 6 — TEST_PLAN_GENERATION

Agent: **sdd-workflow-orchestrator** (invoking Playwright Test Planner)

| # | File | Notes |
| - | --- | --- |
| 15 | `test-plans/generated/<TEST-PLAN-ID>.json` | Business test plan (e.g. `TP-ETA-351-001.json`) |
| 16 | `test-plans/generated/<TEST-PLAN-ID>-review.md` | Gate 2 human-readable review package |
| 17 | `test-plans/generated/<TEST-PLAN-ID>-approval.template.json` | Fillable Gate 2 approval template |

## 🔒 Gate 2 — TEST_PLAN_APPROVAL (human)

| # | File | Notes |
| - | --- | --- |
| 18 | `test-plans/approved/<TEST-PLAN-ID>-approval.json` | **Human-authored approval artifact.** |
| 19 | `test-plans/approved/<TEST-PLAN-ID>.json` | Approved test plan promoted by controlled merge |

---

## Stage 7 — BDD_DESIGN

Agent: **sdd-workflow-orchestrator** (invoking Playwright Test Generator)

| # | File | Notes |
| - | --- | --- |
| 20 | `features/generated/<capability>/<feature>.feature` | Gherkin scenarios tagged `@release-/@capability-/@req-/@ac-/@tp-/@ts-`; business behaviour only |
| 21 | `features/generated/<capability>/<TEST-PLAN-ID>-automation-design.md` | Automation design notes (locators marked `MCP_VALIDATION_REQUIRED`) |

## Stage 8 — AUTOMATION_REVIEW_PACKAGE

| # | File | Notes |
| - | --- | --- |
| — | `features/generated/<capability>/<TEST-PLAN-ID>-automation-design.md` (finalized) | Same file completed for review; no new file |
| 22 | `features/generated/<capability>/<TEST-PLAN-ID>-automation-approval.template.json` | Fillable Gate 3 approval template |

## 🔒 Gate 3 — AUTOMATION_APPROVAL (human)

| # | File | Notes |
| - | --- | --- |
| 23 | `features/approved/<capability>/<TEST-PLAN-ID>-automation-approval.json` | **Human-authored approval artifact.** |
| 24 | `features/approved/<capability>/<feature>.feature` | Approved feature file promoted by controlled merge — the only feature file `bddgen` may read |

---

## Stage 9 — PLAYWRIGHT_VALIDATION

Agent: **playwright-test-planner** (via Playwright MCP, browser-driven). Replaces
`MCP_VALIDATION_REQUIRED` placeholders with real, validated locators.

| # | File | Notes |
| - | --- | --- |
| 25 | `reports/validation/<TEST-PLAN-ID>-browser-validation.json` | Evidence that scenarios were explored/validated against the live app |
| 26 | `specs/**` (probe scripts / exploration artifacts as needed) | e.g. `scripts/eta-351-login-probe.ts` style one-off probes, `reports/validation/<JIRA-ID>-*-probe.json` outputs |

## Stage 10 — IMPLEMENTATION

Agent: **sdd-workflow-orchestrator** (invoking Playwright Test Generator)

| # | File | Notes |
| - | --- | --- |
| 27 | `steps/<capability-topic>.steps.ts` | Thin step orchestration — no locators, no hard-coded data |
| 28 | `src/pages/<page-name>.page.ts` | Page objects — own all locators (`getByRole` → `getByLabel` → `getByPlaceholder` → `getByText` → `getByTestId`) |
| 29 | `src/components/<component-name>.component.ts` | Shared UI components (when needed) |
| 30 | `src/fixtures/test.ts` | Playwright-BDD fixture wiring (created once, extended per capability) |
| 31 | `src/services/<capability>.service.ts` | Business/service helpers used by steps (e.g. `organization-login.service.ts`) |
| 32 | `test-data/<capability>.sample.json` | Fabricated `SAMPLE_DATA` inputs for negative/edge scenarios — never the real account |

## Stage 11 — BDD_GENERATION

Command: `npm run bdd` (`bddgen`)

| # | File | Notes |
| - | --- | --- |
| 33 | `.features-gen/**` | Generated executable specs. **Never hand-edited** — regenerated every run. |

## Stage 12 — EXECUTION

Command: `npm test` (`bddgen && playwright test`)

| # | File | Notes |
| - | --- | --- |
| 34 | `reports/playwright-report/**` | HTML/JSON Playwright run report |
| 35 | `reports/execution/results.json` | Raw execution results consumed by triage |
| 36 | `traceability/executions/EXEC-<JIRA-ID>-<nnn>.json` | Governed execution record (real pass/fail, never fabricated) |
| — | `reports/coverage/**` (if `COVERAGE_ENABLED=true`) | Browser V8 code coverage — informational only, never merged into traceability |

### If all scenarios pass → skip to Stage 15 (RTM_UPDATE)

### If any scenario fails → Stage 13 (FAILURE_TRIAGE)

---

## Stage 13 — FAILURE_TRIAGE (only on failure)

Command: `npm run triage:failures`. Agent: **bug-analyzer**.

| # | File | Notes |
| - | --- | --- |
| 37 | `defects/<DEF-ID>.json` | Governed defect report, classification `LOCATOR_SUSPECT` / `APPLICATION_DEFECT` / `AMBIGUOUS` / `ENVIRONMENT_BLOCKER` |
| 38 | `reports/defects/<DEF-ID>/**` | Preserved evidence copied out of `test-results/` (screenshots, `trace.zip`) before the next run overwrites it |
| 39 | `reports/validation/failure-triage.json` | Triage summary |

`ENVIRONMENT_BLOCKER` halts the workflow here — never healed, never filed.

## Stage 14a — LOCATOR_HEALING (when locator-suspect/ambiguous)

Agent: **governed-locator-healer**, capped at 2 attempts.

| # | File | Notes |
| - | --- | --- |
| — | `src/pages/<page-name>.page.ts` (edited) | Only locators/waits may change — no new file |
| — | `src/components/<component-name>.component.ts` (edited) | Same constraint |
| — | `defects/<DEF-ID>.json` (updated) | Outcome recorded: `HEALED` or `NOT_HEALED` |

If healed → back to Stage 12 re-run → Stage 15. If not healed after 2 attempts → Stage 14b.

## Stage 14b — BUG_REPORTING (application defect, or locator healing exhausted)

Agent: **bug-analyzer** (via Atlassian MCP). No fourth approval gate — compensating controls
(fingerprint de-duplication, mandatory reviewer assignment) apply instead.

| # | File | Notes |
| - | --- | --- |
| — | `defects/<DEF-ID>.json` (updated) | Jira bug key/link recorded; `REPORTED` or `DUPLICATE` |
| — | `traceability/capabilities/<capability>.rtm.proposed.json` | Proposed `defectRefs` update (orchestrator merges it) |

---

## Stage 15 — RTM_UPDATE

Agent: **sdd-workflow-orchestrator**

| # | File | Notes |
| - | --- | --- |
| 40 | `traceability/capabilities/<capability>.rtm.json` | Capability-partitioned Requirements Traceability Matrix (created/merged, never monolithic) |
| 41 | `traceability/capabilities/<capability>.coverage.json` | Coverage matrix — `null` when denominator is zero, never fabricated 0%/100% |
| 42 | `traceability/index/lookup.index.json` | Cross-capability lookup index so nothing is scanned linearly |
| 43 | `workflow/history/<workflowId>.history.jsonl` | Append-only workflow history log |
| — | `workflow/instances/WF-<JIRA-ID>-R<release>.json` (updated to `COMPLETED`) | Final state transition — no new file |

## Stage 16 — COMPLETED

No files created. The story's automation is now approved, executed, traced and (if applicable)
release-baselined in `traceability/releases/<release>.baseline.json`.

---

## Summary — sequential file list (happy path, no failures)

```text
 1  workflow/instances/WF-<JIRA-ID>-R<release>.json
 2  reports/jira/<JIRA-ID>.jira.json                                   (REST fallback only)
 3  requirements/raw/<JIRA-ID>.json
 4  requirements/normalized/<JIRA-ID>.json
 5  requirements/reviews/<JIRA-ID>-ac-review.md
 6  requirements/reviews/<JIRA-ID>-ac-approval.template.json
 7  traceability/capabilities/<capability>.rtm.proposed.json
 8  requirements/approved/<JIRA-ID>-ac-approval.json                   🔒 GATE 1
 9  requirements/approved/<JIRA-ID>.json
10  openspec/changes/<change-name>/proposal.md
11  openspec/changes/<change-name>/tasks.md
12  openspec/changes/<change-name>/design.md
13  openspec/changes/<change-name>/.openspec.yaml
14  openspec/changes/<change-name>/specs/<capability>/spec.md
15  test-plans/generated/<TEST-PLAN-ID>.json
16  test-plans/generated/<TEST-PLAN-ID>-review.md
17  test-plans/generated/<TEST-PLAN-ID>-approval.template.json
18  test-plans/approved/<TEST-PLAN-ID>-approval.json                   🔒 GATE 2
19  test-plans/approved/<TEST-PLAN-ID>.json
20  features/generated/<capability>/<feature>.feature
21  features/generated/<capability>/<TEST-PLAN-ID>-automation-design.md
22  features/generated/<capability>/<TEST-PLAN-ID>-automation-approval.template.json
23  features/approved/<capability>/<TEST-PLAN-ID>-automation-approval.json  🔒 GATE 3
24  features/approved/<capability>/<feature>.feature
25  reports/validation/<TEST-PLAN-ID>-browser-validation.json
26  specs/** (probe/exploration artifacts)
27  steps/<capability-topic>.steps.ts
28  src/pages/<page-name>.page.ts
29  src/components/<component-name>.component.ts   (if needed)
30  src/fixtures/test.ts
31  src/services/<capability>.service.ts
32  test-data/<capability>.sample.json
33  .features-gen/**                                (generated, npm run bdd)
34  reports/playwright-report/**                    (npm test)
35  reports/execution/results.json
36  traceability/executions/EXEC-<JIRA-ID>-<nnn>.json
40  traceability/capabilities/<capability>.rtm.json
41  traceability/capabilities/<capability>.coverage.json
42  traceability/index/lookup.index.json
43  workflow/history/<workflowId>.history.jsonl
```

Steps 37–39 (`FAILURE_TRIAGE`) and the healing/bug-reporting branches only occur when
`EXECUTION` reports a failing scenario; they are inserted between steps 36 and 40.

---

## Reference examples in this repository

| Artifact | Real file |
| --- | --- |
| Requirement | [requirements/approved/ETA-351.json](../requirements/approved/ETA-351.json) |
| Gate 1 approval | [requirements/approved/ETA-351-ac-approval.json](../requirements/approved/ETA-351-ac-approval.json) |
| Review package | [requirements/reviews/ETA-351-ac-review.md](../requirements/reviews/ETA-351-ac-review.md) |
| OpenSpec change | [openspec/changes/add-organization-login/proposal.md](../openspec/changes/add-organization-login/proposal.md) |
| Test plan | [test-plans/approved/TP-ETA-351-001.json](../test-plans/approved/TP-ETA-351-001.json) |
| Gate 2 approval | [test-plans/approved/TP-ETA-351-001-approval.json](../test-plans/approved/TP-ETA-351-001-approval.json) |
| Automation design | [features/generated/account-access/TP-ETA-351-001-automation-design.md](../features/generated/account-access/TP-ETA-351-001-automation-design.md) |
| Approved feature | [features/approved/account-access/organization-sign-in.feature](../features/approved/account-access/organization-sign-in.feature) |
| RTM + coverage | [traceability/capabilities/account-access.rtm.json](../traceability/capabilities/account-access.rtm.json) |
| Execution record | [traceability/executions/EXEC-ETA-351-001.json](../traceability/executions/EXEC-ETA-351-001.json) |
| Workflow state | [workflow/instances/WF-ETA-351-R1.0.json](../workflow/instances/WF-ETA-351-R1.0.json) |
