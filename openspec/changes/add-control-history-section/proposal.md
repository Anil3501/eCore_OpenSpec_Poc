## Why

When a financial asset document is transferred between organizations, eCore's Document Activity
History Report retains every auditable transfer event, but those events are scattered through the
history and the chain of control cannot be read at a glance. EC-11358 introduces a consolidated
Control History table so the chain of control for a financial asset is visible in one place. Six
acceptance criteria were approved at Gate 1 (`APR-AC-EC-11358-001`), and none of them is currently
specified, so there is no agreed statement of what the report must show.

This change captures that approved behaviour as a specification, so the test plan and automation that
follow are derived from a spec rather than from a prose Jira description.

## What Changes

- Introduce a specification for the Control History section of the Document Activity History Report,
  covering the six approved acceptance criteria `AC-EC-11358-001` through `AC-EC-11358-006`.
- Specify that a document with at least one Confirmed Transfer of Control event shows a Control
  History table that consolidates that document's transfers.
- Specify that each Control History row records the transfer date, the Transfer From organization and
  the Transfer To organization.
- Specify that a document with no Confirmed Transfer of Control event shows no Control History table.
- Specify that, when a document has multiple Confirmed Transfer of Control events, entries are
  ordered newest to oldest.
- Specify that the Control History table appears in every surface that renders the report — the UI
  view, the UI download, the Certified Print package, Paper Out, a retention copy, and the report
  APIs (`eoRequestExport`, `eoGetDocumentActivityHistoryReport`).
- Specify that document types that log transfer events at the document level (Financial Asset,
  Financial Asset Addendum) show the table, while a Supplemental Doc shows none.

No breaking change. This is a new capability with no existing spec to modify.

### Deliberately not specified

The following are **not** in this change, in line with the Gate 1 ambiguity resolutions. Specifying
them here would either invent a business rule or encode a mechanism the specification layer must not
carry:

- Exact rendered column-header labels, the table heading text and the date/time format. Per the
  resolution of `AMB-EC-11358-003`, scenarios assert only the structural presence of the table and
  its three columns (transfer date, Transfer From org, Transfer To org); exact labels and format are
  deferred.
- The API contract for `eoRequestExport` and `eoGetDocumentActivityHistoryReport`. Per the resolution
  of `AMB-EC-11358-002`, the table's *appearance* in those surfaces is in scope as behaviour, but the
  endpoints, request shapes, field names and status codes are unverified and must be captured from
  live traffic and converted from `OBSERVED` to `HUMAN_APPROVED` at Gate 2 before any acceptance
  criterion is asserted against them. No contract is authored in this spec.
- The mechanism for establishing the Confirmed Transfer of Control precondition and the concrete
  organization accounts and documents used to exercise it. Per the resolutions of `AMB-EC-11358-001`
  and `AMB-EC-11358-004`, test data and org/credential selection are settled during test planning
  (Gate 2) and Playwright validation, not in the specification.

## Capabilities

### New Capabilities
- `document-activity-history/control-history`: The Control History section of the Document Activity
  History Report — when the consolidated transfer table is shown, what each row records, how entries
  are ordered, which document types produce it, and the surfaces it must appear in.

### Modified Capabilities
<!-- None. No existing spec under openspec/specs/ changes. -->

## Impact

- **Traceability**: `traceability/capabilities/document-activity-history.rtm.json` gains
  `openSpecRefs` linking each of the six acceptance criteria to its specification requirement.
- **Downstream stages**: this spec becomes an input to `TEST_PLAN_GENERATION` (Gate 2) and, after
  approval, to BDD design and automation. `AC-EC-11358-005` carries the report-API surfaces, whose
  contracts remain unverified until Gate 2.
