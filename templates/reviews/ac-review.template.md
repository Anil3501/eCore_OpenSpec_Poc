# Gate 1 review — REPLACE_WITH_JIRA_ID acceptance criteria

**Story:** REPLACE_WITH_JIRA_ID — REPLACE_WITH_SUMMARY
**Capability:** `REPLACE_WITH_CAPABILITY` · **Release:** REPLACE_WITH_RELEASE
**Artifact:** REPLACE_WITH_PATH_TO_NORMALIZED_REQUIREMENT · **Version:** REPLACE_WITH_VERSION

> Fill every section. Delete nothing. A section with nothing to say should say so explicitly —
> "none" is information; a missing heading is an unanswered question.

---

## What you are being asked to approve

REPLACE_WITH_ONE_SHORT_PARAGRAPH: how many requirements, how many criteria, how many are proposed by
analysis rather than taken from Jira, and what approving actually authorises (the next stage, not the
tests).

## Requirements

| ID | Requirement | Source | Status |
| --- | --- | --- | --- |
| REPLACE_WITH_REQ_ID | REPLACE_WITH_DESCRIPTION | REPLACE_WITH_SOURCE_TYPE | REPLACE_WITH_STATUS |

REPLACE_WITH_A_NOTE_ON_ANY_REQUIREMENT_THAT_IS_ONLY_PARTLY_TESTABLE_AND_WHY.

## Acceptance criteria

| ID | Requirement | Criterion | Source | Status |
| --- | --- | --- | --- | --- |
| REPLACE_WITH_AC_ID | REPLACE_WITH_REQ_ID | REPLACE_WITH_DESCRIPTION | REPLACE_WITH_SOURCE_TYPE | REPLACE_WITH_STATUS |

For every criterion marked `PROPOSED_BY_REQUIREMENT_ANALYSIS`, state the rationale here. A proposed
criterion with no rationale is an invented requirement wearing a criterion's clothes.

REPLACE_WITH_RATIONALE_PER_PROPOSED_CRITERION.

## Ambiguities

| ID | Question | Impact | Status |
| --- | --- | --- | --- |
| REPLACE_WITH_AMB_ID | REPLACE_WITH_QUESTION | REPLACE_WITH_IMPACT | REPLACE_WITH_STATUS |

REPLACE_WITH_A_STATEMENT_OF_WHICH_AMBIGUITIES_BLOCK_THE_NEXT_STAGE_AND_WHICH_DO_NOT. If there are
none, say "None." An answer given in chat is not recorded until it appears in this artifact with a
named person in `resolvedBy`.

## Coverage this produces — please read before approving

REPLACE_WITH_AN_HONEST_STATEMENT_OF_WHAT_IS_STILL_NOT_PROVEN_IF_EVERY_APPROVED_CRITERION_PASSES.
Name each requirement that will report as PARTIAL and the deferred criterion that carries the
uncovered half. This section exists so a coverage percentage is never mistaken for completeness.

## How to approve

A chat message is not an approval. Only a schema-valid artifact on disk counts.

1. Copy `REPLACE_WITH_PATH_TO_APPROVAL_TEMPLATE` to
   `requirements/approved/REPLACE_WITH_JIRA_ID-ac-approval.json`.
2. Set `decision`, and one entry in `itemDecisions` per acceptance criterion.
3. Fill in `reviewer.name`, `reviewer.role` and `reviewedAt` (ISO 8601, UTC).
4. Answer every question raised above in `comments`.
5. Run `npm run validate:artifacts`.

`artifactVersion` must match the artifact you reviewed. If the artifact changes afterwards the
version moves and this approval no longer binds — that is deliberate.
