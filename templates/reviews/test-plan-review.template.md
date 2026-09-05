# Approval Gate 2 — Test Plan Review — REPLACE_WITH_TEST_PLAN_ID vREPLACE_WITH_VERSION

**Story:** REPLACE_WITH_JIRA_ID — REPLACE_WITH_SUMMARY
**Capability:** `REPLACE_WITH_CAPABILITY` · **Release:** REPLACE_WITH_RELEASE
**Plan:** REPLACE_WITH_PATH_TO_THE_PLAN · **Status:** PENDING_TEST_PLAN_APPROVAL

REPLACE_WITH_ONE_LINE_SUMMARY: how many scenarios, how many positive and negative, and whether
anything in the plan changes application data.

Approving this plan authorises the framework to design automation against it. It does **not**
authorise the automation itself — that is Gate 3.

> Fill every section. A section with nothing to say should say "None."

---

## What this plan covers, and what it deliberately leaves uncovered

| Requirement | Covered by | Status after this plan |
| --- | --- | --- |
| REPLACE_WITH_REQ_ID | REPLACE_WITH_AC_AND_SCENARIO_IDS | REPLACE_WITH_COVERED_OR_PARTIAL_OR_UNCOVERED |

REPLACE_WITH_A_PLAIN_STATEMENT_OF_WHAT_IS_STILL_UNPROVEN_IF_THIS_PLAN_RUNS_GREEN. Every DEFERRED
acceptance criterion must be mapped to no scenario at all — that omission is what makes the RTM
report its requirement as partial rather than met.

## Scenario-by-scenario

| ID | Scenario | Type | AC | Suite | Interface |
| --- | --- | --- | --- | --- | --- |
| REPLACE_WITH_TS_ID | REPLACE_WITH_TITLE | REPLACE_WITH_TYPE | REPLACE_WITH_AC_ID | REPLACE_WITH_SUITE | REPLACE_WITH_INTERFACE |

REPLACE_WITH_AN_EXPLANATION_OF_ANY_NON_OBVIOUS_STRUCTURAL_CHOICE — why two scenarios were split
rather than merged, or why one acceptance criterion maps to several scenarios.

## Open questions

Every testing judgement the story does not state belongs here, phrased as a question with the
evidence behind it. Settling one silently is how an agent's opinion becomes a requirement.

**REPLACE_WITH_CLARIFICATION_ID** — REPLACE_WITH_THE_QUESTION, the evidence, and what changes
depending on the answer.

Interface declarations are always one of these questions: whether an acceptance criterion is
API-verifiable is a testing judgement, never something the story states.

## What these scenarios deliberately do not assert

- REPLACE_WITH_EACH_THING_A_READER_MIGHT_ASSUME_IS_COVERED_BUT_IS_NOT.
- Any message string that has not been approved at this gate. An `OBSERVED` string records what the
  application does today, not what it should do; asserting it would make a current bug the
  definition of correct.

## Risks

| ID | Level | Risk |
| --- | --- | --- |
| REPLACE_WITH_RISK_ID | REPLACE_WITH_LEVEL | REPLACE_WITH_DESCRIPTION |

REPLACE_WITH_ANY_TEST_ACCOUNT_SAFETY_NOTE — for example whether any scenario submits a wrong
credential and could contribute to a lockout.

## How to record your decision

A chat message is not an approval. Only a schema-valid artifact on disk counts.

1. Copy `REPLACE_WITH_PATH_TO_APPROVAL_TEMPLATE` to
   `test-plans/approved/REPLACE_WITH_TEST_PLAN_ID-approval.json`.
2. Set `decision`, and one entry in `itemDecisions` per scenario.
3. Fill in `reviewer.name`, `reviewer.role` and `reviewedAt` (ISO 8601, UTC).
4. Answer every question in **Open questions** in `comments`.
5. Run `npm run validate:artifacts`.

`artifactVersion` in the approval must match the plan. If the plan changes after you approve it, the
version moves and the approval no longer binds — that is deliberate.

Once the approval artifact is on disk, the orchestrator promotes the plan to
`test-plans/approved/REPLACE_WITH_TEST_PLAN_ID.json` and proceeds to BDD_DESIGN.
