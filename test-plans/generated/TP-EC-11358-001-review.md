# Approval Gate 2 — Test Plan Review — TP-EC-11358-001 v1

| | |
| --- | --- |
| Test plan | `TP-EC-11358-001`, artifactVersion 1 |
| Story | EC-11358 — Phase 2_13: Add new section to Document Activity History Report delineating the control history |
| Release / capability | 26.3 / document-activity-history |
| Source | [requirements/approved/EC-11358.json](../../requirements/approved/EC-11358.json) v2, approved at Gate 1 by Nitin Saini (Senior QA) |
| Scenarios | 8, covering all 6 approved acceptance criteria |
| Decision needed | APPROVE / REJECT / DEFER / REQUEST_CHANGES, overall and per scenario |

## 1. What this plan covers

Six acceptance criteria were approved at Gate 1 (`APR-AC-EC-11358-001`), with four ambiguities
resolved by you. This plan turns them into eight scenarios:

- A transferred financial asset shows a consolidated **Control History table** (`AC-001`).
- Each row records the **transfer date, Transfer From org and Transfer To org** — structural
  presence only (`AC-002`).
- A document with **no confirmed transfer shows no table** (`AC-003`).
- Multiple transfers are **ordered newest to oldest** (`AC-004`).
- The table appears in the **UI view and the two report APIs** (`AC-005`).
- **Document type** decides whether the table is produced — Financial Asset and Financial Asset
  Addendum yes, Supplemental Doc no (`AC-006`).

Every scenario is traced to exactly one acceptance criterion, and every criterion is covered by at
least one scenario.

## 2. Scenario-by-scenario

| Scenario | Criterion | Type | Interface | Decision | Suite |
| --- | --- | --- | --- | --- | --- |
| TS-EC-11358-001 — transferred financial asset shows the Control History table | AC-001 | POSITIVE | UI | AUTOMATE | smoke |
| TS-EC-11358-002 — each row shows date + both orgs (presence only) | AC-002 | POSITIVE | UI | AUTOMATE | regression |
| TS-EC-11358-003 — no confirmed transfer → no table | AC-003 | NEGATIVE | UI | AUTOMATE | regression |
| TS-EC-11358-004 — multiple transfers ordered newest to oldest | AC-004 | POSITIVE | UI | AUTOMATE | regression |
| TS-EC-11358-005 — table appears in the UI view | AC-005 | POSITIVE | UI | AUTOMATE | smoke |
| TS-EC-11358-006 — table appears via `eoRequestExport` report API | AC-005 | POSITIVE | **API** | **REVIEW_REQUIRED** | regression |
| TS-EC-11358-007 — table appears via `eoGetDocumentActivityHistoryReport` report API | AC-005 | POSITIVE | **API** | **REVIEW_REQUIRED** | regression |
| TS-EC-11358-008 — document type decides whether the table is produced | AC-006 | POSITIVE | UI | AUTOMATE | regression |

`AC-005` is covered by three scenarios: one authoritative UI-view scenario plus the two report-API
scenarios that depend on a contract you must agree at this gate (see section 4).

## 3. What these scenarios deliberately do not assert

Your Gate 1 resolutions keep this plan intentionally narrower than the story's full verification
matrix. None of the following is asserted:

| Left abstract / excluded | Because |
| --- | --- |
| Exact column-header labels, table heading text, date/time format | `AMB-EC-11358-003` resolved to **structural presence only**. EC-13271 tracks a separate date-format defect |
| The UI download, Certified Print package, Paper Out and retention-copy surfaces | `AMB-EC-11358-002` scoped automation this release to the **UI view + two report APIs**. These four stay manual (see `CLR-TP-EC-11358-002`) |
| The contract for the two report APIs | Endpoints, request shapes, field names and status codes are **UNVERIFIED**. They are captured from live traffic at PLAYWRIGHT_VALIDATION and must be converted to `HUMAN_APPROVED` here before any assertion |
| Producing the transfer workflow itself | The Confirmed Transfer of Control precondition is established as **test data** per `AMB-EC-11358-001`, not exercised as behaviour |

Expected results are written at the level of abstraction the resolutions allow. Observation at the
next stage may reveal *how* the application meets a criterion; it must never quietly become *what*
the criterion requires.

## 4. Open questions

Two items need your decision at this gate; both are recorded as clarifications in the plan.

**`CLR-TP-EC-11358-001` — the two report-API contracts (the decision this gate exists for).**
`TS-EC-11358-006` and `TS-EC-11358-007` target `eoRequestExport` and
`eoGetDocumentActivityHistoryReport`. These are **declared but never exercised** endpoints
(`UNVERIFIED` per [reports/validation/ecore-api-discovery.json](../../reports/validation/ecore-api-discovery.json)),
and eCore's `.eo` AJAX surface is **form-encoded, not JSON**. No contract has been authored — no
endpoint, field name or status code was guessed. Approving these two scenarios means agreeing that
the contracts will be **captured from live traffic** at PLAYWRIGHT_VALIDATION and **converted from
`OBSERVED` to `HUMAN_APPROVED`** as part of your approval. Until that conversion, an `OBSERVED`
contract describes only what the application *does*, so neither scenario may assert `AC-005`; both
stay `REVIEW_REQUIRED`. If you prefer, mark them `DEFER` or `REQUEST_CHANGES` and `AC-005` is covered
by the UI-view scenario alone this release.

**`CLR-TP-EC-11358-002` — four manual surfaces.**
The UI download, Certified Print package, Paper Out and retention copy are verified in the story but
excluded from automation this release, per `AMB-EC-11358-002`. Do you accept manual-only treatment,
or require any of them automated now?

## 5. Risks

- **`RISK-TP-EC-11358-001` (HIGH)** — asserting `AC-005` against observed API traffic would freeze
  current behaviour as correct. Mitigated by keeping the two API scenarios `REVIEW_REQUIRED` until a
  `HUMAN_APPROVED` contract exists.
- **`RISK-TP-EC-11358-002` (HIGH)** — the Confirmed Transfer of Control precondition is
  non-deterministic; a scenario that cannot reach it is recorded `BLOCKED`, never passed.
- **`RISK-TP-EC-11358-003` (MEDIUM)** — label/format left unasserted to avoid hardening against a
  possibly-defective value (EC-13271).
- **`RISK-TP-EC-11358-004` (LOW)** — four surfaces excluded from automation leave a documented manual
  gap against `REQ-EC-11358-005`.
- **`RISK-TP-EC-11358-005` (MEDIUM)** — qa host access may be unavailable; affected scenarios are
  recorded `BLOCKED`.

## 6. How to record your decision

Copy [test-plans/generated/TP-EC-11358-001-approval.template.json](TP-EC-11358-001-approval.template.json)
to `test-plans/approved/TP-EC-11358-001-approval.json`, replace the placeholders, and save. Only
scenarios carrying an item-level `APPROVE` flow into automation; anything else is recorded in the RTM
with its decision and is not built. If you approve `TS-EC-11358-006` and `TS-EC-11358-007`, your
approval also authorises capturing and `HUMAN_APPROVED`-converting their two contracts.

A message in chat is not an approval. The artifact on disk is.
