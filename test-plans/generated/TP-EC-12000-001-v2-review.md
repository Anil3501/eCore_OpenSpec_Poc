# Approval Gate 2 — Test Plan Review — TP-EC-12000-001 v2

| | |
| --- | --- |
| Test plan | `TP-EC-12000-001`, artifactVersion 2 |
| Story | EC-12000 — Phase 2_04: Improve Paper Out/Export to track if saving digital or papering out |
| Capability | `paper-out-export` |
| Release | 26.3 |
| Plan | `test-plans/generated/TP-EC-12000-001.json` |
| Status | PENDING_TEST_PLAN_APPROVAL |
| Supersedes | v1, approved 2026-09-11 (`test-plans/approved/TP-EC-12000-001-approval.json`) |
| v1 review | `test-plans/generated/TP-EC-12000-001-review.md` — retained unchanged |

This is a **revision of an already-approved plan**, not a new one. v1 carried 17 scenarios. This
revision changes **one** scenario and adds **one**, taking the plan to 18. Nothing else is touched.
No scenario introduced here changes application data beyond what v1 already authorised.

Approving this plan authorises the framework to design automation against it. It does **not**
authorise the automation itself — that is Gate 3.

---

## Why this revision exists

v1 mapped the whole of `AC-EC-12000-016` to a single scenario, `TS-EC-12000-016`, spanning four
surfaces: the Submitted Paper Out event, the Authorized Paper Out event, the Paper Out **package
cover page**, and the downloadable activity history report.

Live investigation against qa5 on 2026-09-14 established that **three of those four are observable
and automatable, and the fourth cannot be reached without destroying the only usable test fixture.**
As written, the scenario can therefore never pass, and three verifiable surfaces are held hostage to
one that is not.

This revision splits the cover page into its own `MANUAL_ONLY` scenario so the other three can be
automated now.

## What this plan covers, and what it deliberately leaves uncovered

| Requirement | Covered by | Status after this plan |
| --- | --- | --- |
| REQ-EC-12000-005 (AC-EC-12000-016) | TS-EC-12000-016 (automated) + TS-EC-12000-020 (manual) | PARTIAL — complete only once a human executes the manual scenario |
| REQ-EC-12000-005 (AC-EC-12000-017) | TS-EC-12000-017 | UNCOVERED — no fixture exists; see CLR-TP-EC-12000-003 |

Coverage of every other requirement is **unchanged from v1**. This revision does not touch
REQ-EC-12000-001 through -004, -006 or -007, nor any of their scenarios.

If this plan runs green, what remains unproven is: that Media Type appears on the package **cover
page** (manual only, never yet executed), and that pre-deployment Paper Out records were **not**
retroactively given a Media Type (no fixture exists to demonstrate it either way).

`AC-EC-12000-016` must be reported as **partially** covered until the manual scenario has a recorded
human execution. An automated pass on TS-EC-12000-016 alone does not satisfy it.

## Scenario-by-scenario

Only the changed and added scenarios are listed. The other sixteen are unchanged from approved v1
and are not re-opened by this revision.

| ID | Scenario | Type | AC | Suite | Interface |
| --- | --- | --- | --- | --- | --- |
| TS-EC-12000-016 | Media Type is recorded on the Submitted Paper Out event, is absent from the Authorized Paper Out event, and appears in the downloaded document activity history report | POSITIVE | AC-EC-12000-016 | suite-regression | UI |
| TS-EC-12000-020 | Media Type is shown on the Paper Out package cover page | POSITIVE | AC-EC-12000-016 | suite-regression | UI — `automationDecision: MANUAL_ONLY` |

### Why these are split rather than merged

Not for convenience. The two halves have materially different costs.

The three surfaces left in TS-EC-12000-016 are all readable from a Paper Out request that is merely
**Submitted**, and a Submitted request can be cancelled afterwards. That cancellation is what
releases the transaction lock and makes the already-approved scenarios repeatable run after run.

The cover page cannot be reached from a Submitted batch at all. Evidence captured live on
2026-09-14:

- The package is served by
  `/ssweb/setup/workspace/getPrintableDocumentContents.eo?batch.id=<id>&printableDocumentType=…`.
  Requested for a **Submitted** batch (`batch.id=366950`) it returns `200 text/html`, 11,530 bytes —
  an HTML page, not the package. The package is produced only once the batch reaches **Authorized**.
- Authorizing the fixture is a **one-way door**. A Submitted request can be cancelled. After
  authorization the only exit is **Verify**, and the application's own modal warns: *"Once you click
  Verify all source documents will be removed from the vault."*
- That would consume the **only** qa5 collection that qualifies for Paper Out. All eleven
  collections were surveyed on 2026-09-14; exactly one qualifies. Losing it would permanently block
  TS-EC-12000-003, -007, -008, -009, -010 and -016.

Merging the cover page back in would not buy coverage — it would trade six working scenarios for one.

### What TS-EC-12000-016 gains in this revision

The revised scenario adds an assertion v1 did not have: that Media Type is **absent** from the
Authorized Paper Out event.

That is the actual substance of the acceptance criterion, whose Jira text reads *"Currently, Media
Type is logged in Additional Information for the Authorized Paper Out event. This should be moved to
the Submitted Paper Out event."* A scenario that only checked the Submitted event would pass just as
happily if the value were written to **both** — which is precisely the defect the criterion exists to
prevent.

Confirmed live: the Authorized event's Additional Information reads
`Batch Name=PROBE-TS003-CHECK, Verifier=Nitin Saini (…)` — no Media Type segment. The Submitted event
for the same batch reads `Batch Name=…, ID=…, Media Type=…`.

## Open questions

**CLR-TP-EC-12000-002** — *Should the cover-page clause be split into its own MANUAL_ONLY scenario,
as proposed here?* The evidence is above.

- Answer **yes**: three of the four surfaces become automated immediately, and the cover page is
  executed by a human against a real Authorized batch.
- Answer **no**: TS-EC-12000-016 stays exactly as v1 wrote it and remains permanently un-passable,
  unless you also nominate a fixture collection that the framework is permitted to consume via
  Verify. Please name it explicitly if so — the agent must not choose one.

**CLR-TP-EC-12000-003** — *Which specific pre-deployment transaction or document should
`TS-EC-12000-017` use?* It needs a Paper Out record created **before** this change shipped, so that
it can be shown not to have been retroactively given a Media Type. No such record is reachable: the
fixture document and four further collections were scanned on 2026-09-14, and every Submitted Paper
Out event carries a Media Type — because every one of them originates from this automation run.

One trap worth stating plainly: **Canceled** Paper Out events legitimately carry no Media Type
segment. So "find any Paper Out event without a Media Type" is **not** a safe proxy for "find a
pre-change record". It would pass for entirely the wrong reason, and it would keep passing straight
through a real regression. This scenario needs a named record from someone with qa5 history, or it
should be explicitly **DEFERRED**.

## What these scenarios deliberately do not assert

- **That the cover page is correct.** TS-EC-12000-020 is `MANUAL_ONLY`. Until a human executes it and
  records the result, `AC-EC-12000-016` is only partially covered and must not be reported as met.
- **That pre-deployment records were left untouched.** No scenario asserts this today.
- **Any wording, layout or labelling on the cover page.** It has never been observed, so nothing
  about its presentation is asserted.
- **That the downloaded report is well-formed.** TS-EC-12000-016 asserts the report contains the
  Media Type and Paper Out entries. It does not validate the PDF's structure, rendering or pagination.
- **That the transaction-level history report shows Paper Out.** It does not, as observed; only the
  document-level report (`getHistoryReport.eo`) carries the entries, and that is the one the
  scenario uses.
- Any message string not approved at this gate. An `OBSERVED` string records what the application
  does today, not what it should do.

## Risks

| ID | Level | Risk |
| --- | --- | --- |
| RISK-TP-EC-12000-005 | MEDIUM | `AC-EC-12000-016` is now covered by one automated plus one manual scenario. If the manual one is never executed, coverage reporting shows the AC as partially covered indefinitely. That is the honest reading and must not be rounded up to met. |
| RISK-TP-EC-12000-006 | LOW | TS-EC-12000-016 needs an already-Authorized batch in order to read the Authorized event. qa5 currently has exactly one (`PROBE-TS003-CHECK`). If it is verified or removed, that half of the scenario loses its fixture and must be re-blocked rather than quietly dropped. |

RISK-TP-EC-12000-001 through -004 are unchanged from v1 and are not re-opened here.

**Test-account safety.** Unchanged from v1. No scenario in this revision submits a wrong credential,
so none can contribute to an account lockout. TS-EC-12000-016 submits a real Paper Out request and
cancels it afterwards, exactly as the already-approved TS-EC-12000-003 does.

**Data note.** Every Paper Out submission permanently appends an event to the fixture document's
history. Cancellation releases the transaction lock but cannot remove the logged event. This is
inherent to the application, applies equally to the scenarios already approved in v1, and is not
introduced by this revision.

## How to record your decision

A chat message is not an approval. Only a schema-valid artifact on disk counts.

1. Copy `test-plans/generated/TP-EC-12000-001-v2-approval.template.json` to
   `test-plans/approved/TP-EC-12000-001-approval.json`.
2. Set `decision`, and one entry in `itemDecisions` per scenario listed in the template.
3. Fill in `reviewer.name`, `reviewer.role` and `reviewedAt` (ISO 8601, UTC).
4. Answer **CLR-TP-EC-12000-002** and **CLR-TP-EC-12000-003** in `comments`.
5. Run `npm run validate:artifacts`.

`artifactVersion` in the approval must be **2** to bind to this revision. The approval currently on
disk is for v1 and does not carry forward — that is deliberate, and it is why this file exists.

Once the approval artifact is on disk, the orchestrator promotes
`test-plans/generated/TP-EC-12000-001.json` to `test-plans/approved/TP-EC-12000-001.json` and
proceeds to BDD_DESIGN.

**This revision re-opens Gate 3 for the affected scenarios only.** TS-EC-12000-016's Gherkin must be
regenerated to match the revised plan, and TS-EC-12000-020 needs no feature file because it is
manual. The fifteen unaffected scenarios keep their existing Gate 3 approval and are not touched.
