# Approval Gate 2 — Test Plan Review — TP-EC-12000-001 v1

| | |
| --- | --- |
| Test plan | `TP-EC-12000-001`, artifactVersion 1 |
| Story | EC-12000 — Phase 2_04: Improve Paper Out/Export to track if saving digital or papering out |
| Release / capability | 26.3 / paper-out-export |
| Source | [requirements/approved/EC-12000.json](../../requirements/approved/EC-12000.json) v2 (approved at Gate 1 by Anil, Reviewer) and [openspec/changes/track-paper-out-media-type/](../../openspec/changes/track-paper-out-media-type/) |
| Scenarios | 19, one per approved acceptance criterion |
| Decision needed | APPROVE / REJECT / DEFER / REQUEST_CHANGES, overall and per scenario |

Approving this plan authorises the framework to design automation against it. It does **not**
authorise the automation itself — that is Gate 3.

---

## 1. What this plan covers, and what it deliberately leaves uncovered

| Requirement | Covered by | Status after this plan |
| --- | --- | --- |
| REQ-EC-12000-001 (Media Type section renders) | TS-001 | Covered |
| REQ-EC-12000-002 (acknowledgement modal + Work Queue) | TS-002, TS-003, TS-004 | Covered |
| REQ-EC-12000-003 (eoRequestExport schema tolerance) | TS-005, TS-006 | **Cannot be judged by an executed test yet** — see §2 |
| REQ-EC-12000-004 (Media Type determination logic) | TS-007–TS-015 | UI half (TS-007–010) covered; API half (TS-011–015) **cannot be judged by an executed test yet** — see §2 |
| REQ-EC-12000-005 (audit logging, non-retroactive) | TS-016, TS-017 | Covered |
| REQ-EC-12000-006 (Verify Paper Out checkbox verbiage) | TS-018 | Covered |
| REQ-EC-12000-007 (cosmetic border alignment) | TS-019 | `MANUAL_ONLY` — inherently visual, no automated assertion |

If every UI scenario in this plan passes, six of the seven requirements are genuinely proven end to
end. **REQ-EC-12000-003 and the API half of REQ-EC-12000-004 are not** — six scenarios (TS-005,
TS-006, TS-011–015) exist in the plan to reserve their place, but none of them can execute an
assertion until `eoRequestExport`'s contract is captured. That gap does not close at this gate; it
is what §2 asks you to approve keeping open a stage longer.

## 2. Open questions — the eoRequestExport contract gap and CLR-TP-EC-12000-001 (RESOLVED)

**Decision recorded at this gate (reviewer Anil):** TS-005/006 stay pure **API** (they assert only
on the `eoRequestExport` request/response itself — accept/reject behaviour). TS-011 through TS-015
are **HYBRID**: the API call sets the Media Type, but the only currently-confirmed way to observe
what got recorded is the UI audit trail (per AC-016), so each of those five scenarios now also opens
the Submitted Paper Out audit trail entry in the UI to confirm the value. If `PLAYWRIGHT_VALIDATION`
later confirms a verified read API exists, this may be revisited.

`eoRequestExport` does not appear anywhere in
[reports/validation/ecore-api-discovery.json](../../reports/validation/ecore-api-discovery.json) —
not in `observedEndpoints`, not even in `declaredButNotObserved`. It is not "unconfirmed"; this
framework has never seen it at all.

Per `AMB-EC-12000-002`'s resolution (your answer: *mark it OBSERVED / API_CONTRACT_UNVERIFIED,
captured via Playwright MCP at PLAYWRIGHT_VALIDATION*), the six API scenarios below are written with:

- `interfaceType: API`
- `apiContract.contractSource: UNVERIFIED`
- A clearly-labelled placeholder `path` (never a guessed real-looking endpoint) and `method: POST`,
  justified by this repository's own documented finding that every `.eo` AJAX call is a
  form-encoded `POST` — not invented for this ticket.
- `automationDecision: REVIEW_REQUIRED` — none of them is scheduled for automation yet.

**What approving this plan means for these six scenarios:** you are agreeing that TS-005, TS-006 and
TS-011–015 stay in the plan as placeholders, that no endpoint/status code is guessed anywhere, and
that `PLAYWRIGHT_VALIDATION` is the only stage allowed to turn `UNVERIFIED` into an observed
contract — which still requires a human to promote it to `HUMAN_APPROVED` (with a recorded
`responseShapeHash`) before any of these six can back an acceptance criterion. Approving the plan
today does **not** mark REQ-EC-12000-003/004(API) as tested; it only unlocks scaffolding the
scenario shells so `PLAYWRIGHT_VALIDATION` has something to observe against.

**If you disagree with the interface split above**, mark the affected scenarios `REQUEST_CHANGES`
and say what interface type or contract source you want used instead. Nothing will be authored
against a guessed contract either way.

## 3. Scenario-by-scenario

| Scenario | AC | Type | Interface | Automation decision | Suite |
| --- | --- | --- | --- | --- | --- |
| TS-EC-12000-001 — Media Type section renders, Print to Paper default | AC-001 | POSITIVE | UI | AUTOMATE | smoke |
| TS-EC-12000-002 — Save as Electronic File + required fields opens gated acknowledgement modal | AC-002 | POSITIVE | UI | AUTOMATE | smoke |
| TS-EC-12000-003 — Confirming acknowledgement modal closes both modals, creates Work Queue item | AC-003 | POSITIVE | UI | AUTOMATE | regression |
| TS-EC-12000-004 — Cancelling acknowledgement modal leaves Paper Out modal open, no Work Queue item | AC-004 | NEGATIVE | UI | AUTOMATE | regression |
| TS-EC-12000-005 — eoRequestExport with no mediaType accepted unchanged | AC-005 | POSITIVE | API | REVIEW_REQUIRED | — |
| TS-EC-12000-006 — eoRequestExport rejects mediaType values other than PrintToPaper/SaveAsElectronicFile | AC-006 | NEGATIVE | API | REVIEW_REQUIRED | — |
| TS-EC-12000-007 — UI Print to Paper, transaction level → Media Type Paper | AC-007 | POSITIVE | UI | AUTOMATE | regression |
| TS-EC-12000-008 — UI Print to Paper, document level → Media Type Paper | AC-008 | POSITIVE | UI | AUTOMATE | regression |
| TS-EC-12000-009 — UI Save as Electronic File, transaction level → Media Type Electronic | AC-009 | POSITIVE | UI | AUTOMATE | regression |
| TS-EC-12000-010 — UI Save as Electronic File, document level → Media Type Electronic | AC-010 | POSITIVE | UI | AUTOMATE | regression |
| TS-EC-12000-011 — API mediaType=PrintToPaper, transaction level → Media Type Paper (confirmed via UI audit trail) | AC-011 | POSITIVE | HYBRID | REVIEW_REQUIRED | — |
| TS-EC-12000-012 — API mediaType=PrintToPaper, document level → Media Type Paper (confirmed via UI audit trail) | AC-012 | POSITIVE | HYBRID | REVIEW_REQUIRED | — |
| TS-EC-12000-013 — API mediaType=SaveAsElectronicFile, transaction level → Media Type Electronic (confirmed via UI audit trail) | AC-013 | POSITIVE | HYBRID | REVIEW_REQUIRED | — |
| TS-EC-12000-014 — API mediaType=SaveAsElectronicFile, document level → Media Type Electronic (confirmed via UI audit trail) | AC-014 | POSITIVE | HYBRID | REVIEW_REQUIRED | — |
| TS-EC-12000-015 — API call omitting mediaType entirely → Media Type Electronic (confirmed via UI audit trail) | AC-015 | POSITIVE | HYBRID | REVIEW_REQUIRED | — |
| TS-EC-12000-016 — Media Type appears as Additional Information on Submitted Paper Out event | AC-016 | POSITIVE | UI | AUTOMATE | regression |
| TS-EC-12000-017 — Historical records are not retroactively updated with Media Type | AC-017 | NEGATIVE | UI | AUTOMATE | regression |
| TS-EC-12000-018 — Verify Paper Out modal checkbox reads updated verbiage | AC-018 | POSITIVE | UI | AUTOMATE | regression |
| TS-EC-12000-019 — Paper Out Request modal right-side borders are visually aligned | AC-019 | POSITIVE | UI | MANUAL_ONLY | — |

One acceptance criterion maps to exactly one scenario throughout — the criteria in EC-12000 are
already scenario-shaped (each names one precondition, one action, one observable outcome), so no
splitting or merging was needed.

## 4. What these scenarios deliberately do not assert

| Left abstract / deferred | Because |
| --- | --- |
| The exact navigation path for a Collections-initiated Paper Out | `AMB-EC-12000-001` resolved (accordion → Batch → Paper Out Request, same modal) but not yet confirmed against the running application — validated at `PLAYWRIGHT_VALIDATION` before automation asserts it |
| Any `eoRequestExport` request/response field beyond `mediaType` | No authoritative contract exists; asserting undocumented fields would test this framework's guess, not the application |
| Pass/fail of TS-005, TS-006, TS-011–015 | `automationDecision: REVIEW_REQUIRED` — scaffolding only, per §2 |
| Visual alignment of TS-019 | Declared `MANUAL_ONLY`; inherently subjective, no automated assertion attempted |
| Any message string not explicitly named in an acceptance criterion | Would make an `OBSERVED` string the definition of correct rather than an approved requirement |

## 5. Risks

| ID | Level | Risk |
| --- | --- | --- |
| RISK-TP-EC-12000-001 | HIGH | `eoRequestExport` contract completely unverified (not even declared) — mitigated by keeping the six API scenarios `UNVERIFIED`/`REVIEW_REQUIRED` until Playwright MCP observation and human promotion |
| RISK-TP-EC-12000-002 | MEDIUM | Confirming the acknowledgement modal writes a real Work Queue approval item against shared QA data — mitigated by using only fabricated requester/approver test data (Requester: "Anil Kumar", Approver: logged-in user), and this write is the very behavior AC-003 requires verifying |
| RISK-TP-EC-12000-003 | MEDIUM | Moving Media Type logging from the Authorized to the Submitted Paper Out event could break pre-existing automation reading the old location — mitigated by TS-016/017 asserting the new location and non-retroactivity explicitly; any break in old automation is a review item at IMPLEMENTATION |
| RISK-TP-EC-12000-004 | LOW | Collections' reuse of the same modal is a human-supplied answer, not yet confirmed live — mitigated by Playwright MCP validation before automation relies on it |

No scenario submits a wrong credential; none of this plan's scenarios risk account lockout.

## 6. How to record your decision

Copy [test-plans/generated/TP-EC-12000-001-approval.template.json](TP-EC-12000-001-approval.template.json)
to `test-plans/approved/TP-EC-12000-001-approval.json`, replace the placeholders — including an
explicit answer to `CLR-TP-EC-12000-001` in `comments` — and save. Only scenarios carrying an
item-level `APPROVE` flow into `BDD_DESIGN`; anything else is recorded in the RTM with its decision
and is not built.

A message in chat is not an approval. The artifact on disk is.
