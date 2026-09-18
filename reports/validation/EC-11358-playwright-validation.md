# PLAYWRIGHT_VALIDATION - TP-EC-11358-001 - Control History section

**Story:** EC-11358 - Phase 2_13: Add new section to Document Activity History Report delineating the control history
**Capability:** `document-activity-history` | **Release:** 26.3 | **Plan version:** 1
**Stage:** PLAYWRIGHT_VALIDATION | **Outcome:** **PARTIAL PASS; GATE 2 REVIEW REQUIRED**
**Evidence captured:** 2026-09-17T09:02:33.976Z

Evidence source: authenticated read-only scripted Playwright fallback
([scripts/ec-11358-workspace-scan.ts](../../scripts/ec-11358-workspace-scan.ts) ->
[reports/validation/EC-11358-workspace-scan.json](EC-11358-workspace-scan.json)). The probe
authenticated with the user's QA5 account and inspected transaction 16809591 / document 16809592.
The script typechecks. It invoked no transaction-mutating `.eo` verb, changed no approved
expectation, and retained no credential or anti-CSRF token value.

## Verified positive precondition

Transaction **16809591** / document **16809592** satisfies the approved transfer precondition:

- The transaction snapshot returned 200 and records `Transferred From SJTestOrganization` and a
  transfer date.
- The View History action issued two AJAX requests. `viewDocumentHistory.eo` returned the main
  history content and `getControllerHistory.eo` returned 200 with `Control History`, one table,
  headers `Date`, `Transferred From`, `Transferred To`, and one row recording `09/16/2026
  08:36:10 AM EDT`, `SJTestOrganization`, and `NSOrganization`.
- Parsed `AuditTrail-16809592.pdf` contains `Confirmed Transfer of Control from
  SJTestOrganization to NSOrganization`, plus Accepted Transfer of Control and Initiated Transfer
  of Control events.
- Parsed `AuditTrail-16809592.pdf` uses the distinct heading `Controller History` and contains the
  same date/from/to row. Both the UI history and PDF contain Confirmed Transfer of Control evidence.

The earlier mismatch conclusion is retracted. The first probe captured
`viewDocumentHistory.eo` but missed the second AJAX response from `getControllerHistory.eo`.
The corrected observation validates the positive UI/report evidence for TS-EC-11358-001,
TS-EC-11358-002 and TS-EC-11358-005. It does not amend an approved expectation and is not a
governed execution result.

## Remaining validation items

| Item | Status after this observation |
| --- | --- |
| Positive QA5 precondition | **VERIFIED** - transaction 16809591 / document 16809592 |
| UI Control History table | **VERIFIED** - `getControllerHistory.eo` returned 200, three headers and one row |
| Downloaded report | **VERIFIED** - `AuditTrail-16809592.pdf` contains `Controller History` and the same row |
| Control History locator evidence | **OBSERVED** - response structure recorded; implementation remains gated by the API-plan correction |
| `eoRequestExport` request/response shape | Remains `API_CONTRACT_UNVERIFIED`; the approved API surface was not observed |
| `eoGetDocumentActivityHistoryReport` request/response shape | Remains `API_CONTRACT_UNVERIFIED`; the approved API surface was not observed |
| Q-EC-11358-001 (concrete documents + org per precondition) | **PARTIALLY RESOLVED** for one positive QA5 financial asset; multi-transfer and document-type candidates remain unverified |
| Q-EC-11358-002 (live report-API shapes + Control-History marker) | **UNRESOLVED** because neither approved report API was captured |

No approved expectation or API contract was altered. `getControllerHistory.eo` is recorded as an
observed UI-supporting call only; it is not substituted for either approved report API. No defect or
Jira issue was created because no failed governed execution has occurred.

## Gate 2 decision required

The approved v1 plan marks TS-EC-11358-006 and TS-EC-11358-007 `HUMAN_APPROVED`, but neither
`eoRequestExport` nor `eoGetDocumentActivityHistoryReport` was observed and neither contract has a
reviewable response shape or `responseShapeHash`. Review proposed plan v2 and choose one governed
outcome: **DEFER both API scenarios** while keeping the UI scenario as AC-EC-11358-005 coverage, or
**REQUEST_CHANGES** and provide/capture each live request and response shape so a shape hash can be
computed and explicitly approved. Approval without one of those decisions would repeat the invalid
v1 contract state.
