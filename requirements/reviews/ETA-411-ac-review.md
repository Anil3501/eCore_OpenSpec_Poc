# Gate 1 review — ETA-411 acceptance criteria

| | |
| --- | --- |
| Story | ETA-411 — Create tests to use Home screen icons |
| Status in Jira | Open (reopened 2026-09-04, ETA-164 parent link removed) |
| Release / capability | 1.0 / home-navigation |
| Artifact under review | [requirements/normalized/ETA-411.json](../normalized/ETA-411.json) v1 |
| Approve by editing | [ETA-411-ac-approval.template.json](ETA-411-ac-approval.template.json) → save as `requirements/approved/ETA-411-ac-approval.json` |
| Validation at time of writing | 15 passed, 0 failed, 3 skipped |

**Nothing in this package is approved. A chat message is not an approval.** Only the saved,
schema-valid approval artifact unlocks the next stage.

---

## What you are being asked to approve

7 requirements produced 10 acceptance criteria. **7 are put forward for approval; 3 are put forward
as deferred.** Please decide all 10 — a `DEFER` you did not explicitly make is not a decision.

### Put forward for approval

| AC | Requirement | Behaviour | Evidence |
| --- | --- | --- | --- |
| `AC-ETA-411-001` | REQ-001 | Six named modules are present and can be opened | Probe |
| `AC-ETA-411-003` | REQ-002 | Dashboard offers New Transaction, Workspace, Preferences; each opens | Walked |
| `AC-ETA-411-004` | REQ-003 | Menu offers Home, New Transaction, Workspace; each opens | Walked |
| `AC-ETA-411-005` | REQ-003 | Preferences is offered in the menu, Organization and Vault beneath it | Probe |
| `AC-ETA-411-006` | REQ-004 | Organization and Vault open their pages | Probe |
| `AC-ETA-411-007` | REQ-005 | Command Center returns the user to Home | Walked |
| `AC-ETA-411-009` | REQ-007 | Unauthenticated visitor gets an error and stays on the sign-in page | **Your statement — not yet observed** |

"Walked" means a real click was performed and the destination recorded in
[reports/validation/ETA-411-navigation-validation.json](../../reports/validation/ETA-411-navigation-validation.json).
"Probe" means the element was observed in
[reports/validation/ETA-411-home-icons-probe.json](../../reports/validation/ETA-411-home-icons-probe.json)
but the interaction was not walked end to end.

### Put forward as deferred

| AC | Requirement | Why it cannot be met this release |
| --- | --- | --- |
| `AC-ETA-411-002` | REQ-001 | The **absence** half. No organization→module mapping exists |
| `AC-ETA-411-008` | REQ-006 | You deferred the definition of "consistent" (`AMB-005`) |
| `AC-ETA-411-010` | REQ-007 | Scope narrowed to modules the account **is** authorized for, so no unauthorized module remains to request |

---

## Coverage this produces — please read before approving

Approving this package does **not** give ETA-411 full coverage, and the artifact will not claim it
does.

| Requirement | Coverage | Why |
| --- | --- | --- |
| REQ-001 | **PARTIAL** | Presence of six modules is tested. "Only" is an absence claim and is not |
| REQ-002 | FULL | |
| REQ-003 | FULL | Split across `AC-004` and `AC-005` |
| REQ-004 | FULL | |
| REQ-005 | FULL | |
| REQ-006 | **UNCOVERED** | Deferred entirely |
| REQ-007 | **PARTIAL** | Unauthenticated only; unauthorized is unproducible |

The application offers this account **nineteen** navigable destinations. The ticket names six.
Confirming six are present says nothing about whether the other thirteen should have been hidden.
That gap is the substance of REQ-001, and it is being deferred, not satisfied.

---

## Three things to check rather than wave through

**1. `AC-009` records your expectation, not an observation.**
You stated an unauthenticated visitor is shown an error and stays on the sign-in page — and
punctuated it with a question mark. It is recorded as your expectation and will be checked against
the application at `PLAYWRIGHT_VALIDATION`. If eCore does something else, that is reported as a
mismatch; the expectation will **not** be quietly rewritten to match. If you were asking rather than
telling, mark this one `REQUEST_CHANGES`.

**2. `AC-005` asserts presence, not navigation.**
You said the menu displays Preferences. The probe records no navigable link with that label — only
Organization and Vault beneath what appears to be a group heading. Both are true if Preferences is a
heading. So the criterion asserts it is *offered*, not that it *opens a page*. If you intended
Preferences to be clickable, mark this `REQUEST_CHANGES` — it would then be a product defect and no
test should be written that passes today.

**3. The ticket says top-*right*; you said top-*left*.**
The criteria follow the ticket. Menu position is a locator concern owned by the page object and does
not change the behaviour asserted, but the discrepancy is recorded rather than silently resolved.

---

## Ambiguities — all seven closed

Recorded as answered by you in chat on 2026-09-05. `resolvedBy` records
`Anil.Maddhesia@wolterskluwer.com`, taken from the git commit author on this branch because no name
was supplied when asked. **If that is not you, correct it in your approval comments.**

| | Status | Outcome |
| --- | --- | --- |
| `AMB-001` | RESOLVED | Genuine reopening; standalone story. Jira comments excluded as POC-progress notes |
| `AMB-002` | RESOLVED | Verify the six named modules only; REQ-001 partial |
| `AMB-003` | RESOLVED | "Supporting APIs" = whatever is called navigating the six links; `OBSERVED` only |
| `AMB-004` | RESOLVED | Unauthenticated → error + stays on sign-in; unauthorized unproducible |
| `AMB-005` | DEFERRED | "Consistent" undefined; REQ-006 uncovered |
| `AMB-006` | RESOLVED | Dashboard = Home page = Command Center page, one screen |
| `AMB-007` | RESOLVED | Verify only ticket items; Preferences treated as present, not navigable |

---

## Two constraints the planner inherits

- **The Command Center control has no accessible name** — no text, no `aria-label`, no `title`, no
  `role`; it is a `div` with a background image. It cannot be reached by `getByRole`, so its locator
  will need a `VALIDATED -` waiver under `SEM-AUTOMATION-HYGIENE`.
- **`Organization` and the Dashboard `Preferences` icon resolve to the same destination.** Arrival
  must be asserted on page content, not on destination alone, or the two criteria cannot be told
  apart.

---

## How to approve

1. Copy [ETA-411-ac-approval.template.json](ETA-411-ac-approval.template.json) to
   `requirements/approved/ETA-411-ac-approval.json`.
2. Replace every `REPLACE_WITH_*` placeholder. Each of the 10 criteria needs its own decision:
   `APPROVE`, `REJECT`, `DEFER` or `REQUEST_CHANGES`.
3. Run `npm run validate:artifacts`.

Only items with an item-level `APPROVE` flow downstream. `REJECT`, `DEFER` and `REQUEST_CHANGES`
are excluded and recorded in the RTM with that status.
