# Gate 1 review — EC-11358 acceptance criteria

**Story:** EC-11358 — Phase 2_13: Add new section to Document Activity History Report delineating the control history
**Capability:** `document-activity-history` · **Release:** 26.3
**Artifact:** requirements/normalized/EC-11358.json · **Version:** 1

> Fill every section. Delete nothing. A section with nothing to say should say so explicitly —
> "none" is information; a missing heading is an unanswered question.

---

## What you are being asked to approve

Six requirements and six acceptance criteria, all **extracted verbatim from Jira** (the story
description plus authoritative Product Owner comments and the final "Product Approved" summary) —
**none are proposed by analysis**. Approving this gate authorises the **next stage only**
(OpenSpec change generation and, after it, test-plan generation); it does not authorise or produce
any tests. Four ambiguities are raised, all concerned with *how to test* rather than *what the rule
is*; none invent a business rule, and all are `REVIEW_REQUIRED`.

## Requirements

| ID | Requirement | Source | Status |
| --- | --- | --- | --- |
| REQ-EC-11358-001 | The report includes a new Control History table consolidating all of a document's transfers (chain of control for a financial asset). | EXTRACTED_FROM_JIRA | PENDING_APPROVAL |
| REQ-EC-11358-002 | Each Control History row records the transfer date, Transfer From org and Transfer To org. | EXTRACTED_FROM_JIRA | PENDING_APPROVAL |
| REQ-EC-11358-003 | The table is compiled from Confirmed Transfer of Control events; no such event means no table. | EXTRACTED_FROM_JIRA | PENDING_APPROVAL |
| REQ-EC-11358-004 | Entries are sorted newest to oldest; oldest Transferred From = original controller. | EXTRACTED_FROM_JIRA | PENDING_APPROVAL |
| REQ-EC-11358-005 | The table appears across every report surface: UI view, UI download, Certified Print, Paper Out, retention copy, and the report APIs. | EXTRACTED_FROM_JIRA | PENDING_APPROVAL |
| REQ-EC-11358-006 | Financial Asset and Financial Asset Addendum get the table; Supplemental Doc (no doc-level transfer events) does not. | EXTRACTED_FROM_JIRA | PENDING_APPROVAL |

REQ-EC-11358-005 is only **partly testable inside this framework today**: the UI surfaces are
reachable, but the two report APIs (`eoRequestExport`, `eoGetDocumentActivityHistoryReport`) have no
verified contract (see `reports/validation/ecore-api-discovery.json`) and cannot be asserted until a
contract is `HUMAN_APPROVED` at Gate 2. See AMB-EC-11358-002.

## Acceptance criteria

| ID | Requirement | Criterion | Source | Status |
| --- | --- | --- | --- | --- |
| AC-EC-11358-001 | REQ-EC-11358-001 | A financial asset doc with ≥1 Confirmed Transfer of Control event shows a Control History table consolidating its transfers. | EXTRACTED_FROM_JIRA | PENDING_APPROVAL |
| AC-EC-11358-002 | REQ-EC-11358-002 | Every row shows transfer date, Transfer From org and Transfer To org. | EXTRACTED_FROM_JIRA | PENDING_APPROVAL |
| AC-EC-11358-003 | REQ-EC-11358-003 | A doc with no Confirmed Transfer of Control event shows no table. | EXTRACTED_FROM_JIRA | PENDING_APPROVAL |
| AC-EC-11358-004 | REQ-EC-11358-004 | With multiple events, entries are ordered newest to oldest. | EXTRACTED_FROM_JIRA | PENDING_APPROVAL |
| AC-EC-11358-005 | REQ-EC-11358-005 | The table appears in each surface: UI view, UI download, Certified Print, Paper Out, retention copy, report APIs. | EXTRACTED_FROM_JIRA | PENDING_APPROVAL |
| AC-EC-11358-006 | REQ-EC-11358-006 | Financial Asset / Addendum show the table; Supplemental Doc shows none. | EXTRACTED_FROM_JIRA | PENDING_APPROVAL |

No criterion is `PROPOSED_BY_REQUIREMENT_ANALYSIS`, so no analyst rationale is required — every
criterion is backed by verbatim `originalText` in the normalized artifact.

## Ambiguities

| ID | Question | Impact | Status |
| --- | --- | --- | --- |
| AMB-EC-11358-001 | How does automation deterministically create/obtain a Confirmed Transfer of Control precondition (seeded doc vs per-run transfer flow)? | AC-001/-002/-004/-005/-006 executable vs MANUAL_ONLY. | REVIEW_REQUIRED |
| AMB-EC-11358-002 | Which report surfaces are in scope for automation this release (UI only vs UI+download+print+paper-out+API)? | interfaceType and coverage scope of AC-005. | REVIEW_REQUIRED |
| AMB-EC-11358-003 | Exact column-header labels, table heading text and expected date/time format? | Structural vs exact-label/format assertions on AC-002. | REVIEW_REQUIRED |
| AMB-EC-11358-004 | Which org account/credentials and target document should the test use to view a transferred document? | Environment access for AC-001; scenario may be BLOCKED. | REVIEW_REQUIRED |

**All four ambiguities block confident automation of the transfer-dependent scenarios, but they do
not block this gate.** They are decisions about test-data provisioning, scope and environment — not
missing business rules — so the acceptance criteria themselves can be approved now, with the
ambiguities carried into Gate 2 (test planning) where interfaceType and scope are decided. An answer
given in chat is not recorded until it appears in the approval artifact with a named person in
`resolvedBy`.

## Coverage this produces — please read before approving

If every approved criterion later passes, the following is still **not** proven:

- **API surfaces of AC-EC-11358-005** — `eoRequestExport` and `eoGetDocumentActivityHistoryReport`
  have no `HUMAN_APPROVED` contract yet, so any coverage claimed for them until Gate 2 approves a
  contract is UI-only. This requirement will report **PARTIAL** if only the UI view is automated.
- **Exact labels and date/time format (AC-EC-11358-002)** — until AMB-EC-11358-003 is answered,
  scenarios can assert the presence of the three columns but not their literal header text or format.
- **Transfer-dependent scenarios (AC-001/-004/-006)** — remain unproven and may be `MANUAL_ONLY` or
  `BLOCKED` until AMB-EC-11358-001 and -004 give a deterministic precondition and org access.

A green run on the UI happy path does **not** equal full coverage of this story. The percentage that
Gate 2/RTM will report should be read alongside these named gaps.

## How to approve

A chat message is not an approval. Only a schema-valid artifact on disk counts.

1. Copy `requirements/reviews/EC-11358-ac-approval.template.json` to
   `requirements/approved/EC-11358-ac-approval.json`.
2. Set `decision`, and one entry in `itemDecisions` per acceptance criterion.
3. Fill in `reviewer.name`, `reviewer.role` and `reviewedAt` (ISO 8601, UTC).
4. Answer every question raised above in `comments` (especially the four ambiguities).
5. Run `npm run validate:artifacts`.

`artifactVersion` must match the artifact you reviewed (version 1). If the normalized artifact
changes afterwards the version moves and this approval no longer binds — that is deliberate.
