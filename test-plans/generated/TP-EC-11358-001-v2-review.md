# Approval Gate 2 - Test Plan Review - TP-EC-11358-001 v2

## 1. Why this version exists

Corrected QA5 evidence retracts the previous application-mismatch conclusion. View History triggers
two AJAX calls; the earlier probe captured `viewDocumentHistory.eo` but missed
`getControllerHistory.eo`. Transaction 16809591 / document 16809592 now validates the UI Control
History table and downloaded `AuditTrail-16809592.pdf` evidence.

Artifact v1 nevertheless cannot proceed. It labels TS-EC-11358-006 and TS-EC-11358-007
`HUMAN_APPROVED` without an approvable success-response contract or mandatory `responseShapeHash`.
The supplied API account now authenticates successfully. `eoRequestExport` has an observed batch
metadata response from existing framework evidence, while an authenticated action-only call to
`eoGetDocumentActivityHistoryReport` returns `UNDEFINED_REQUEST_PARAMETER`. Neither result defines
the successful report contract needed to assert Control History. `npm run validate:artifacts`
therefore continues to fail `SEM-API-CONTRACT` for both historical v1 scenarios.

## 2. What this plan covers

The plan still covers all six approved acceptance criteria through eight scenarios. Six UI
scenarios are unchanged. This revision changes only the governance status of the two unobserved API
scenarios and records corrected UI/report validation evidence:

| Surface | Evidence | Result |
| --- | --- | --- |
| UI View History | `POST /ssweb/setup/workspace/container/ajax/getControllerHistory.eo`, status 200 | `Control History`; headers Date / Transferred From / Transferred To; one row |
| Downloaded report | `AuditTrail-16809592.pdf` | Distinct heading `Controller History`; same row |
| Transfer precondition | UI history and PDF | Confirmed Transfer of Control from SJTestOrganization to NSOrganization |
| `eoRequestExport` | Existing OPENAPI request and OBSERVED success evidence; hash `194374ce9509b4caf989a2fbac6b437c8d1d558c0491c09340495d92fa222041` | Immediate response is batch metadata, not a history report; TS-006 assertion design unresolved |
| `eoGetDocumentActivityHistoryReport` | Authenticated raw SOAP `POST /ecore/`; hash `516bbd4036a66d8e095d1a3fa52959ac4f43542757fd1c2fafe6a40fdd12ea10` | HTTP 200 `status=ok` acknowledgment contains no report or Control History content |

The observed `getControllerHistory.eo` call supports the UI scenario only. It is not silently
substituted for either approved report API.

## 3. Scenario-by-scenario

| Scenario | Interface | Proposed v2 decision | Reason |
| --- | --- | --- | --- |
| TS-EC-11358-001 | UI | APPROVE | Corrected QA5 evidence validates the table |
| TS-EC-11358-002 | UI | APPROVE | Corrected QA5 evidence validates the three-column row |
| TS-EC-11358-003 | UI | APPROVE | Unchanged; governed execution still required |
| TS-EC-11358-004 | UI | APPROVE | Unchanged; multi-transfer test data still required |
| TS-EC-11358-005 | UI | APPROVE | Corrected QA5 evidence validates on-screen output |
| TS-EC-11358-006 | HYBRID | DEFER | Observed response contains batch metadata, not Control History; package verification requires a safe existing Authorized/Verification fixture, and NSOrg has none |
| TS-EC-11358-007 | HYBRID | DEFER | Request and acknowledgment are observed, but the response has status only and no generated-report retrieval route is known |
| TS-EC-11358-008 | UI | APPROVE | Unchanged; three document-type candidates still required |

## 4. Open questions

The six UI scenarios remain unchanged. On 2026-09-17, Nitin Saini accepted the recommendation to
defer TS-EC-11358-006 and TS-EC-11358-007 for this release. The final Gate 2 evidence is
`test-plans/approved/TP-EC-11358-001-v2-final-approval.json`. AC-EC-11358-005 retains authoritative
UI coverage through TS-EC-11358-005. The following gaps remain traceable for later work:

1. **TS-EC-11358-006:** an existing Authorized/Verification batch id and name tied to document
   16809592. Retrieval is validated as Work Queue -> Print -> Verify Paper Out modal -> document
   package download. The automation will not select Verify. The NSOrg queue contained zero rows in
   the read-only 2026-09-17 probe, so no safe fixture currently exists for this account.
2. **TS-EC-11358-007:** the authoritative retrieval route after the successful API call. The HTTP
   response downloads `api.xml`, contains only `status=ok`, has no Location header, and contains no
   report identifier or report content.

Neither API scenario is approved for execution. Their probes and response hashes remain technical
evidence only and do not count as acceptance-criterion coverage.

The canonical approved plan advances to artifactVersion 2. Prior approval artifacts remain on disk
as historical evidence of the original approval and subsequent REQUEST_CHANGES decision.

## 5. What these scenarios deliberately do not assert

- No UI scenario asserts exact heading text or date formatting; Gate 1 approved structural presence.
- No API scenario asserts a response field or marker while its response shape is unobserved.
- The observed `getControllerHistory.eo` response is not treated as either report API contract.
- UI download, Certified Print, Paper Out, and retention copy remain manual-only as previously approved.

## 6. Risks

- Approving TS-EC-11358-006 or TS-EC-11358-007 without a reviewed shape and hash would make an
   unobserved contract authoritative and leave drift undetectable.
- Deferring both API scenarios leaves an explicit API coverage gap for AC-EC-11358-005; the UI
   scenario continues to cover the criterion's UI surface.
- Remaining UI scenarios still depend on multi-transfer, negative, and document-type test data not
   established by this corrected positive observation.
- The supplied `eoGetDocumentActivityHistoryReport` SOAP request succeeds against QA5, but its
   response is an acknowledgment only. It does not expose the generated report payload.
- A read-only NSOrg Work Queue probe found zero batch rows and zero Authorized/Verification items;
   the historical `PROBE-TS003-CHECK` fixture belongs to earlier environment evidence and is not
   assumed accessible to this account.

## 7. How to record your decision

This revision changes no acceptance criterion, expected business behavior, UI scenario, OpenSpec
requirement, or approved locator. It corrects only the governance state of the two unobserved API
contracts. The prior decision that UI download, Certified Print, Paper Out, and retention copy stay
manual-only remains resolved and unchanged.

The decision is recorded in
`test-plans/approved/TP-EC-11358-001-v2-final-approval.json` as `APR-TP-EC-11358-003`.