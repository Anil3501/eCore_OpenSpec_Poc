# Approval Gate 3 — Automation Design Review — TP-EC-12000-001

**Story:** EC-12000 — Paper Out/Export Media Type capture and acknowledgement flow
**Capability:** `paper-out-export` · **Release:** 26.3
**Approved plan:** test-plans/approved/TP-EC-12000-001.json · **Plan version:** 1

> Draft written at BDD_DESIGN. Finalized (locators/contracts still to be filled in after
> PLAYWRIGHT_VALIDATION) at AUTOMATION_REVIEW_PACKAGE before Gate 3 is opened.

---

## What you are being asked to approve

17 Gherkin scenarios in one feature file,
`features/generated/paper-out-export/paper-out-media-type.feature`, covering AC-EC-12000-001
through -004, -007 through -019 (AC-EC-12000-005 and -006 are DEFERRED — no scenario exists for
them). Approving this authorises the framework to implement page objects, step definitions and
(where declared) the API client for these scenarios and to run them. The feature file stays in
`features/generated/` until this gate is recorded. This binds to plan version 1.

## Scenario-by-scenario design

**TS-EC-12000-001 — The Paper Out Request modal shows the Media Type section with Print to Paper selected by default** (covers AC-EC-12000-001, UI)

```gherkin
Scenario: The Paper Out Request modal shows the Media Type section with Print to Paper selected by default
  Given a user opens the Paper Out Request modal
  Then a Media Type for Paper Out Package section is shown
  And "Print to Paper" is selected by default
```

Needs: `PaperOutRequestModal` page object (open, media-type-section locator, radio-button state).

**TS-EC-12000-002 — Selecting Save as Electronic File opens a checkbox-gated acknowledgement modal** (covers AC-EC-12000-002, UI)

```gherkin
Scenario: Selecting Save as Electronic File and completing required fields opens a checkbox-gated acknowledgement modal
  Given the Paper Out Request modal is open
  When I select "Save as Electronic File"
  And I complete the required Name of Request and Approver fields
  And I click OK
  Then an acknowledgement modal opens with its checkbox unchecked
  And the acknowledgement modal's OK button stays disabled until the checkbox is checked
```

Needs: `PaperOutRequestModal` (radio selection, required-field inputs), `AcknowledgementModal`
component (checkbox, OK-button disabled state), `test-data/paper-out-export.sample.json` (fabricated
Name of Request / Approver values).

**TS-EC-12000-003 — Confirming the acknowledgement modal creates the Work Queue item** (covers AC-EC-12000-003, UI)

```gherkin
Scenario: Confirming the acknowledgement modal closes both modals and creates the Work Queue approval item
  Given the acknowledgement modal is open
  When I check the acknowledgement checkbox
  And I click the acknowledgement modal's OK button
  Then the acknowledgement modal closes
  And the Paper Out Request modal closes
  And a Work Queue item is created for approval
```

Needs: `AcknowledgementModal` component, `PaperOutRequestModal` (closed-state assertion), a
Work Queue page object or component to confirm item creation.

> **IMPLEMENTATION status (2026-09-14): implemented and passing live.** All locators validated;
> nothing remains `MCP_VALIDATION_REQUIRED`. The Work Queue item renders as
> `tr.batch[data-batch-name][data-batch-status="Submitted"][data-next-step="Approval"]`.
>
> `BLOCKER-EC-12000-001` is **resolved**. All eleven qa5 collections were surveyed by driving a
> real submission against each and cancelling every success; `test collection` qualified, so it is
> now `qualifiedFixtureCollectionName`. The earlier plan to add a document to `demo_Anil` would
> not have worked: a collection-level Paper Out covers *every* transaction in the collection, and
> `demo_Anil`'s only transaction is permanently locked by the Authorized batch TS-018 depends on.
>
> This scenario submits for real, and a submitted request locks every transaction it covers, so it
> carries a tagged `After` hook that cancels its own request. Without it the scenario would pass
> once and fail on every subsequent run. It was verified with `--repeat-each=2` rather than a
> single green run, because one pass cannot distinguish a working cleanup from an untested one.

**TS-EC-12000-004 — Cancelling the acknowledgement modal has no side effect** (covers AC-EC-12000-004, UI)

```gherkin
Scenario: Cancelling the acknowledgement modal leaves the Paper Out Request modal open with no Work Queue item created
  Given the acknowledgement modal is open
  When I click Cancel on the acknowledgement modal
  Then only the acknowledgement modal closes
  And the Paper Out Request modal remains open
  And no Work Queue item is created
```

Needs: same components as TS-003, negative assertion on Work Queue.

**TS-EC-12000-007 / -008 — UI Print to Paper determines Media Type Paper (transaction / document level)** (cover AC-EC-12000-007, -008, UI)

```gherkin
Scenario: UI Print to Paper at transaction level determines Media Type Paper
  Given a transaction eligible for Paper Out
  When I submit a transaction-level Paper Out via the UI with "Print to Paper" selected
  Then the Media Type is recorded as "Paper"
```

Needs: `PaperOutRequestModal`, a transaction/document fixture, an audit-trail or Additional
Information reader (shared with TS-016) to confirm the recorded Media Type.

> **IMPLEMENTATION status (2026-09-14): BLOCKED on `BLOCKER-EC-12000-004`, not on a fixture.**
> Two of the three unknowns cleared. The entry points are real and reachable: selecting a
> transaction row reveals `div.paperOutTransaction` inside
> `td#transactionNameActions .snapshot-dropdown-action`, and a document row (`tr.documentRow`)
> carries `div.paperOutDocument` in its own `.snapshot-dropdown-action`. The active-signature-path
> rule that disqualified three other collections does **not** bite here — a real transaction-level
> Paper Out with the default "Print to Paper" was submitted successfully against `test collection`
> transaction `16509517` and cancelled again.
>
> What remains blocked is the `Then`: there is nowhere to observe the recorded Media Type. See
> TS-EC-12000-016 below for the full evidence and the two questions a human must answer.

**TS-EC-12000-009 / -010 — UI Save as Electronic File determines Media Type Electronic (transaction / document level)** (cover AC-EC-12000-009, -010, UI)

```gherkin
Scenario: UI Save as Electronic File at transaction level determines Media Type Electronic
  Given a transaction eligible for Paper Out
  When I submit a transaction-level Paper Out via the UI with "Save as Electronic File" selected, completing the acknowledgement flow
  Then the Media Type is recorded as "Electronic"
```

Needs: `PaperOutRequestModal`, `AcknowledgementModal`, audit-trail reader.

> **IMPLEMENTATION status (2026-09-14): BLOCKED on `BLOCKER-EC-12000-004`**, for the same reason
> as TS-EC-12000-007/-008 above — the entry points and the submission both work, but the recorded
> Media Type cannot be observed anywhere.

**TS-EC-12000-011 through -015 — API mediaType values determine Media Type, confirmed via UI audit trail** (cover AC-EC-12000-011 through -015, HYBRID)

```gherkin
Scenario: API mediaType=PrintToPaper at transaction level determines Media Type Paper
  Given eoRequestExport is available at the transaction level
  When I call eoRequestExport at the transaction level with mediaType "PrintToPaper"
  And I open the transaction's Submitted Paper Out audit trail entry
  Then the API call succeeds
  And the Media Type is recorded as "Paper" in the audit trail's Additional Information
```

(TS-012 through -015 follow the same shape for document level, SaveAsElectronicFile, and the
mediaType-omitted case.)

Needs: an `EoRequestExportClient` in `src/api/` extending `ApiClient` (scaffolding only — see
below), the shared audit-trail reader. **The API step reaches a state; only the UI audit-trail
assertion may judge the acceptance criterion**, per each scenario's `apiContract.scaffoldingOnly:
true`.

> **REVISED at Gate 2 v3 (2026-09-15).** The test plan now carries a concrete, human-dictated
> `eoRequestExport` endpoint (`POST ${ecoreBaseUrl}/ecore/`, `multipart/form-data`, parts
> `action=eoRequestExport` and `instructionsXML`) — `contractSource: UNVERIFIED`,
> `contractProvenance: AGENT_DRAFTED` per `AGENTS.md` rule 4's drafting exception. It can never
> become `HUMAN_APPROVED` (no observed response body exists anywhere to compute a
> `responseShapeHash` from), so `scaffoldingOnly: true` remains permanent, not temporary — the
> API step sets state only, the UI audit trail keeps sole responsibility for the assertion.
>
> Three things `CLR-TP-EC-12000-004` left open at Gate 2 are now resolved and must be reflected in
> the `EoRequestExportClient` and step implementation:
> 1. **Endpoint acceptance** — automate against the dictated endpoint as-is; do not wait for
>    independent corroboration that will not arrive.
> 2. ~~**CLEANUP mechanism (confirmed live against qa5, 2026-09-15)** — after the audit-trail
>    assertion, clear the created Work Queue item via: click **Print** on the item, in the Verify
>    Paper Out modal select the select-all checkbox, click **Verify**, then confirm the alert
>    dialog. This is the same flow already documented (`MANUAL_ONLY`) for `TS-EC-12000-020`, not
>    `TS-EC-12000-003`'s Submit+Cancel pattern — do not conflate the two. This is a real,
>    irreversible action (Verify), so a `CLEANUP -` waiver comment is required above the client
>    call per the API-client layering rule.~~ **SUPERSEDED — see the v4 correction below.**
> 3. **Fixture selection** — do **not** hard-code a single Collection id. Each of TS-011 through
>    -015 must read the currently available Collections list at run time and select one
>    dynamically (observed live as `c1` through `c5` on 2026-09-15), rather than assuming a fixed
>    identifier — this avoids contention with the eight already-approved UI scenarios sharing the
>    same fixture pool.
>
> `EoRequestExportClient.submit()`'s request path, multipart body construction, and the
> `action`/`instructionsXML` parts remain `MCP_VALIDATION_REQUIRED` until confirmed live at
> `PLAYWRIGHT_VALIDATION` — the endpoint is dictated, not yet exercised by this framework.
>
> **CORRECTED at Gate 3 v4 (2026-09-16) — CLEANUP mechanism mismatch found during real
> `PLAYWRIGHT_VALIDATION`.** The v3 cleanup step above was never actually exercised before it was
> approved; it assumed the API-created batch would reach `Authorized`/`Verification` state. Live
> validation against qa5 on 2026-09-16 shows otherwise: calling the real, now-working
> `EoRequestExportClient.requestExport()` (fixed to include the required
> `xsi:schemaLocation` attribute — see the client's docblock) produces a batch that lands in the
> Work Queue as `data-batch-status="Submitted"`, `data-next-step="Approval"` — the **same** state
> `TS-EC-12000-003`'s UI-submitted batches reach, not `Authorized`. The v3 destructive Verify flow
> (permanently deletes source documents from the vault) does not apply to this state and must not
> be used.
>
> **Corrected CLEANUP mechanism for TS-EC-12000-011 through -015**: after the audit-trail
> assertion, cancel the created Work Queue item via the existing reversible flow already
> implemented in `WorkQueueComponent.cancelApprovalItem()` — hover the batch row, click the
> `.batch-dropdown-action` trigger, click `.cancelPaperOut`, then confirm **Cancel Request** in the
> "Confirm Cancellation" dialog. This is the same mechanism `TS-EC-12000-003` already uses; no new
> component method is needed. This action is reversible, so no `CLEANUP -` waiver comment is
> required above the client call (the waiver requirement applies to irreversible actions only).
> Confirmed live against qa5 on 2026-09-16: cancelling a real batch (`DEBUG-1789499020791`) via
> this flow returned the Work Queue to empty within ~8 seconds (status transitions
> `Submitted` → `Processing` → removed).
>
> Fixture selection (item 3 above) is unaffected by this correction and remains as approved.

**TS-EC-12000-016 — Media Type is recorded on the Submitted Paper Out event, not the Authorized one, and appears in the downloaded activity history report** (covers AC-EC-12000-016, UI)

```gherkin
Scenario: Media Type is recorded on the Submitted Paper Out event, not the Authorized one, and appears in the downloaded activity history report
  Given a Paper Out is submitted, at transaction or document level, after this change has shipped
  When I inspect the Submitted Paper Out event's Additional Information
  And I inspect the Authorized Paper Out event's Additional Information
  And I download the document activity history report and inspect it
  Then Media Type appears as Additional Information on the Submitted Paper Out event
  And Media Type is absent from the Authorized Paper Out event's Additional Information
  And Media Type is present in the downloaded document activity history report
```

Needs: `DocumentHistoryComponent` (already owns the Submitted-event reader used by TS-007 through
-010), a new Authorized-event reader on the same component, and a new
activity-history-report download/parse helper.

> **REVISED at Gate 2 v2 (2026-09-14).** The cover-page clause is removed from this scenario and
> now lives on TS-EC-12000-020 (CLR-TP-EC-12000-002 resolution: the cover page is a
> printed/downloaded package artifact that needs a human to open the real file, not a locator this
> framework can validate). This scenario keeps the two things that ARE observable through the
> browser: the Submitted event's Additional Information and the downloaded activity history report,
> plus a new Authorized-event absence check the plan added to make the "not the Authorized one"
> half of the acceptance criterion an actual assertion instead of an implication.
>
> **What is now unblocked, vs. what remains open:**
> - The Submitted-event Media Type read is **no longer blocked**. `BLOCKER-EC-12000-004` was
>   resolved live on 2026-09-14 (see `DocumentHistoryComponent`): Paper Out events log against the
>   DOCUMENT's history, not the transaction's, and the Media Type lives in the Details column's
>   "View" control (`data-extra-data="Batch Name=..., ID=..., Media Type=..."`). TS-EC-12000-007
>   through -010 already exercise this reader and pass.
> - The Authorized-event absence check needs a second reader filtered on the "Authorized Paper Out"
>   row instead of "Submitted Paper Out" - the same document-history table, a different row filter.
>   `PROBE-TS003-CHECK` (batch ID 366823, in the collection formerly known as `demo_Anil`) was
>   confirmed live 2026-09-14 to already be Authorized and is the candidate fixture; whether that
>   collection and batch still exist after the qa5 Collections reset (2026-09-14, see
>   `resolveSubmittableCollectionName`/`resolveOpenCancelCollectionName` in
>   steps/paper-out-media-type.steps.ts) has not been re-confirmed and is
>   `MCP_VALIDATION_REQUIRED` before this scenario is implemented for real.
> - The downloaded "activity history report" is genuinely new ground: no probe has reached it, its
>   trigger and file format are unconfirmed, and no PDF/report-parsing utility exists in this
>   codebase yet. This is `MCP_VALIDATION_REQUIRED` end to end - the download mechanism, the report
>   format, and the field that carries Media Type inside it.

**TS-EC-12000-020 — Media Type is visible on the Paper Out package cover page** (covers AC-EC-12000-016, UI, MANUAL_ONLY)

```gherkin
Scenario: Media Type is visible on the Paper Out package cover page
  Given a Paper Out batch is Authorized and its package is downloadable
  When I choose Print for the batch in the Work Queue
  And I download the Paper Out package from the Verify Paper Out modal
  Then Media Type is visible on the downloaded package's cover page
```

> **NEW at Gate 2 v2 (2026-09-14).** Split out of TS-EC-12000-016's original wording. `MANUAL_ONLY`
> per the approved plan: confirming the cover page means opening a real downloaded package file (a
> print/PDF artifact) and looking at it, which is not a browser locator this framework can
> validate. Step definitions will still exist for traceability, matching TS-EC-12000-019's existing
> pattern - each step throws `blocked(MANUAL_ONLY)` rather than asserting anything.


**TS-EC-12000-017 — Historical records are not retroactively updated** (covers AC-EC-12000-017, UI)

```gherkin
Scenario: Historical Paper Out records are not retroactively updated with Media Type
  Given a transaction or document had Paper Out/Export performed before this change was deployed
  When I inspect its Additional Information and audit trail after deployment
  Then the existing record is not retroactively updated with Media Type information
```

Needs: a pre-existing (pre-deployment) transaction/document fixture, audit-trail reader.

**TS-EC-12000-018 — Verify Paper Out modal verbiage** (covers AC-EC-12000-018, UI)

```gherkin
Scenario: Verify Paper Out modal's last checkbox reads the updated verbiage
  Given the Verify Paper Out modal is displayed
  When I read the last checkbox's label
  Then the label reads "Verify the downloaded package has been successfully printed to paper or saved to a secure location"
```

Needs: `VerifyPaperOutModal` page object/component.

> **IMPLEMENTATION status (2026-09-14): implemented and passing live.** `#verifyPaperOutDialog`,
> title "Verify Paper Out® Request", posts `verifyPaperOut.eo`. Four checkboxes in DOM order:
> `#certificationReviewed`, `#packageDownloaded` (disabled), `#multimediaDownloaded` (disabled),
> `#packagePrinted` (last). `#packagePrinted`'s label matches AC-EC-12000-018 exactly.
>
> Two deliberate design decisions. First, `VerifyPaperOutModalComponent` is **read-only** — it
> never checks a box and never presses Verify, because Verify permanently removes all source
> documents from the vault ("WARNING! Once you click Verify all source documents will be removed
> from the vault", captured live). Second, "the last checkbox" is resolved by reading the ordered
> ids via a DOM read rather than `.nth()`: `SEM-AUTOMATION-HYGIENE` bans positional locators
> outright, and reading the order lets the scenario *prove* which checkbox is last instead of
> assuming it.
>
> Its fixture is Work Queue batch **366823**, knowingly stranded at `Authorized`/`Verification`.
> It must be left there: verifying it would destroy `demo_Anil`'s only electronic original.

**TS-EC-12000-019 — Right-side border alignment** (covers AC-EC-12000-019, UI, MANUAL_ONLY per approved plan)

```gherkin
Scenario: Paper Out Request modal's right-side section borders are visually aligned
  Given the redesigned Paper Out Request modal, including the new Media Type section, is rendered
  When I observe the right side of the modal
  Then the section borders are visually aligned
```

Needs: `PaperOutRequestModal`. The approved plan marks this `automationDecision: MANUAL_ONLY` —
visual border alignment is not a reliable Playwright assertion target. The step definitions will be
written for traceability, but the assertion is expected to require a human visual check rather than
a pass/fail automated one; this will be confirmed, not decided, at PLAYWRIGHT_VALIDATION/IMPLEMENTATION.

Feature files describe business behaviour only — no selectors and no page-object method names. Every
scenario carries `@release-`, `@capability-`, `@req-`, `@ac-`, `@tp-` and `@ts-` tags (release,
capability, tp and the EC-12000 tag are declared once at the feature level and cascade to every
scenario).

## Locators and contracts

| Element or endpoint | Locator or contract | Status |
| --- | --- | --- |
| Collections accordion > dropdown-action icon > "Paper Out® Request" navigation | `VALIDATED - ` Row `tr.collection[data-collection-name="<name>"]`, icon `.collection-dropdown-action` (`getByRole('row',{name:/<name>/}).getByRole('img')`); menu opens on **click** (not hover) of the icon. The "Paper Out® Request" item (`div.paperOutTransactionCollection`) sits inside a CSS-hover-gated "Batch" cascading submenu (`visibility:hidden` until real cursor dwell), so Playwright automation must either (a) perform a real `hover()` chain icon→Batch with dwell time, or (b) `click({ force: true })` directly on the Paper Out Request item once the top-level menu is open — its click handler fires regardless of the submenu's CSS visibility. Confirmed via live DOM/session on qa5, 2026-09-11. | VALIDATED |
| Paper Out Request modal (open, Media Type section, radio buttons) | `VALIDATED - ` `getByRole('dialog', { name: 'Paper Out® Request' })`; Media Type section heading text "Media Type for Paper Out® Package"; `getByRole('radio', { name: 'Print to Paper' })` (checked by default), `getByRole('radio', { name: 'Save as Electronic File', exact: true })`. Confirmed live 2026-09-11 (collection-level trigger; screenshot `.playwright-mcp/paper-out-collection-dialog-reference.yml`). **Transaction-level (TS-EC-12000-007/-009) and document-level (TS-EC-12000-008/-010) parity both confirmed live 2026-09-11**: opening "Paper Out® Request" from a transaction row's own `Actions` menu (transaction `doc3`, real electronic-original document) opens the identical dialog; opening it from that same document's own row-level context menu (`View Download View History Download History Report Properties Certified Print® Request Paper Out® Request Destroy Void`) opens the identical dialog too — same title, same "Media Type for Paper Out® Package" heading, same two radios (`Print to Paper` default-checked, `Save as Electronic File`), same OK/Cancel, at all three levels (collection, transaction, document). Confirms AMB-EC-12000-001's resolution: one shared `PaperOutRequestModal` component regardless of entry point. | VALIDATED |
| Name of Request / Approver required fields | `VALIDATED - ` `getByRole('textbox', { name: 'Name of Request:' })` (required), `getByRole('combobox', { name: 'Approver:' })` (required, options include real user names), `getByRole('checkbox', { name: 'Notify' })`. Underlying form field names (from `verifyRequestPaperOutCollection.eo` response): `batchName`, `approverUserGuid`, `notifyNext`. | VALIDATED |
| Acknowledgement modal (checkbox, OK, Cancel) | `VALIDATED - ` `getByRole('dialog', { name: 'Acknowledgement' })`; checkbox `#mediaTypeElectronicConfirmCheckbox` (label text: "I understand that Save as Electronic File generates a single, concatenated, tampersealed file. If contents are separated from the electronic file, they do not retain system protections."); OK button (`getByLabel('Acknowledgement').getByRole('button', { name: 'OK' })`) is `disabled` until checkbox is checked, becomes enabled once checked — confirms TS-EC-12000-003's precondition. Cancel button (`getByLabel('Acknowledgement').getByRole('button', { name: 'Cancel' })`) closes only the Acknowledgement dialog; the Paper Out Request modal remains open with all field values retained (Name of Request, Approver, Media Type selection) and no Work Queue side effect — confirms TS-EC-12000-004 exactly. Confirmed live 2026-09-11. | VALIDATED |
| Work Queue item creation confirmation | **Blocked by real app validation, confirmed systemic across QA sample data, not a locator gap**: confirming the acknowledgement OK re-opened the Paper Out Request modal with "Each transaction you wish to Paper Out must contain at least 1 electronic original document." on **two different collections** — "demo collection" (2 items, 42.11KB) and "results 21 july" (9 items, 209.76KB). Both fail identically. TS-003's Work Queue assertion needs a collection/transaction fixture with a genuine electronic-original document — none of the existing QA5 sample collections tried so far qualify. **Attempted, this session, to build a qualifying fixture via New Transaction**: created transaction `MCP-EC12000-FIXTURE-01` (eCore Transaction ID `16807612`) with an uploaded document and a signature field, then "Save and Sign Now" — the transaction remained "Ready for signers" rather than completing a real signature ceremony (self-signing requires a designated signer/participant setup that is its own separate flow, outside every one of EC-12000's 17 approved scenarios and outside PLAYWRIGHT_VALIDATION's scope for this story). **This attempt is abandoned** rather than pursued further, since it was only a means of producing test data, not itself part of the approved automation. This remains a **test-data-fixture decision for IMPLEMENTATION** — a qualifying pre-signed transaction/document must be created or located (e.g. by a team member with signing-ceremony access, or a dedicated fixture-seeding script/API outside this framework's scope) before TS-003's Work Queue assertion, TS-016, and TS-018 can be automated against a real item, rather than fabricated. | MCP_VALIDATION_REQUIRED |
| Submitted Paper Out audit trail / Additional Information | Not yet captured | MCP_VALIDATION_REQUIRED |
| Package cover page Media Type display | Not yet captured | MCP_VALIDATION_REQUIRED |
| Activity history report download/Media Type field | Not yet captured | MCP_VALIDATION_REQUIRED |
| Verify Paper Out modal last checkbox label | **Partially observed, blocked by the same data-fixture gap as TS-003**: the static `#verifyPaperOutDialog` shell (declared in `workspace.js`-loaded markup) confirms the confirmation text "Are you sure you would like to verify the Paper Out® request?" and a WARNING about source-document removal, posting to `verifyPaperOut.eo` — but its checkbox (the one carrying the updated verbiage AC-EC-12000-018 asserts) is rendered dynamically per real batch state and never appeared: no genuine Paper Out request has reached the Work Queue in this session (blocked by the "at least 1 electronic original document" validation — see Work Queue row above), and the existing "test" Work Queue item is unrelated (opened nothing on click/double-click). Requires the same qualifying-transaction fixture as TS-003 before the actual checkbox text can be observed. | MCP_VALIDATION_REQUIRED |
| `requestPaperOutCollection.eo` / `verifyRequestPaperOutCollection.eo` (collection-level Paper Out form flow) | `OBSERVED` — `verifyRequestPaperOutCollection.eo` (POST, form-encoded) returns an **HTML fragment** (not JSON data) containing the `requestPaperOutCollectionForm` (action `requestPaperOutCollection.eo`) with fields `collectionOfWork.id`, `batchName`, `approverUserGuid`, `notifyNext`, `paperOutPurpose`, `mediaType` (`paper`\|`electronic`), `deleteEmptyTransactions`, `retentionPolicy.*`. This is UI markup, not a data contract — per AGENTS.md it may seed a scenario into a state but must never judge an acceptance criterion. Captured live 2026-09-11. | OBSERVED |
| `eoRequestExport` (endpoint, request/response shape) | **Architecturally distinct from the `ssweb` browser app — confirmed not reachable via Playwright MCP.** `eoRequestExport` has **zero** references anywhere in `reports/validation/ecore-api-discovery.json`, and its real Jira evidence (three sample XML attachments plus dev comments) shows it is exercised via **Postman**, not the browser — it is a separate XML-instruction integration API, not a `ssweb`/`.eo` AJAX call. Request shape is `OPENAPI`-equivalent, not guessed: the sample XMLs declare `xsi:schemaLocation="http://www.eoriginal.com/ecore/export http://schemas.eoriginal.com/releases/26.3/export.xsd"`, a real, versioned, publicly-hosted XSD, fetched and saved verbatim at `reports/jira/attachments/export-26.3.xsd` (also `reports/jira/attachments/eoRequestExport-{107302,107642,107697}.xml`, the three real dev-tested samples attached to EC-12000). The schema defines: root `eoExportInstructions` (`batchName` required; `mediaType` **optional**, enum `PrintToPaper`\|`SaveAsElectronicFile` — confirms AC-EC-12000-005/-006's optionality/back-compat, and the real `MyBatisSystemException`/`Invalid column type: 1111` failure the dev team hit when a mediaType was omitted on a pre-26.3 release, per Jira comment); then exactly one of `transaction` (repeatable, `id` + `deleteIfEmpty`, containing `retentionPolicy` or `document`), `groupTransactionIdentifier` (`xref1`\|`xref2`\|`xref3`\|`state`), `document` (repeatable, `id` + `retain`: `asIs`\|`eCopy`\|`none`), or `groupDocumentIdentifier`. **What remains genuinely unknown, and is not guessed here**: the endpoint's URL/HTTP method and its response shape/success indicator — neither appears in the ssweb app, the Jira comments (the Postman response is only a screenshot image, not transcribed text), or `ecore-api-discovery.json`. This is a real dependency gap, not a Playwright/locator problem: TS-011 through -015 need either (a) a human to supply the integration API's base URL/credentials so a real request/response pair can be captured outside the browser (e.g. via `src/api/` calling it directly, per AGENTS.md's API-client layering), or (b) an existing WSDL/integration-guide reference the team already has. Recorded as `OPENAPI` request-schema evidence; still `API_CONTRACT_UNVERIFIED` overall pending the endpoint + response shape, and per AGENTS.md `OPENAPI` may still only judge an acceptance criterion once a human confirms this is in fact the correct/current schema for the qa5 environment (schema URL states "26.3", matching this story's target release). | API_CONTRACT_UNVERIFIED |

Locators above marked `VALIDATED` were observed live against the running qa5 application via
Playwright MCP on 2026-09-11 and back TS-001/002 (transaction-level and document-level parity for
TS-007/-008/-009/-010 are now all confirmed live). Remaining rows stay `MCP_VALIDATION_REQUIRED` and
must be resolved before they back approved automation.

`eoRequestExport` is `API_CONTRACT_UNVERIFIED` overall: no endpoint path, HTTP method or response
shape is guessed here. Its **request** shape is now backed by a real, versioned, publicly-hosted XSD
(`export.xsd`, `reports/jira/attachments/`) plus real dev-tested sample XMLs — recorded as `OPENAPI`-
equivalent evidence. Confirmed this session: `eoRequestExport` lives entirely outside the `ssweb`
browser app that Playwright MCP drives (it is exercised via Postman in the dev team's own testing,
and has zero references in `reports/validation/ecore-api-discovery.json`), so its endpoint/response
cannot be captured through PLAYWRIGHT_VALIDATION's normal browser-network-trace approach. A human
must supply the integration endpoint (base URL/credentials) or existing WSDL/integration-guide
reference before a real request/response pair can be captured and promoted to `HUMAN_APPROVED` with
a `responseShapeHash` (AMB-EC-12000-002 resolution).

No `waitForTimeout` is anticipated; if one becomes necessary during implementation it will carry a
`JUSTIFIED-WAIT:` comment naming why no accessible wait condition was available.

## Open questions

**Two, raised at IMPLEMENTATION on 2026-09-14, both requiring a human decision
(`BLOCKER-EC-12000-004`):**

1. **Where is the recorded Media Type expected to surface in 26.3?** After a real Paper Out
   submission, "Media Type" appears nowhere on the Workspace, nowhere in the Work Queue, and
   nowhere in the transaction History dialog. TS-EC-12000-007 through -010 and TS-016 all assert
   against it and cannot proceed until this is answered.
2. **Is the EC-12000 *recording* change actually deployed to qa5?** The transaction History shows
   no Submitted Paper Out event at all. TS-018's verbiage change *is* deployed and passes, but that
   proves only that one part of the story shipped — not that the Media Type recording did.

These are deliberately unanswered rather than guessed: the remaining candidate observation points
(package cover page, activity history report) are reachable only via Print/Verify, which
permanently removes source documents from the vault.

The pre-Gate-2 ambiguities are unaffected: AMB-EC-12000-001, -002 and -003 were resolved before
approval (see `test-plans/approved/TP-EC-12000-001-approval.json` comments and the folded
resolution text in each clarification). The `eoRequestExport` contract remains
`API_CONTRACT_UNVERIFIED` as tracked above.

## What this automation deliberately does not assert

- AC-EC-12000-005 and -006 (the `mediaType` element's optionality and backward compatibility on
  `eoRequestExport` itself) — DEFERRED, no scenario exists for them in this feature file.
- The `eoRequestExport` request/response contract's full shape — only the UI-observed Media Type
  outcome is asserted for TS-011 through -015; the API step is scaffolding only.
- Exact wording of the acknowledgement modal beyond what AC-EC-12000-002/-003/-004 state — no
  fabricated copy is asserted.
- TS-EC-12000-019's visual alignment is not asserted as a deterministic pass/fail outside of what a
  human reviewer can confirm — see the MANUAL_ONLY note above.

## Risks

| ID | Level | Risk |
| --- | --- | --- |
| RISK-TP-EC-12000-001 | HIGH | `eoRequestExport`'s **request** shape is now schema-backed (real, versioned `export.xsd` fetched from `schemas.eoriginal.com` plus 3 real dev-tested sample XMLs from Jira — see locators table), but the endpoint's URL/HTTP method and response shape remain unknown: it is confirmed to live entirely outside the `ssweb` browser app (Postman-only in dev usage, absent from `ecore-api-discovery.json`), so Playwright MCP cannot observe it. TS-011 through -015 cannot back an assertion until a human supplies the integration endpoint (base URL/credentials) so a real request/response pair can be captured, or the team's existing WSDL/integration guide is provided — this is a dependency gap, not a locator problem. |
| RISK-TP-EC-12000-002 | MEDIUM | Confirming the acknowledgement modal creates a real Work Queue item against shared QA data; mitigated by using only fabricated requester/approver values. |
| RISK-TP-EC-12000-003 | MEDIUM | Media Type Additional Information moved from Authorized Paper Out to Submitted Paper Out event; any automation reading the old event location must be reviewed at IMPLEMENTATION. |
| RISK-TP-EC-12000-004 | ~~LOW~~ RESOLVED | The Collections navigation path (AMB-EC-12000-001) is a human-supplied answer, now **confirmed** against the running application at collection, transaction, and document level (all three open the identical `PaperOutRequestModal`), live via Playwright MCP 2026-09-11. No longer an open risk. |
| RISK-TP-EC-12000-005 | HIGH | **Confirmed live, not hypothetical**: every sampled QA5 collection (`demo collection`, `results 21 july`, and by extension the untried remainder) that was submitted for electronic Paper Out was rejected by a real app validation — "Each transaction you wish to Paper Out must contain at least 1 electronic original document." An attempt to build a qualifying fixture via New Transaction (`MCP-EC12000-FIXTURE-01`, eCore Transaction ID `16807612`) got as far as a document + signature field but stalled at "Ready for signers" — completing a real signing ceremony is outside every one of EC-12000's 17 approved scenarios and was abandoned rather than pursued further. TS-EC-12000-003's "Work Queue item created" assertion, TS-016 (Additional Information/audit trail/cover page/activity history), and TS-018 (Verify Paper Out modal checkbox verbiage, which only renders on a real pending batch) are all blocked on the same missing fixture. IMPLEMENTATION must create or locate a transaction/document with a genuine electronic original document (e.g. via a team member with signing-ceremony access, or a dedicated fixture-seeding mechanism outside this framework) before these three scenarios can be automated against a real Work Queue item, rather than fabricating the outcome. **RESOLVED 2026-09-14 — see the note below this table.** |

**`RISK-TP-EC-12000-005` update (2026-09-14).** This risk is resolved, and the reasoning recorded
above turned out to be wrong in two ways worth keeping visible.

The fixture gap is closed: all eleven qa5 collections were surveyed by driving a real submission
against each and cancelling every success, and `test collection` qualified. No signing ceremony was
needed. TS-EC-12000-003 and TS-018 are both implemented and passing live.

First correction — the survey method above was unsound. Eligibility was inferred from collections
being "sampled", but the electronic-original rule is enforced **only at submit time**: the modal
opens and renders its full Media Type section for collections that will still be refused. An open
modal is never evidence of eligibility, and an earlier survey built on that assumption reported four
qualifying collections and was wrong.

Second correction — the proposed remedy of adding a qualifying document to an existing collection
could not have worked. A collection-level Paper Out covers *every* transaction in the collection, so
a single ineligible or locked transaction disqualifies the whole collection.

The survey also found a rule not previously recorded: three collections are refused because their
transactions are "included in an active signature path", which is a different constraint from the
electronic-original rule and cannot be cleared without completing or abandoning a real signing
ceremony.

TS-016 is **no longer blocked by this risk**. It is blocked by `BLOCKER-EC-12000-004` — the
recorded Media Type cannot be observed anywhere — which is a question about the application, not
about test data. See "Open questions" above.

## How to record your decision

A chat message is not an approval. Only a schema-valid artifact on disk counts.

1. Copy `features/generated/paper-out-export/TP-EC-12000-001-automation-approval.template.json` to
   `features/approved/paper-out-export/TP-EC-12000-001-automation-approval.json`.
2. Set `decision`, and one entry in `itemDecisions` per scenario.
3. Fill in `reviewer.name`, `reviewer.role` and `reviewedAt` (ISO 8601, UTC).
4. Answer every question in **Open questions** in `comments` (none currently open).
5. Run `npm run validate:artifacts`.

Once the approval artifact is on disk, the orchestrator moves the feature file into
`features/approved/paper-out-export/` and proceeds. A locator still carrying
`MCP_VALIDATION_REQUIRED` fails the build once it backs approved automation — PLAYWRIGHT_VALIDATION
must resolve every one listed above before that happens.
