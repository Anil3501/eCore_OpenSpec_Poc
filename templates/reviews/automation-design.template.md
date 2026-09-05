# Approval Gate 3 — Automation Design Review — REPLACE_WITH_TEST_PLAN_ID

**Story:** REPLACE_WITH_JIRA_ID — REPLACE_WITH_SUMMARY
**Capability:** `REPLACE_WITH_CAPABILITY` · **Release:** REPLACE_WITH_RELEASE
**Approved plan:** REPLACE_WITH_PATH_TO_THE_APPROVED_PLAN · **Plan version:** REPLACE_WITH_VERSION

> Fill every section. A section with nothing to say should say "None."

---

## What you are being asked to approve

REPLACE_WITH_ONE_SHORT_PARAGRAPH: how many Gherkin scenarios, which feature files, and the fact that
the feature files stay in `features/generated/` until this gate is recorded.

Approving this authorises the framework to implement and run these tests. It binds to plan version
REPLACE_WITH_VERSION.

## Scenario-by-scenario design

For each scenario: the Gherkin, the acceptance criterion it covers, its interface, and the page
objects, components or API clients it needs.

**REPLACE_WITH_TS_ID — REPLACE_WITH_TITLE** (covers REPLACE_WITH_AC_ID, REPLACE_WITH_INTERFACE)

```gherkin
REPLACE_WITH_THE_SCENARIO_EXACTLY_AS_IT_WILL_BE_WRITTEN
```

Needs: REPLACE_WITH_PAGE_OBJECTS_COMPONENTS_STEPS_OR_API_CLIENTS.

Feature files describe business behaviour only — no selectors and no page-object method names. Every
scenario carries `@release-`, `@capability-`, `@req-`, `@ac-`, `@tp-` and `@ts-` tags.

## Locators and contracts

| Element or endpoint | Locator or contract | Status |
| --- | --- | --- |
| REPLACE_WITH_ELEMENT | REPLACE_WITH_LOCATOR | REPLACE_WITH_VALIDATED_OR_MCP_VALIDATION_REQUIRED |

List every locator still marked `MCP_VALIDATION_REQUIRED` and every contract still marked
`API_CONTRACT_UNVERIFIED`. Also list every locator that will need a `VALIDATED -` waiver and every
wait that will need `JUSTIFIED-WAIT:`, with the reason a preferred accessible locator was not
available.

An `OBSERVED` contract may seed a scenario into a state; only `HUMAN_APPROVED` or `OPENAPI` may judge
an acceptance criterion.

## Open questions

**REPLACE_WITH_QUESTION_ID** — REPLACE_WITH_THE_QUESTION and what changes depending on the answer.

Anything an agent would otherwise have to invent — a role, a message, a limit, a policy — belongs
here rather than in the design.

## What this automation deliberately does not assert

- REPLACE_WITH_EACH_THING_A_READER_MIGHT_ASSUME_IS_COVERED_BUT_IS_NOT.

## Risks

| ID | Level | Risk |
| --- | --- | --- |
| REPLACE_WITH_RISK_ID | REPLACE_WITH_LEVEL | REPLACE_WITH_DESCRIPTION |

## How to record your decision

A chat message is not an approval. Only a schema-valid artifact on disk counts.

1. Copy `REPLACE_WITH_PATH_TO_APPROVAL_TEMPLATE` to
   `features/approved/REPLACE_WITH_CAPABILITY/REPLACE_WITH_TEST_PLAN_ID-automation-approval.json`.
2. Set `decision`, and one entry in `itemDecisions` per scenario.
3. Fill in `reviewer.name`, `reviewer.role` and `reviewedAt` (ISO 8601, UTC).
4. Answer every question in **Open questions** in `comments`.
5. Run `npm run validate:artifacts`.

Once the approval artifact is on disk, the orchestrator moves the feature files into
`features/approved/REPLACE_WITH_CAPABILITY/` and proceeds. A file still carrying
`MCP_VALIDATION_REQUIRED` fails the build once it backs approved automation.
