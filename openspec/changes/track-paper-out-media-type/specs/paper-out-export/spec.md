## Purpose

Lets a user or an API integrator declare whether a Paper Out/Export package is intended to remain
paper or be kept as an electronic file, and ensures that declared intent - not the submission
mechanism - drives what Media Type is recorded and shown on the package cover page, audit trail, and
downloaded activity history reports.

## ADDED Requirements

### Requirement: Media Type selection on the Paper Out Request modal
The Paper Out Request modal, at both transaction and document level, SHALL present a "Media Type for
Paper Out Package" section with two mutually exclusive options: "Print to Paper" (selected by default)
and "Save as Electronic File". This applies identically whether Paper Out is initiated directly or via
Collections (Collections accordion > Batch > Paper Out Request).

#### Scenario: Media Type section renders with Print to Paper selected by default
- **WHEN** a user opens the Paper Out Request modal, at either transaction or document level
- **THEN** a "Media Type for Paper Out Package" section is shown with "Print to Paper" and "Save as
  Electronic File" options, and "Print to Paper" is selected by default

### Requirement: Acknowledgement modal for Save as Electronic File
When a user selects "Save as Electronic File", completes the Paper Out Request modal's required
fields ("Name of Request:" and "Approver:"), and clicks OK, the system SHALL open an acknowledgement
modal whose own OK button is disabled until an unchecked-by-default checkbox is checked. Confirming the
acknowledgement modal SHALL close both modals and create the Work Queue approval item. Cancelling the
acknowledgement modal SHALL close only that modal, leave the Paper Out Request modal open, and create
no Work Queue item.

#### Scenario: Acknowledgement modal opens with its OK button gated on a checkbox
- **WHEN** the user selects "Save as Electronic File", completes the required fields, and clicks OK
- **THEN** an acknowledgement modal opens with an unchecked checkbox, and its OK button stays disabled
  until the checkbox is checked

#### Scenario: Confirming the acknowledgement modal completes the submission
- **WHEN** the acknowledgement modal's checkbox is checked and the user clicks its OK button
- **THEN** the acknowledgement modal closes, the Paper Out Request modal closes, and a Work Queue item
  is created for approval

#### Scenario: Cancelling the acknowledgement modal preserves the in-progress request
- **WHEN** the user clicks Cancel on the acknowledgement modal
- **THEN** only the acknowledgement modal closes, the Paper Out Request modal remains open, and no
  Work Queue item is created

### Requirement: Optional mediaType element on eoRequestExport
The eoRequestExport request contract (export.xsd) SHALL accept an optional `mediaType` element with
exactly two valid values, `PrintToPaper` and `SaveAsElectronicFile`. Omitting the element SHALL leave
request acceptance unchanged from current behavior, so existing integrators are unaffected.

#### Scenario: Request without mediaType is accepted unchanged
- **WHEN** an integrator calls eoRequestExport without a mediaType element
- **THEN** the request is accepted exactly as it was before this change

#### Scenario: Only the two defined mediaType values are valid
- **WHEN** an integrator calls eoRequestExport with a mediaType element
- **THEN** only `PrintToPaper` or `SaveAsElectronicFile` are accepted as valid values

### Requirement: Media Type determination logic
The system SHALL determine a Paper Out/Export package's Media Type as "Paper" when the UI selects
"Print to Paper" or the API passes `mediaType=PrintToPaper`, and as "Electronic" when the UI selects
"Save as Electronic File", the API passes `mediaType=SaveAsElectronicFile`, or the API omits
`mediaType` entirely. This determination SHALL apply identically at transaction level and document
level.

#### Scenario: UI Print to Paper at transaction level determines Paper
- **WHEN** a transaction-level Paper Out is submitted via the UI with "Print to Paper" selected
- **THEN** the Media Type is recorded as "Paper"

#### Scenario: UI Print to Paper at document level determines Paper
- **WHEN** a document-level Paper Out is submitted via the UI with "Print to Paper" selected
- **THEN** the Media Type is recorded as "Paper"

#### Scenario: UI Save as Electronic File at transaction level determines Electronic
- **WHEN** a transaction-level Paper Out is submitted via the UI with "Save as Electronic File"
  selected
- **THEN** the Media Type is recorded as "Electronic"

#### Scenario: UI Save as Electronic File at document level determines Electronic
- **WHEN** a document-level Paper Out is submitted via the UI with "Save as Electronic File" selected
- **THEN** the Media Type is recorded as "Electronic"

#### Scenario: API mediaType=PrintToPaper at transaction level determines Paper
- **WHEN** eoRequestExport is called at the transaction level with mediaType=PrintToPaper
- **THEN** the Media Type is recorded as "Paper"

#### Scenario: API mediaType=PrintToPaper at document level determines Paper
- **WHEN** eoRequestExport is called at the document level with mediaType=PrintToPaper
- **THEN** the Media Type is recorded as "Paper"

#### Scenario: API mediaType=SaveAsElectronicFile at transaction level determines Electronic
- **WHEN** eoRequestExport is called at the transaction level with mediaType=SaveAsElectronicFile
- **THEN** the Media Type is recorded as "Electronic"

#### Scenario: API mediaType=SaveAsElectronicFile at document level determines Electronic
- **WHEN** eoRequestExport is called at the document level with mediaType=SaveAsElectronicFile
- **THEN** the Media Type is recorded as "Electronic"

#### Scenario: API call omitting mediaType determines Electronic
- **WHEN** eoRequestExport is called, at transaction or document level, with no mediaType element
  passed
- **THEN** the Media Type is recorded as "Electronic"

### Requirement: Media Type logging on the Submitted Paper Out event
Media Type SHALL be logged as Additional Information on the "Submitted Paper Out" event, not the
"Authorized Paper Out" event, and SHALL be visible on the package cover page and in the audit trail, in
both the UI and downloaded activity history reports, for transaction and/or document level as
applicable. Transactions and documents processed before this change ships SHALL NOT be retroactively
updated with Media Type information.

#### Scenario: Media Type appears on the Submitted Paper Out event
- **WHEN** a Paper Out is submitted, at transaction or document level, after this change ships
- **THEN** Media Type appears as Additional Information on the Submitted Paper Out event (not on
  Authorized Paper Out), and is visible on the package cover page and in the audit trail in both the
  UI and downloaded activity history reports

#### Scenario: Historical records are not retroactively updated
- **WHEN** this enhancement is deployed
- **THEN** a transaction or document that had Paper Out/Export performed before deployment is not
  retroactively updated with Media Type information

### Requirement: Verify Paper Out checkbox verbiage
The Verify Paper Out modal's last checkbox SHALL read "Verify the downloaded package has been
successfully printed to paper or saved to a secure location".

#### Scenario: Updated checkbox verbiage is displayed
- **WHEN** the user views the Verify Paper Out modal's last checkbox
- **THEN** its label reads "Verify the downloaded package has been successfully printed to paper or
  saved to a secure location"

### Requirement: Paper Out Request modal layout alignment
The Paper Out Request modal's right-side section borders SHALL be visually aligned after the new
Media Type section is added.

#### Scenario: Right-side section borders are aligned
- **WHEN** the user views the right side of the redesigned Paper Out Request modal, including the new
  Media Type section
- **THEN** the section borders are visually aligned rather than misaligned or overlapping
