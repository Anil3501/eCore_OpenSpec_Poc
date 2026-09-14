# Gate 1 review — EC-12000 acceptance criteria

**Story:** EC-12000 — Phase 2_04: Improve Paper Out/Export to track if saving digital or papering out
**Capability:** `paper-out-export` · **Release:** 26.3
**Artifact:** requirements/normalized/EC-12000.json · **Version:** 1

---

## What you are being asked to approve

7 requirements and 19 acceptance criteria, all extracted from Jira (the `Acceptance Criteria` field,
`customfield_10700`, plus the description and the `Notes to QA` field, `customfield_11389`) — none
were proposed by requirement analysis. Approving unlocks `OPENSPEC_GENERATION` and
`TEST_PLAN_GENERATION` for the approved items only; it does not authorise writing any test, page
object or feature file, and it does not resolve the three ambiguities below, which remain open
questions regardless of your decision on the criteria that reference them.

## Requirements

| ID | Requirement | Source | Status |
| --- | --- | --- | --- |
| REQ-EC-12000-001 | Paper Out Request modal gains a "Media Type for Paper Out Package" section with two radio buttons (Print to Paper default, Save as Electronic File) | EXTRACTED_FROM_JIRA | PENDING_APPROVAL |
| REQ-EC-12000-002 | Selecting Save as Electronic File and clicking OK opens an acknowledgement modal gated by a checkbox; Cancel always closes only that modal | EXTRACTED_FROM_JIRA | PENDING_APPROVAL |
| REQ-EC-12000-003 | eoRequestExport / export.xsd gains an optional `mediaType` element (`PrintToPaper` / `SaveAsElectronicFile`), backward compatible | EXTRACTED_FROM_JIRA | PENDING_APPROVAL |
| REQ-EC-12000-004 | Media Type determination logic across UI and API, transaction and document level | EXTRACTED_FROM_JIRA | PENDING_APPROVAL |
| REQ-EC-12000-005 | Media Type audit logging moves to the "Submitted Paper Out" event; not retroactive | EXTRACTED_FROM_JIRA | PENDING_APPROVAL |
| REQ-EC-12000-006 | Verify Paper Out modal checkbox verbiage updated | EXTRACTED_FROM_JIRA | PENDING_APPROVAL |
| REQ-EC-12000-007 | Paper Out Request modal right-side section borders cleaned up / aligned | EXTRACTED_FROM_JIRA | PENDING_APPROVAL |

REQ-EC-12000-007 is a purely visual/cosmetic requirement. Its automatability (whether it can be
asserted at all beyond a manual visual check) is a Gate 2 test-planning decision, not a requirement
analysis one — it is included here because the story states it explicitly, not because it is known
to be testable.

## Acceptance criteria

| ID | Requirement | Criterion | Source | Status |
| --- | --- | --- | --- | --- |
| AC-EC-12000-001 | REQ-EC-12000-001 | Media Type section with Print to Paper (default) / Save as Electronic File radio buttons renders on the Paper Out Request modal | EXTRACTED_FROM_JIRA | PENDING_APPROVAL |
| AC-EC-12000-002 | REQ-EC-12000-002 | Selecting Save as Electronic File + OK (after required fields complete) opens an acknowledgement modal whose OK is disabled until its checkbox is checked | EXTRACTED_FROM_JIRA | PENDING_APPROVAL |
| AC-EC-12000-003 | REQ-EC-12000-002 | Confirming the acknowledgement modal closes both modals and creates the Work Queue approval item | EXTRACTED_FROM_JIRA | PENDING_APPROVAL |
| AC-EC-12000-004 | REQ-EC-12000-002 | Cancelling the acknowledgement modal closes only that modal; no Work Queue item is created | EXTRACTED_FROM_JIRA | PENDING_APPROVAL |
| AC-EC-12000-005 | REQ-EC-12000-003 | eoRequestExport with no mediaType element is accepted unchanged | EXTRACTED_FROM_JIRA | PENDING_APPROVAL |
| AC-EC-12000-006 | REQ-EC-12000-003 | export.xsd only accepts PrintToPaper / SaveAsElectronicFile as mediaType values | EXTRACTED_FROM_JIRA | PENDING_APPROVAL |
| AC-EC-12000-007 | REQ-EC-12000-004 | Transaction-level UI Paper Out with Print to Paper → Media Type = Paper | EXTRACTED_FROM_JIRA | PENDING_APPROVAL |
| AC-EC-12000-008 | REQ-EC-12000-004 | Document-level UI Paper Out with Print to Paper → Media Type = Paper | EXTRACTED_FROM_JIRA | PENDING_APPROVAL |
| AC-EC-12000-009 | REQ-EC-12000-004 | Transaction-level UI Paper Out with Save as Electronic File → Media Type = Electronic | EXTRACTED_FROM_JIRA | PENDING_APPROVAL |
| AC-EC-12000-010 | REQ-EC-12000-004 | Document-level UI Paper Out with Save as Electronic File → Media Type = Electronic | EXTRACTED_FROM_JIRA | PENDING_APPROVAL |
| AC-EC-12000-011 | REQ-EC-12000-004 | Transaction-level eoRequestExport with mediaType=PrintToPaper → Media Type = Paper | EXTRACTED_FROM_JIRA | PENDING_APPROVAL |
| AC-EC-12000-012 | REQ-EC-12000-004 | Document-level eoRequestExport with mediaType=PrintToPaper → Media Type = Paper | EXTRACTED_FROM_JIRA | PENDING_APPROVAL |
| AC-EC-12000-013 | REQ-EC-12000-004 | Transaction-level eoRequestExport with mediaType=SaveAsElectronicFile → Media Type = Electronic | EXTRACTED_FROM_JIRA | PENDING_APPROVAL |
| AC-EC-12000-014 | REQ-EC-12000-004 | Document-level eoRequestExport with mediaType=SaveAsElectronicFile → Media Type = Electronic | EXTRACTED_FROM_JIRA | PENDING_APPROVAL |
| AC-EC-12000-015 | REQ-EC-12000-004 | eoRequestExport with no mediaType passed at all (either level) → Media Type = Electronic | EXTRACTED_FROM_JIRA | PENDING_APPROVAL |
| AC-EC-12000-016 | REQ-EC-12000-005 | Media Type logged as Additional Information on Submitted Paper Out; visible on cover page and audit trail (UI + downloaded) | EXTRACTED_FROM_JIRA | PENDING_APPROVAL |
| AC-EC-12000-017 | REQ-EC-12000-005 | Existing transactions/documents are not retroactively updated with Media Type | EXTRACTED_FROM_JIRA | PENDING_APPROVAL |
| AC-EC-12000-018 | REQ-EC-12000-006 | Verify Paper Out modal's last checkbox shows the updated verbiage | EXTRACTED_FROM_JIRA | PENDING_APPROVAL |
| AC-EC-12000-019 | REQ-EC-12000-007 | Paper Out Request modal's right-side section borders are visually aligned | EXTRACTED_FROM_JIRA | PENDING_APPROVAL |

No criterion here was proposed by requirement analysis — every one is extracted from Jira, so there
is no rationale section to fill in for this story.

## Ambiguities

| ID | Question | Impact | Status |
| --- | --- | --- | --- |
| AMB-EC-12000-001 | Does a Paper Out initiated from Collections use the same Paper Out Request modal as AC-001–004/007–010, or a separate flow? | Collections coverage cannot be honestly claimed under the existing UI criteria until this is answered | REVIEW_REQUIRED |
| AMB-EC-12000-002 | `API Test Required?` = Yes, but eoRequestExport's contract is not in this framework's API-surface inventory. Who captures and approves the authoritative contract? | AC-005, AC-006, AC-011–015 cannot be judged by any test until the contract is OBSERVED via Playwright MCP and promoted to HUMAN_APPROVED at Gate 2 | REVIEW_REQUIRED |
| AMB-EC-12000-003 | Which fields are the "required field edits" that gate the acknowledgement modal? | AC-002's precondition cannot be stated concretely without guessing which fields to fill first | REVIEW_REQUIRED |

None of these three ambiguities block approving the acceptance criteria themselves — they block
writing a fully-specified test scenario for the criteria they are attached to
(`clarificationRefs` on AC-002, AC-005, AC-006, AC-011 through AC-015). If they remain unresolved
at Gate 2, those scenarios will need to be marked `REVIEW_REQUIRED` or deferred rather than written
against a guess.

## Coverage this produces — please read before approving

If every criterion above passes, REQ-EC-12000-001 through REQ-EC-12000-006 report as fully covered
by their listed criteria. REQ-EC-12000-004 (the Media Type determination logic) is the most heavily
tested requirement (9 criteria, AC-007 through AC-015) because it is genuinely combinatorial across
UI/API and transaction/document level — Jira's own `Notes to QA` field lists this same test matrix.

REQ-EC-12000-007 (cosmetic border alignment) has one criterion (AC-019) whose observable outcome is
inherently visual/subjective; whether it can be automated at all, versus verified manually, is not
decided here.

The API-facing criteria (AC-005, AC-006, AC-011 through AC-015) can be approved as acceptance
criteria today, but **none of them can be judged by an executed test** until AMB-EC-12000-002 is
answered and an authoritative eoRequestExport contract exists — approving them now does not resolve
that gap, it only means the ambiguity travels forward attached to them.

## How to approve

A chat message is not an approval. Only a schema-valid artifact on disk counts.

1. Copy `requirements/reviews/EC-12000-ac-approval.template.json` to
   `requirements/approved/EC-12000-ac-approval.json`.
2. Set `decision`, and one entry in `itemDecisions` per acceptance criterion (19 entries).
3. Fill in `reviewer.name`, `reviewer.role` and `reviewedAt` (ISO 8601, UTC).
4. Answer every question raised above in `comments` — in particular, state whether the three
   ambiguities are to be resolved now, deferred, or left `REVIEW_REQUIRED` going into Gate 2.
5. Run `npm run validate:artifacts`.

`artifactVersion` must match the artifact you reviewed (currently 1). If the artifact changes
afterwards the version moves and this approval no longer binds — that is deliberate.
