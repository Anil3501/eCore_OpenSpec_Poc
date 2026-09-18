# Training Curriculum Review — "OpenSpec & AI-Driven Delivery: Business Stakeholder Training"

Review of the attached curriculum against what the `eCore_OpenSpec_POC` framework actually
implements ([README.md](../README.md), [AGENTS.md](../AGENTS.md), `.github/agents/`,
`.github/skills/`). The deck is well-structured pedagogically; the gaps below are places where it
describes a more generic/idealized process than what this POC actually does.

## 1. Module 2 & Section 4 — core flow is in the wrong order

Curriculum: *Business Requirement → Specification → Acceptance Criteria → Implementation → Test
Cases → Automated Tests → Validation.*

Actual order: Jira retrieval → normalize requirement → **Gate 1 (Acceptance Criteria approval)** →
OpenSpec change/specification → Test Plan → **Gate 2 (Test Plan approval)** → BDD/Automation design
→ **Gate 3 (Automation Design approval)** → Playwright MCP validation → implementation → execution
→ traceability (RTM) → OpenSpec archive.

Acceptance criteria are approved **before** the specification is created, not after. Fix the
Section 4 diagram and Module 2 bullet to match.

## 2. Module 9 — the three gates are misnamed

Curriculum lists: *Specification Gate, Acceptance Criteria Gate, Execution/Automation Gate.*

Actual three gates:

| Gate | Reviews | Approval artifact |
| --- | --- | --- |
| 1 — Acceptance Criteria | extracted/proposed ACs, ambiguities | `requirements/approved/<STORY>-ac-approval.json` |
| 2 — Test Plan | business scenario coverage | `test-plans/approved/<TP-ID>-approval.json` |
| 3 — Automation Design | feature files, locator strategy | `features/approved/<capability>/<TP-ID>-automation-approval.json` |

There is **no formal "Specification Gate"** — the OpenSpec change is CLI-driven, not a governed
JSON-approval gate — and **no "Execution Gate"**: execution runs automatically after Gate 3 +
MCP validation; a failure instead routes to triage/healing/bug-filing (a human-confirmation control
point, not a formal gate). Rename the three gates and distinguish "gate" (blocks the workflow) from
"control point" (e.g., human must confirm a bug before it is filed).

## 3. Module 5 (Agents) & Module 6 (Skills) — wrong inventory, includes a non-existent "migration analysis"

Actual agents: `sdd-workflow-orchestrator`, `jira-requirement-analysis`, `OpenSpec` (tool-provided),
`playwright-test-planner`, `playwright-test-generator`, `playwright-test-healer`,
`governed-locator-healer`, `bug-analyzer`.

Actual skills: `openspec-explore`, `openspec-propose`, `openspec-update-change`,
`openspec-sync-specs`, `openspec-apply-change`, `openspec-archive-change`, `playwright-mcp-validate`,
`blocker-escalation-note`.

Replace the generic "migration analysis" example with these real names so the Module 11 demo can
show them running.

## 4. Module 10 — "Migration Using OpenSpec" describes an unbuilt capability

The only real "migration" reference in the repo is the parent Jira epic's charter — *migration of
eCore application test scenarios from legacy automation into the Playwright/TypeScript framework*
— i.e. migrating **legacy test automation**, not a generic "existing application → OpenSpec
migration" pipeline. There is no migration agent, skill, or workflow stage, and no
"compare results to legacy system" tooling exists today.

Reframe Module 10 around what's real (replacing legacy test automation with governed, traceable
Playwright-BDD tests), or explicitly label the generic flow as **aspirational / not yet implemented
in this POC**.

## 5. Module 11 (Demo) — suggested scenario doesn't exist in the repo

Replace the fictional "download a customer report PDF" scenario with the real, already-completed
story `ETA-351` (capability `account-access`): `requirements/approved/ETA-351.json` →
`features/approved/account-access/organization-sign-in.feature` →
`traceability/capabilities/account-access.rtm.json`. It has a full 3-gate history and a real
executed run to show live instead of authoring something from scratch.

## 6. Missing entirely: defect/bug-filing governance

Module 12 doesn't mention `bug-analyzer`, `defects/DEF-*.json` artifacts, or the rule that a bug can
only be filed after a human explicitly confirms it in chat. Add one bullet to Module 9 or 12 — it
directly supports the Module 8 trainer note that automation doesn't remove quality oversight.

## 7. Terminology gaps worth adding for accuracy

- **`AMB-*` ambiguity artifacts** — answers the Module 12 FAQ "what happens with ambiguous
  requirements?", which currently has no grounded answer.
- **`MCP_VALIDATION_REQUIRED`** — generated locators stay unverified until validated live against
  the app via Playwright MCP; a concrete "AI doesn't get the final say" example for Module 7/8.
- **Test Plan vs. Automation Design are two separate governed artifacts**, not one "test case"
  step as Module 8 implies — Gate 2 approves business scenarios, Gate 3 separately approves the
  automation/locator design built from them.

## Summary of required edits

| Section | Issue | Action |
| --- | --- | --- |
| Module 2 / Section 4 flow diagram | Spec before AC (wrong order) | Reorder to AC → Spec |
| Module 9 | Wrong gate names | Rename to AC / Test Plan / Automation Design |
| Module 5, 6 | Invented "migration analysis" agent/skill | Replace with real agent/skill list |
| Module 10 | Describes unbuilt generic migration capability | Reframe around legacy-test-automation migration, or mark aspirational |
| Module 11 | Fictional demo scenario | Swap in real `ETA-351` walkthrough |
| Module 12 FAQs | No defect-filing governance, no grounded ambiguity answer | Add `bug-analyzer`/`DEF-*` note and `AMB-*` explanation |
