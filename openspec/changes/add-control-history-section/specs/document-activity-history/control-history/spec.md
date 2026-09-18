## Purpose

The Control History section of the eCore Document Activity History Report: when a consolidated table
of a financial asset's transfers of control is shown, what each row records, how the entries are
ordered, which document types produce the table, and which report surfaces it must appear in.

## ADDED Requirements

### Requirement: A transferred financial asset shows a consolidated Control History table
When a financial asset document has at least one Confirmed Transfer of Control event, its Document
Activity History Report SHALL display a Control History table that consolidates that document's
transfers into a single table.

Traces: `AC-EC-11358-001` (`REQ-EC-11358-001`). The precondition of a Confirmed Transfer of Control
event and the accounts used to view it are settled at planning — see `AMB-EC-11358-001` and
`AMB-EC-11358-004`.

#### Scenario: A document with a confirmed transfer shows the table
- **WHEN** a financial asset document that has at least one Confirmed Transfer of Control event has
  its Document Activity History Report viewed
- **THEN** a Control History table is displayed that consolidates the document's transfers

### Requirement: Each Control History row records the transfer and its two organizations
Each row of the Control History table SHALL record the date of the transfer, the Transfer From
organization and the Transfer To organization.

Traces: `AC-EC-11358-002` (`REQ-EC-11358-002`). Exact column-header labels and date/time format are
not asserted — see `AMB-EC-11358-003`.

#### Scenario: Each row shows the date and both organizations
- **WHEN** a document whose Document Activity History Report shows a Control History table has that
  table read
- **THEN** each row shows the transfer date, the Transfer From organization and the Transfer To
  organization

### Requirement: The table is absent without a confirmed transfer
When a document has no Confirmed Transfer of Control event, its Document Activity History Report
SHALL NOT display a Control History table.

Traces: `AC-EC-11358-003` (`REQ-EC-11358-003`).

#### Scenario: A document with no confirmed transfer shows no table
- **WHEN** a document that has no Confirmed Transfer of Control event has its Document Activity
  History Report viewed
- **THEN** no Control History table is displayed

### Requirement: Multiple transfers are ordered newest to oldest
When a document has more than one Confirmed Transfer of Control event, the Control History entries
SHALL be ordered from newest to oldest, so the oldest Transferred From entry represents the original
controller.

Traces: `AC-EC-11358-004` (`REQ-EC-11358-004`).

#### Scenario: Entries are ordered newest to oldest
- **WHEN** a document with more than one Confirmed Transfer of Control event has its Control History
  table displayed
- **THEN** the entries are ordered newest to oldest

### Requirement: The table appears in every surface that renders the report
When a document's Document Activity History Report contains a Control History table, that table
SHALL appear in every surface that renders the report: the UI view, the UI download, the Certified
Print package, Paper Out, a retention copy, and the report APIs (`eoRequestExport`,
`eoGetDocumentActivityHistoryReport`).

Traces: `AC-EC-11358-005` (`REQ-EC-11358-005`). The report-API contracts are unverified and must be
confirmed at Gate 2 before any assertion is made against them — see `AMB-EC-11358-002`.

#### Scenario: The table appears in each rendering surface
- **WHEN** the Document Activity History Report of a document whose report contains a Control History
  table is produced through a given surface — the UI view, the UI download, the Certified Print
  package, Paper Out, a retention copy, or a report API
- **THEN** the Control History table appears in that surface's output

### Requirement: Only document types that log transfers at the document level produce the table
A document type that logs transfer events at the document level (Financial Asset, Financial Asset
Addendum) SHALL produce a Control History table when it has transfers, while a document type that
does not log transfer events at the document level (Supplemental Doc) SHALL NOT produce one.

Traces: `AC-EC-11358-006` (`REQ-EC-11358-006`).

#### Scenario: Document type determines whether the table is produced
- **WHEN** a Financial Asset or Financial Asset Addendum with transfers, and a Supplemental Doc, each
  have their Document Activity History Report viewed
- **THEN** the Financial Asset and Financial Asset Addendum show a Control History table
- **AND** the Supplemental Doc shows none
