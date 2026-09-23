# EC-12000 Intake Retrospective — What Actually Happened, and How the Story Should Have Been Written

This document is a **retrospective case study**, not a governed artifact. It analyzes the real Jira
history of `EC-12000` (fetched via the Atlassian MCP `getJiraIssue` tool) against everything this
framework actually produced for it — 3 ambiguities, 6 risks, and 3 full test-plan revisions — and
proposes the story text that would have prevented every one of them.

It is a companion to
[docs/jira-story-intake-standard-and-worked-example.md](jira-story-intake-standard-and-worked-example.md),
which defines the general standard. This document exists because `EC-12000` is a **second real,
already-completed story** (unlike the hypothetical `ETA-777` in that standard) whose entire cost —
25 Jira comments spanning three months, a production incident, and three post-approval test-plan
revisions — is fully on record and directly attributable to specific missing fields.

**Reading order:** understand what the framework does today (per `AGENTS.md` rule 2 — never open a
finished story as a template for a *new* one), never copy `EC-12000`'s artifacts as a shape to
reuse. This document draws lessons from it; it does not supply a template. The template remains
[Part 2 of the intake standard](jira-story-intake-standard-and-worked-example.md#part-2--the-standard-story-template).

---

## 1. What the real ticket actually said

**EC-12000** — *"Phase 2_04: Improve Paper Out/Export to track if saving digital or papering out"*
(project `eoriginal`, capability `paper-out-export`, release `26.3`, closed 2026-04-23).

**Correction to an earlier draft of this document:** an earlier version of this section quoted only
the Jira `description` field and concluded that was "the entire structured requirement." That was
wrong, and worth naming explicitly because the mistake is itself the lesson §1.2 of the intake
standard is built around. EC-12000 is not a "no AC" story — it is the real-world **NARRATIVE-ONLY**
tier: a genuine, populated `Acceptance Criteria` custom field (`customfield_10700`) existed, plus a
separate `Notes to QA` field (`customfield_11389`) that informally named the full UI/API test
matrix. Both are quoted below in full. The problem was never that content was missing — it's that
neither field was written as individual, testable Given/When/Then statements with an interface tag,
an endpoint, or an out-of-scope line, so the framework's own Gate 1 review still correctly recorded
all 19 resulting `AC-EC-12000-*` entries as `EXTRACTED_FROM_JIRA` (see
[requirements/reviews/EC-12000-ac-review.md](../requirements/reviews/EC-12000-ac-review.md)) — "came
from Jira" and "was automation-ready" are different claims, and this ticket proves it.

The Jira `description` field, in full, was:

> Currently, the Paper Out/Export has logic for the **Media Type** that displays in the 1st section
> of the front/cover page and in the audit trail. If the Paper Out is performed via UI, it displays
> _Paper._ If the Export is performed via API, it displays _Electronic._
>
> This ticket enhances the **Media Type** logic and the Export process to capture and log whether
> the user intends to maintain the package digitally outside of the eAsset Management Platform or to
> convert to paper.
>
> For reference, below are the current Paper Out Request and Additional Information modals.
>
> NOTE: When updating the Paper Out Request modal, we should clean up and align the section borders
> on the right side of the modal.
>
> *[two embedded screenshot images]*

The `Acceptance Criteria` field (`customfield_10700`), separately populated, held a nested numbered
list — paraphrased here, structure preserved, embedded screenshot references kept as `[screenshot]`:

> The following is applicable regardless of whether the Paper Out/Export is requested at the
> Transaction level or the Document level.
> 1. Paper Out Request modal: `[screenshot]`
>    1. Add a new **Media Type for Paper Out Package** section with two radio buttons:
>       1. *Print to Paper* — defaults selected
>       2. *Save as Electronic File* — when selected and OK is clicked, open a new acknowledgement
>          modal AFTER the required field edits are complete `[screenshot]`, with a checkbox (blank
>          by default; enables OK when selected), an OK button (closes both modals and creates the
>          Work Queue item for approval), and a Cancel button (always enabled, closes only the
>          acknowledgement modal).
>    2. Clean up formatting so the modal's right-side section borders are aligned.
> 2. Additional Information (modal in UI) / Additional Event Information (activity history report):
>    1. Media Type logging moves from the Authorized Paper Out event to the **Submitted** Paper Out
>       event, since that is when the user specifies how the Paper Out will be managed.
>    2. This is **not** retroactive to existing documents/transactions.
> 3. `eoRequestExport` / `export.xsd`:
>    1. Add a **`mediaType`** element with two valid enumerations: `PrintToPaper`,
>       `SaveAsElectronicFile`.
>    2. `mediaType` is **optional** — requiring it would break existing integrators.
>    3. Update the schema.
> 4. New Media Type logic: Media Type = **Paper** if the UI user selects *Print to Paper* OR
>    `eoRequestExport` passes `PrintToPaper`; Media Type = **Electronic** if the UI user selects
>    *Save as Electronic File* OR `eoRequestExport` passes `SaveAsElectronicFile` OR
>    `eoRequestExport` omits `mediaType` entirely.
> 5. Verify Paper Out modal: update the last checkbox's wording from "Verify the downloaded package
>    has been successfully printed" to "...printed to paper or saved to a secure location."
>    `[screenshot]`

The `Notes to QA` field (`customfield_11389`), verbatim in structure:

> Paper Out (UI)
> - Transaction level with paper selection
> - Transaction level with electronic selection
> - Document level with paper selection
> - Document level with electronic selection
> - Verify Paper Out via Collections works with the updates
>
> eoRequestExport (API)
> - Transaction level with mediaType of paper
> - Transaction level with mediaType of electronic
> - Transaction level with no mediaType passed
> - Document level with mediaType of paper
> - Document level with mediaType of electronic
> - Document level with no mediaType passed
>
> Check the cover page of the package and the audit trail for each test above to confirm the Media
> Type is correct.

That is a real, substantial acceptance-criteria narrative and a real, complete UI/API test matrix —
already naming the operation (`eoRequestExport`), the exact field (`mediaType`), its two enumerated
values, and its optionality. That is real §5 material — the operation name and its one business-rule
field were sitting in the ticket, in prose, before the story was ever picked up. What was *not* in
the ticket text (only in the 3 attached XML samples, and never transcribed out of them into a
reviewable form) was the rest of §5: the HTTP method, the full path, the auth mechanism, the complete
request/response shape, and the expected status codes for success and failure. So the operation
itself was never a mystery — its full contract was, and that gap is what actually blocked Gate 2 for
three revisions (see §3 below). This is the real cost of the NARRATIVE-ONLY tier: not that nothing
was said, but that what was said was scattered across a description, an AC field, a notes field, and
XML attachments, in prose and file form rather than one structured §5 a reviewer could act on
directly.

Everything else that eventually became 7 requirements, 19 acceptance criteria, an XSD change, and a
full API contract discussion also lived in:
- **13 attached screenshots + 1 screen recording**, showing modal mockups and later, actual output.
- **3 attached XML files** (`eoRequestExport.xml`, plus two more added during a later revision),
  the *only* place the real request shape ever appeared.
- **25 comments over roughly 3 months** (2026-01-27 to 2026-04-23) — UI copy iterated live, a
  production defect discovered mid-flight, and a scope question raised and resolved five days
  before close.

## 2. The timeline, and what it actually cost

| When | What happened in Jira | What it cost the framework |
| --- | --- | --- |
| Jan 27 (comments 1–5) | UI copy iterated live: *"stored as electronic copy"* → *"saved as electronic file"*; a tamperseal warning message drafted turn-by-turn in comments, never in the AC text | None yet — but this is exactly the kind of "author the exact string" work §3 of the intake standard asks to be done *before* the story is written, not during implementation |
| Apr 10–13 (comments 7–10) | **A production defect** (`ESCA-2958`, linked as "is caused by") — `MyBatisSystemException: Invalid column type` — traced to `eoRequestExport` receiving no `mediaType` element. A developer had to ask a colleague for a *working XML sample* to even reproduce it | `AMB-EC-12000-002`: the story never named `eoRequestExport`'s method, path, request shape, or which parameter was newly required vs. optional. The framework had nothing to validate against and had to carry the entire contract as `UNVERIFIED`/`scaffoldingOnly: true` through **three** test-plan revisions (see §3) |
| Apr 14 (comment 12) | A UI label was still wrong post-implementation: *"Save as Electronic"* instead of *"Save as Electronic File"* | Confirms the copy iterated in comments 1–5 never made it back into a single authoritative AC — exactly what §3's "no vague language" rule and a single Given/When/Then per criterion are meant to prevent |
| Apr 21 (comments 14–15) | Tester found the required-field asterisk shown in the AC screenshot did not match actual output; resolved by deciding it isn't actually required (the default radio selection means one is always chosen) | `AMB-EC-12000-003` in this framework's own Gate 1 review: *"Which fields are the 'required field edits' that gate the acknowledgement modal?"* — never named in the story text at all |
| Apr 21 (comments 16–22) | Tester found Paper Out via **Collections** doesn't show Media Type at all; ticket **reopened**; five comments later, product explicitly confirms Collections was never in scope and opens a *new* ticket for it | `AMB-EC-12000-001` in this framework's Gate 1 review: *"Does a Paper Out initiated from Collections use the same modal, or a separate flow?"* — an explicit "out of scope" line would have made this unnecessary from day one |
| Apr 23 (comment 25) | Final "Product Approved" comment enumerates, informally, the full acceptance matrix: UI/API × Transaction/Document × Paper/Electronic × 26.3 vs. pre-26.3 vs. DT 12.2 | This matrix is real and correct — it is exactly `AC-EC-12000-007` through `-015` in this framework's normalized requirements — but it only existed as free text in a closing comment, never as an upfront, structured table |

## 3. What this cost inside the framework itself

**Requirements (Gate 1):** 3 ambiguities raised, none of which needed to exist:

| ID | Question raised | Would not exist if the story had said |
| --- | --- | --- |
| `AMB-EC-12000-001` | Does Collections use the same modal or a separate flow? | An explicit "§4 Out of scope: Collections-initiated Paper Out" line |
| `AMB-EC-12000-002` | `eoRequestExport`'s contract is not in the framework's API inventory — who approves it? | The operation name and its `mediaType` field were already in the ticket text; a completed §5 transcribing the method, path, auth, full request/response shape and status codes out of the 3 attached XML samples, rather than leaving them undiscovered until Gate 2 |
| `AMB-EC-12000-003` | Which fields are the "required field edits" gating the acknowledgement modal? | Concrete field names in the AC's Given clause instead of "required field edits" |

**Test plan (Gate 2): three approved revisions of the same plan**, not one:

- **v1** — 6 API-facing scenarios (`TS-EC-12000-005/006/011–015`) shipped as scaffolding only:
  `apiContract.contractSource: UNVERIFIED`, `automationDecision: REVIEW_REQUIRED`. `RISK-TP-EC-12000-001`
  (HIGH): *"`eoRequestExport` contract completely unverified (not even declared)."*
- **v2** — added a split scenario for the Submitted-vs-Authorized audit-trail event distinction
  (`REQ-EC-12000-005`), because the story's "Media Type audit logging moves to the Submitted Paper
  Out event" line needed a second scenario to state non-retroactivity explicitly. `RISK-TP-EC-12000-006`
  (LOW): the fixture batch needed for this (`PROBE-TS003-CHECK`) is a single shared QA record that
  "must be re-blocked rather than quietly dropped" if it's ever consumed.
- **v3** — a human **dictated** the `eoRequestExport` endpoint in chat (not from any document), which
  the framework could only record as `contractSource: UNVERIFIED` with `contractProvenance` beginning
  `AGENT_DRAFTED`/`DICTATED:` — three months and two approved revisions after the story was first
  written, and *still* not promotable to `HUMAN_APPROVED` because no response was ever observed to
  compute a `responseShapeHash` from. `RISK-TP-EC-12000-005` (HIGH): *"The endpoint is dictated, not
  corroborated by any independent source."* `RISK-TP-EC-12000-006` (HIGH): `eoRequestExport` is
  destructive-by-name and reachable by `POST` against a shared QA fixture already used by 8 approved
  scenarios — a `CLEANUP` waiver had to be retrofitted rather than planned from the start.

**Net effect:** every one of the six risks and three ambiguities on file for this story traces back to
one of exactly two missing sections — **§5 API details** and **§4 Out of scope** — from the intake
standard's Part 2 template. Nothing else about the story was unusually complex.

## 4. The story, rewritten per the intake standard

This is what `EC-12000` should have looked like, filled in with only the facts that were **actually
available** at story-write time (the real XML samples, the real screenshots, the real "Notes to QA"
matrix from comment 25) — showing that every field the framework had to ask about later already had
a knowable answer, just not a written one.

> ### 1. Summary
> A user performing a Paper Out (UI) or an export via `eoRequestExport` (API) declares whether the
> package is intended to remain digital or be converted to paper, and that choice is captured,
> validated, and logged as "Media Type."
>
> ### 2. Preconditions / environment
> - Target tiers: `qa`, `staging` (this is the release-validation ticket for `26.3`); not `prod` at
>   this stage.
> - Role: any user with Paper Out / Export permission at the transaction or document level.
> - Applies to Transaction-level and Document-level Paper Out/Export only. **Collections-level Paper
>   Out is explicitly out of scope for this story** — see §4.
> - `eoRequestExport` must remain callable by integrators running pre-`26.3` releases and by the
>   `12.2` DT (Document Type) version without the new element — see §5 backward-compatibility note.
>
> ### 3. Acceptance Criteria
> - **AC-1** (UI) — Given the Paper Out Request modal (transaction or document level) is open, Then
>   it shows a "Media Type for Paper Out Package" section with two radio buttons: "Print to Paper"
>   (selected by default) and "Save as Electronic File" — exact label text, not "Save as Electronic."
> - **AC-2** (UI) — Given "Save as Electronic File" is selected, When the modal's required fields
>   (name them: **[the specific fields already required today before OK is enabled on this modal —
>   the story author knows this list; do not describe it as "required field edits"]**) are complete
>   and OK is clicked, Then an acknowledgement modal opens with an unchecked checkbox that gates its
>   own OK button, containing the warning text: "The Paper Out® process produces a single file that
>   is digitally signed with a certificate. Any modification, extraction, or separation of its
>   contents will invalidate the digital signature and compromise the file's integrity." *(the exact
>   text from comment 4 — decide it here, not mid-implementation)*.
> - **AC-3** (UI) — Given the acknowledgement modal is open, When its checkbox is checked and OK is
>   clicked, Then both modals close and a Work Queue approval item is created.
> - **AC-4** (UI) — Given the acknowledgement modal is open, When Cancel is clicked, Then only that
>   modal closes; the Paper Out Request modal remains open; no Work Queue item is created.
> - **AC-5** (API) — Given `eoRequestExport` is called **without** a `mediaType` element, Then the
>   request is accepted unchanged (backward compatibility with every release before `26.3`, and with
>   DT version `12.2`) and Media Type is recorded as Electronic.
> - **AC-6** (API) — Given `eoRequestExport` is called with a `mediaType` value that is not
>   `PrintToPaper` or `SaveAsElectronicFile`, Then the request is rejected — *(name the exact status
>   code/fault the schema validation produces; this was never observed in the real ticket and is a
>   genuine gap — flag it as an ambiguity rather than guessing)*.
> - **AC-7 through AC-15** (UI/API × Transaction/Document × Paper/Electronic) — the full determination
>   matrix, stated as one row per combination exactly as comment 25 eventually listed informally:
>   `UI + Print to Paper`, `UI + Save as Electronic File`, `API + mediaType=PrintToPaper`,
>   `API + mediaType=SaveAsElectronicFile`, `API + mediaType omitted → Electronic`, each × Transaction
>   level × Document level.
> - **AC-16** (UI) — Given a Paper Out reaches the "Submitted Paper Out" event, Then Media Type is
>   logged as Additional Information visible on the cover page and audit trail (UI and downloaded).
> - **AC-17** (UI) — Given a transaction/document that existed before this change, Then it is **not**
>   retroactively updated with a Media Type.
> - **AC-18** (UI) — The Verify Paper Out modal's final checkbox shows updated verbiage:
>   *(quote the exact final text from comment 4/its resolution, not "updated verbiage")*.
> - **AC-19** (UI, cosmetic) — The Paper Out Request modal's right-side section borders are visually
>   aligned *(flag explicitly that automatability of a purely visual criterion is a Gate 2 decision,
>   not assumed either way)*.
>
> ### 4. Explicitly out of scope
> - **Paper Out initiated from Collections/batch** does not receive a Media Type selection in this
>   story. (This is the exact question that reopened the real ticket on Apr 21 — stating it here
>   would have prevented that.) A follow-up enhancement ticket covers it.
> - UI copy for any message not explicitly quoted in an AC above is not decided by this story.
> - Search/sort/reporting on Media Type — separate story if needed.
>
> ### 5. API details
> - **Endpoint:** `eoRequestExport` — the operation name itself was already in the ticket text (both
>   the AC field and the Notes to QA field name it directly), so this line requires transcription,
>   not discovery. What the real ticket never stated anywhere in Jira was the HTTP method, the full
>   path, and the response shape — those lived only in the 3 attached XML request samples, and only
>   as a request body, never as a documented response — which is exactly why the framework still had
>   to carry the full contract as `UNVERIFIED`/`AGENT_DRAFTED` for three revisions *(name the actual
>   method/path here)*.
> - **Request shape:** existing `eoExportInstructions` body per `export-<release>.xsd`, gaining one
>   new **optional** element: `mediaType`, enum `PrintToPaper | SaveAsElectronicFile`. Omitting it is
>   valid and defaults to Electronic (per AC-5/AC-15).
> - **Backward compatibility:** must be valid for `26.3`, every release before it, and DT version
>   `12.2` — name explicitly which of these the new element applies to, since the real defect
>   (`ESCA-2958`) was exactly a backward-compatibility gap between the DT version and the new schema.
> - **Response shape:** *(state whether a success response changes at all — the real ticket never
>   said; if it doesn't, say so explicitly rather than leaving it silent)*.
> - **Is this documented in an OpenAPI/WSDL/XSD reference?** Yes — `export-<release>.xsd` (link it).
>   That is this contract's authority; a sample XML attached to a comment is evidence of usage, not
>   the schema itself, and should never be the only source.
> - **Side effects:** `eoRequestExport` is not itself destructively named, but a Paper Out it triggers
>   moves a transaction toward `Authorized`, which is **not reversible** (see `AGENTS.md`'s Work Queue
>   lifecycle notes) — any test scenario exercising this needs its own disposable fixture, never a
>   shared one, and a `CLEANUP -` waiver if any earlier stage is reversible.
>
> ### 6. Test Data Contract
> - **Author-supplied:** the two `mediaType` enum values; the acknowledgement/warning text; the
>   Verify Paper Out checkbox's updated text — all literal, all already decided by product before
>   this story is written (they were decided anyway, just three months later, in comments).
> - **Pre-existing/seeded:** one transaction and one document, per target tier, in a state eligible
>   for Paper Out/Export at both levels. Name who seeds them.
> - **Fabricated/synthetic:** none required — no negative path here needs a fake account.
> - **Gap:** whether `eoRequestExport`'s exact endpoint/path is documented anywhere outside the XSD —
>   if genuinely unknown at write time, say so as `TEST_DATA_GAP-EC-12000-001` rather than letting an
>   agent discover it only when a defect is filed.
>
> ### 7. Negative / edge cases
> - `mediaType` value outside the two valid enums (AC-6 — exact rejection behavior must be stated,
>   not assumed).
> - Export at Document level with `retentionPolicy` also present — the real ticket's comment 20
>   reveals `retentionPolicy` only applies to Transaction-level exports and must be rejected/ignored
>   for a Document-level one; this is exactly the kind of interaction that belongs in the AC, not
>   discovered by a tester attaching a malformed sample XML.
>
> ### 8. Non-functional exclusions
> MFA/SSO/session timeout/lockout/rate limiting — out of scope, inherited from the existing sign-in
> flow. Localization of the new UI text — out of scope unless stated.

## 5. What this rewrite would have prevented

| Real cost | Prevented by |
| --- | --- |
| `AMB-EC-12000-001` (Collections scope) + ticket reopened after close | §4's explicit out-of-scope line |
| `AMB-EC-12000-002` (contract unknown) + `RISK-TP-EC-12000-001/005/006` + 3 test-plan revisions + `AGENT_DRAFTED`/`DICTATED` endpoint | §5 fully completed at story-write time (the XSD reference and backward-compatibility note already existed — they were simply never written down) |
| `AMB-EC-12000-003` (which fields are "required") | Naming the fields in AC-2's Given clause instead of "required field edits" |
| Production defect `ESCA-2958` (`mediaType` backward-compatibility gap with DT `12.2`) | §5's explicit backward-compatibility statement, decided **before** implementation instead of discovered by a MyBatis exception in production-adjacent testing |
| UI copy iterating across 5+ comments, then found wrong post-implementation (comment 12) | Exact quoted strings inside each AC (§3), decided once, before Gate 1 |
| `RISK-TP-EC-12000-006` (destructive-by-name endpoint against a shared fixture, retrofitted `CLEANUP`) | §5's side-effects/`CLEANUP` question, answered before any scenario is designed |

## 6. Recommendation

1. Every future Paper Out/Export-adjacent story (and any story touching an `.eo` RPC endpoint) uses
   the [intake standard's Part 2 template](jira-story-intake-standard-and-worked-example.md#part-2--the-standard-story-template)
   in full — §4 (out of scope) and §5 (API details) are the two sections this real story proves are
   never optional in practice, whatever the story "feels" UI-first.
2. When a schema document already exists (here, `export-<release>.xsd`), the story must link it
   directly rather than leaving the contract to be reconstructed from an attached sample request three
   months into implementation.
3. A backward-compatibility statement is mandatory whenever a change touches a shared schema/contract
   consumed by more than one release or a legacy component (here, DT version `12.2`) — this is the
   single change that would have prevented the actual production incident.
4. This document does not change any schema, model, or workflow rule — it is guidance for the human
   writing the *next* story, exactly like `docs/jira-story-intake-standard-and-worked-example.md`
   Part 3.
5. Classify a story's AC-completeness tier (§1.2 of the intake standard) at write time, not after the
   fact. EC-12000 shows why that classification can't be "does an AC field exist" — a populated field
   full of unstructured prose is functionally the same intake risk as an empty one, because neither
   gives a reviewer a checklist to act on. The tier that actually matters is "has this been
   decomposed into individual, testable statements with an interface, an endpoint, and a scope
   boundary" — and that is a yes/no a human can answer in five minutes at intake, long before any
   agent touches the story.

---

## Related reading

| Topic | File |
| --- | --- |
| The general intake standard this case study supports | [docs/jira-story-intake-standard-and-worked-example.md](jira-story-intake-standard-and-worked-example.md) |
| EC-12000's real, approved requirements (human-facing evidence only — never an authoring template) | [requirements/approved/EC-12000.json](../requirements/approved/EC-12000.json) |
| EC-12000's Gate 1 review, naming all three ambiguities | [requirements/reviews/EC-12000-ac-review.md](../requirements/reviews/EC-12000-ac-review.md) |
| The three test-plan revisions and their risks | [test-plans/generated/TP-EC-12000-001-review.md](../test-plans/generated/TP-EC-12000-001-review.md), [-v2-review.md](../test-plans/generated/TP-EC-12000-001-v2-review.md), [-v3-review.md](../test-plans/generated/TP-EC-12000-001-v3-review.md) |
| Framework readiness evaluation for this same story | [docs/EC-12000-framework-readiness-evaluation.md](EC-12000-framework-readiness-evaluation.md) |
| Non-negotiable rules this story repeatedly tested | [AGENTS.md](../AGENTS.md) |
