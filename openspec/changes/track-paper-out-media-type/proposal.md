## Why

Today, Media Type on a Paper Out/Export package cover page and audit trail is inferred purely from the
mechanism used to submit the request: UI submission always logs "Paper", API submission always logs
"Electronic". This does not reflect the user's actual intent - a UI user may intend to keep the package
digitally, and an API integrator has no way to say it intends paper. EC-12000 lets the requester (UI or
API) declare the intended Media Type explicitly, records it at the point the user commits to it, and
surfaces it consistently across the cover page, audit trail, and downloaded activity history reports.

## What Changes

- Add a "Media Type for Paper Out Package" section to the Paper Out Request modal (transaction and
  document level) with two radio buttons: "Print to Paper" (default) and "Save as Electronic File".
- Add a new acknowledgement modal shown when "Save as Electronic File" is selected and the modal's
  required fields ("Name of Request:" and "Approver:") are complete and OK is clicked. Its own OK
  button is gated on an unchecked-by-default checkbox; Cancel always closes only the acknowledgement
  modal, leaving the Paper Out Request modal open with no Work Queue item created.
- Confirming the acknowledgement modal closes both modals and creates the Work Queue approval item.
- Add an optional `mediaType` element (`PrintToPaper` | `SaveAsElectronicFile`) to the `eoRequestExport`
  request schema (`export.xsd`). Optional so that integrators who omit it are unaffected.
- Media Type determination logic, applied uniformly at transaction and document level:
  - `Paper` when the UI selects "Print to Paper", or the API passes `mediaType=PrintToPaper`.
  - `Electronic` when the UI selects "Save as Electronic File", the API passes
    `mediaType=SaveAsElectronicFile`, or the API omits `mediaType` entirely (preserves current
    behavior for callers that never adopt the new element).
- Move where Media Type is logged as Additional Information: from the "Authorized Paper Out" event to
  the "Submitted Paper Out" event (the point where the requester actually declares intent). Existing
  transactions/documents processed before this change are not retroactively updated.
- Update the Verify Paper Out modal's last checkbox label to
  "Verify the downloaded package has been successfully printed to paper or saved to a secure location".
- Clean up and align the Paper Out Request modal's right-side section borders as part of adding the new
  section.
- Collections-initiated Paper Out reuses this same modal and logic (Collections accordion > Batch >
  Paper Out Request), rather than a separate flow.

## Capabilities

### New Capabilities
- `paper-out-export`: UI and API (`eoRequestExport`) capture of the user's/integrator's intended Media
  Type for a Paper Out/Export package, the determination logic that derives Paper vs. Electronic from
  that intent, and where/how that Media Type is surfaced (cover page, audit trail, activity history
  reports).

### Modified Capabilities
_None._ No existing `openspec/specs/**` capability changes requirements as part of this story; the
Paper Out/Export capability being introduced does not currently have a spec in this repository.

## Impact

- **UI**: Paper Out Request modal (new section, new acknowledgement modal, border alignment), Verify
  Paper Out modal (checkbox label).
- **API**: `eoRequestExport` request contract / `export.xsd` (new optional `mediaType` element). No
  authoritative contract for `eoRequestExport` exists yet in this framework's API-surface inventory
  (`reports/validation/ecore-api-discovery.json`); per AGENTS.md this must be captured as `OBSERVED` via
  Playwright MCP at `PLAYWRIGHT_VALIDATION` and promoted to `HUMAN_APPROVED` only by a human reviewer
  before any API-facing acceptance criterion can be judged (AMB-EC-12000-002, resolved to this effect).
- **Audit trail / activity history**: Additional Information event source moves from Authorized Paper
  Out to Submitted Paper Out, for both transaction- and document-level Paper Out.
- **Data**: No retroactive update of historical transactions/documents.
- **Traceability**: 7 requirements (REQ-EC-12000-001..007), 19 acceptance criteria
  (AC-EC-12000-001..019), all approved at Gate 1 (`requirements/approved/EC-12000-ac-approval.json`).
