# Approval Gate 2 — Test Plan Review — TP-ETA-411-001 v1

**Story:** ETA-411 — Create tests to use Home screen icons
**Capability:** `home-navigation` · **Release:** 1.0 · **Plan:** [test-plans/generated/TP-ETA-411-001.json](../../test-plans/generated/TP-ETA-411-001.json)
**Prepared by:** sdd-workflow-orchestrator · **Status:** PENDING_TEST_PLAN_APPROVAL

Seven scenarios covering the seven acceptance criteria approved at Gate 1. Six positive, one negative.
Nothing in this plan creates, changes or deletes application data.

Approving this plan authorises the framework to design automation against it. It does **not**
authorise the automation itself — that is Gate 3.

---

## 1. What this plan covers, and what it deliberately leaves uncovered

Gate 1 approved 7 of the 10 acceptance criteria. The other 3 are DEFERRED, and this plan maps **no
scenario** to them. That is the point, not an oversight: leaving them unmapped is what makes the RTM
report their requirements as *partially* covered rather than met.

| Requirement | Covered by | Status after this plan |
| --- | --- | --- |
| REQ-ETA-411-001 (only authorized modules) | AC-001 → TS-001, TS-002, TS-003, TS-005 | **PARTIAL** — the word *only* is an absence claim carried by DEFERRED AC-002 |
| REQ-ETA-411-002 (Dashboard navigation) | AC-003 → TS-002 | Covered |
| REQ-ETA-411-003 (menu navigation) | AC-004 → TS-003, AC-005 → TS-004 | Covered |
| REQ-ETA-411-004 (Organization, Vault under Preferences) | AC-006 → TS-005 | Covered |
| REQ-ETA-411-005 (Command Center returns Home) | AC-007 → TS-006 | Covered |
| REQ-ETA-411-006 (UI/API consistency) | — | **UNCOVERED** — DEFERRED at Gate 1 |
| REQ-ETA-411-007 (prevent unauthenticated/unauthorized) | AC-009 → TS-007 | **PARTIAL** — the unauthorized half (AC-010) cannot be produced this release |

If this plan runs green, three requirements are still not fully proven. Please read the coverage
figure that way.

---

## 2. Scenario-by-scenario

| ID | Scenario | Type | AC | Suite | Interface |
| --- | --- | --- | --- | --- | --- |
| TS-ETA-411-001 | The six named modules are offered to a signed-in Organization user | POSITIVE | AC-001 | smoke | UI |
| TS-ETA-411-002 | The Dashboard icons open New Transaction, Workspace and Preferences | POSITIVE | AC-003 | critical | UI |
| TS-ETA-411-003 | The navigation menu opens Home, New Transaction and Workspace | POSITIVE | AC-004 | critical | UI |
| TS-ETA-411-004 | Preferences is offered in the menu with Organization and Vault beneath it | POSITIVE | AC-005 | regression | UI |
| TS-ETA-411-005 | Organization and Vault open their own pages from beneath Preferences | POSITIVE | AC-006 | regression | UI |
| TS-ETA-411-006 | Command Center returns the user to the Home page from each module | POSITIVE | AC-007 | regression | UI |
| TS-ETA-411-007 | An unauthenticated visitor is refused a module and kept on the sign-in page | NEGATIVE | AC-009 | critical | UI |

**Why TS-002 and TS-003 are separate scenarios.** New Transaction and Workspace each appear twice on
the Home page — once as a Dashboard icon, once in the navigation menu. Merging them would force the
automation to disambiguate by position, which this framework forbids. Splitting by entry point lets
each scenario scope to one container, and it means a broken Dashboard icon cannot be masked by a
working menu entry.

**Why TS-001 maps to four scenarios in the coverage table.** AC-001 claims the six modules are
present *and* can be opened. TS-001 proves presence; opening is proven by TS-002, TS-003 and TS-005.
Mapping AC-001 to TS-001 alone would claim more than that one scenario checks.

---

## 3. Two observations from the walked evidence that shape the plan

**Organization and the Preferences icon reach the same address.** Both resolve to
`/ssweb/setup/prefs/preferences.eo`. TS-005 therefore asserts arrival on **page content**, never on
the address. An address-only assertion would pass today and would keep passing if the two were ever
wrongly wired to the same page — the failure would be invisible. Recorded as
`CLR-TP-ETA-411-003` and `RISK-TP-ETA-411-001`. If you believe this shared destination is itself a
defect, say so here; the plan does not decide that.

**Command Center has no accessible name.** It is a `div` with a background image, no text, no
`title`, no `aria-label`. TS-006 depends on it, so the automation will need a `VALIDATED` locator
waiver at Gate 3. Whether the missing accessible name is a defect worth raising is your call, not
the framework's. Recorded as `CLR-TP-ETA-411-004` and `RISK-TP-ETA-411-002`.

---

## 4. Open questions — the two this gate exists to settle

**CLR-TP-ETA-411-001 — the interface judgement.** Every scenario is declared `interfaceType: UI`.
The workflow requires this to be put to you rather than decided silently, because it is a testing
judgement and not something ETA-411 states. The basis is two pieces of recorded evidence: the walk
in [ETA-411-navigation-validation.json](../../reports/validation/ETA-411-navigation-validation.json)
found all six destinations to be full document requests to `.eo` pages, and
[ecore-api-discovery.json](../../reports/validation/ecore-api-discovery.json) records that eCore has
no REST resource model. **Do you agree no acceptance criterion in scope is API-verifiable this
release?**

**CLR-TP-ETA-411-002 — the unauthenticated message.** TS-007 asserts that an error message is
present and that the sign-in page is still displayed. It does **not** assert what the message says.
The exact string will be captured at PLAYWRIGHT_VALIDATION as `OBSERVED`. Asserting a captured
string would make whatever eCore emits today the definition of correct: if that message is itself
wrong, or later regresses to a different wrong message, the test would have to be edited to stay
green and would never report the defect. **Do you accept the presence-only assertion for this
version?** If you later want the wording asserted, that is a new plan version with the string
approved here first.

---

## 5. What these scenarios deliberately do not assert

- That the thirteen navigable destinations ETA-411 does not name are hidden. The account can reach
  nineteen; the story names six. Verifying six exist proves nothing about the other thirteen.
- Any relationship between the UI and a supporting API. Deferred, and doubly blocked — there may be
  no distinct API layer at all, and anything found by observation is `OBSERVED` and may never judge
  an acceptance criterion.
- That an authenticated but unauthorized user is refused. With scope narrowed to the six modules
  this account is authorized for, there is no unauthorized module left to request.
- That Preferences opens a page of its own from the menu. Per your answer in AMB-ETA-411-007 it is a
  grouping, so TS-004 checks presence. The Dashboard Preferences icon is a separate thing and does
  navigate — that is TS-002.
- The wording of any error message.

---

## 6. Risks

| ID | Level | Risk |
| --- | --- | --- |
| RISK-TP-ETA-411-001 | HIGH | Organization and the Preferences icon share a destination; an address-only assertion would pass while showing the wrong page. |
| RISK-TP-ETA-411-002 | MEDIUM | Command Center has no accessible name and cannot be reached by a preferred locator. |
| RISK-TP-ETA-411-003 | MEDIUM | New Transaction and Workspace each match twice unscoped, failing Playwright strict mode. |
| RISK-TP-ETA-411-004 | MEDIUM | A full pass here can be misread as full requirement coverage; three requirements stay partial. |
| RISK-TP-ETA-411-005 | MEDIUM | The negative scenario could drift into asserting today's error text and thereby entrench it. |

Note on account safety: no scenario in this plan enters a wrong credential. The negative path is
unauthenticated, so nothing here can contribute to an eCore account lockout.

---

## 7. How to record your decision

A chat message is not an approval. Copy the template, fill it in, and save it to the approved path:

1. Copy [test-plans/generated/TP-ETA-411-001-approval.template.json](../../test-plans/generated/TP-ETA-411-001-approval.template.json)
   to `test-plans/approved/TP-ETA-411-001-approval.json`.
2. Replace `decision` with `APPROVE`, `REJECT`, `DEFER` or `REQUEST_CHANGES`, and set the same for
   each of the seven `itemDecisions`.
3. Fill in `reviewer.name`, `reviewer.role` and `reviewedAt` (ISO 8601, UTC).
4. Answer CLR-TP-ETA-411-001 and CLR-TP-ETA-411-002 in `comments`.
5. Run `npm run validate:artifacts`.

`artifactVersion` in the approval is `1` and must match the plan. If the plan changes after you
approve it, the version moves and the approval no longer binds — that is deliberate.

Once the approval artifact is on disk, the orchestrator promotes the plan to
`test-plans/approved/TP-ETA-411-001.json` and proceeds to BDD_DESIGN.
