# Approval Gate 3 — Automation Design Review — TP-ETA-411-001

**Story:** ETA-411 — Create tests to use Home screen icons
**Capability:** `home-navigation` · **Release:** 1.0
**Approved plan:** [test-plans/approved/TP-ETA-411-001.json](../../../test-plans/approved/TP-ETA-411-001.json) · **Plan version:** 1
**Feature file:** [features/generated/home-navigation/home-screen-navigation.feature](home-screen-navigation.feature)

---

## What you are being asked to approve

One feature file, `home-screen-navigation.feature`, containing seven scenarios — one per approved
test scenario, `TS-ETA-411-001` through `-007`. All seven are UI. None creates, changes or deletes
application data.

The file sits in `features/generated/`, which `bddgen` does not compile. Only `features/approved/`
is compiled, so nothing here is executable until this gate is recorded. Approving moves the file to
`features/approved/home-navigation/` and authorises implementation of the page objects and steps it
needs.

This approval binds to plan version 1. If the plan changes, the version moves and this approval
stops applying.

## Scenario-by-scenario design

**TS-ETA-411-001 — The six named modules are offered to a signed-in Organization user**
(covers `AC-ETA-411-001`, UI, `@risk-medium @suite-smoke`)

Presence only. The six names are a Gherkin data table rather than six separate `Then` lines, so a
seventh module being added to the story is a one-row edit and the step definition never grows.

Needs: `HomePage` (Dashboard region), `NavigationMenuComponent`, `OrganizationLoginService`.

**TS-ETA-411-002 — The Dashboard icons open New Transaction, Workspace and Preferences**
(covers `AC-ETA-411-003`, UI, `@risk-high @suite-critical`)

The return to Home between icons is deliberately *not* performed with Command Center. Command Center
is the subject of TS-ETA-411-006, and using it here would make that scenario's evidence circular —
a broken Command Center would fail two scenarios and neither would tell you which control was at
fault. The step navigates to Home directly instead.

Needs: `HomePage`, `NewTransactionPage`, `WorkspacePage`, `PreferencesPage`.

**TS-ETA-411-003 — The navigation menu opens Home, New Transaction and Workspace**
(covers `AC-ETA-411-004`, UI, `@risk-high @suite-critical`)

Kept separate from TS-002 because New Transaction and Workspace are reachable from both the
Dashboard and the menu. Merged, a working menu entry could mask a broken Dashboard icon.

Needs: `NavigationMenuComponent`, `HomePage`, `NewTransactionPage`, `WorkspacePage`.

**TS-ETA-411-004 — Preferences is offered in the navigation menu with Organization and Vault grouped beneath it**
(covers `AC-ETA-411-005`, UI, `@risk-medium @suite-regression`)

A presence check by design. The owner confirmed at Gate 1 (`AMB-ETA-411-007`) that Preferences is a
heading over two entries, not a destination, so asserting that it opens a page would go beyond both
the story and the evidence.

Needs: `NavigationMenuComponent`.

**TS-ETA-411-005 — Organization and Vault open their own pages from beneath Preferences**
(covers `AC-ETA-411-006`, UI, `@risk-high @suite-regression`)

Arrival is asserted on **page content, never on the address**. Organization resolves to
`/ssweb/setup/prefs/preferences.eo`, the same address the Dashboard Preferences icon reaches, so a
URL assertion would pass while showing the wrong page — and would keep passing if the two were ever
wrongly wired together.

Needs: `NavigationMenuComponent`, `OrganizationPage`, `VaultPage`.

**TS-ETA-411-006 — Command Center returns the user to the Home page from each module**
(covers `AC-ETA-411-007`, UI, `@risk-high @suite-regression`)

Home is confirmed after each module rather than once at the end, so a single failing module is
identifiable from the failure alone.

Needs: `CommandCenterComponent`, `HomePage`, and the five module pages.

**TS-ETA-411-007 — An unauthenticated visitor is refused a module and kept on the sign-in page**
(covers `AC-ETA-411-009`, UI, `@risk-high @suite-critical`)

Two assertions only: a message is present, and the visitor was not admitted. **No credential is
entered at any point**, so this scenario cannot contribute to an eCore account lockout.

It requires a browser context carrying no stored session. The feature file has **no `Background`**
for exactly this reason — a shared `Given I am signed in` would sign the visitor in before the
scenario began and the test would pass while proving nothing.

Needs: `SignInPage`, and a fixture guaranteeing an unauthenticated context.

## Locators and contracts

No API contracts. Every scenario is UI, so nothing is marked `API_CONTRACT_UNVERIFIED`.

| Element | Basis | Status |
| --- | --- | --- |
| Dashboard icons: New Transaction, Workspace, Preferences | observed on the Home page | `MCP_VALIDATION_REQUIRED` |
| Navigation menu trigger and entries | observed top-right | `MCP_VALIDATION_REQUIRED` |
| Organization and Vault, grouped beneath Preferences | observed in the menu | `MCP_VALIDATION_REQUIRED` |
| Command Center | `div#bannerBackground.clickable`, background image, **no accessible name** | `MCP_VALIDATION_REQUIRED` — will need a `VALIDATED -` waiver |
| Sign-in page error message | not yet captured | `MCP_VALIDATION_REQUIRED` |

**Every locator in this design is unvalidated.** They come from the ETA-411 probe reports
([ETA-411-home-icons-probe.json](../../../reports/validation/ETA-411-home-icons-probe.json),
[ETA-411-navigation-validation.json](../../../reports/validation/ETA-411-navigation-validation.json)),
which recorded that the elements exist and where they lead — not that a particular Playwright
locator resolves to them. `PLAYWRIGHT_VALIDATION` runs after this gate and confirms each one against
the running application. Approving here means approving the *behaviour*, with the locators still to
be proven.

One waiver is already known to be needed: Command Center has no text, no `title` and no
`aria-label`, so no accessible locator can reach it and a string selector with a `VALIDATED -`
comment is the only compliant option. Whether that missing accessible name is itself a defect worth
raising is your call, not the framework's.

No `waitForTimeout` is planned, so no `JUSTIFIED-WAIT:` waiver is expected.

## Open questions

**Q1 — the Command Center waiver.** Are you content to approve automation that reaches a control by
CSS id because the application gives it no accessible name? The alternative is to raise it as an
accessibility defect first and wait.

**Q2 — TS-ETA-411-006 module list.** The plan says "from each module reached in this plan". I have
read that as the five non-Home modules: New Transaction, Workspace, Preferences, Organization and
Vault. If you meant a shorter list, say so — this is my reading of the plan, not something the plan
states explicitly.

## What this automation deliberately does not assert

- That any module *outside* the six named ones is hidden. `AC-ETA-411-002` is DEFERRED, so
  `REQ-ETA-411-001` stays partially covered even with all seven scenarios green.
- Any relationship between the UI and a supporting API (`AC-ETA-411-008`, DEFERRED).
- That an authenticated but unauthorized user is refused (`AC-ETA-411-010`, DEFERRED — the account
  is authorized for all six modules, so no unauthorized module exists to request).
- The **wording** of the unauthenticated error message. Asserting today's string would make whatever
  eCore currently emits the definition of correct.
- That Preferences opens a page of its own from the menu. It is a grouping.

## Risks

| ID | Level | Risk |
| --- | --- | --- |
| RISK-TP-ETA-411-001 | HIGH | Organization shares a destination with the Preferences icon; an address-only assertion would pass while showing the wrong page. Mitigated by asserting page content in TS-005. |
| RISK-TP-ETA-411-002 | MEDIUM | Command Center has no accessible name; needs a string-selector waiver, which is more brittle than an accessible locator. |
| RISK-TP-ETA-411-003 | MEDIUM | New Transaction and Workspace each match twice unscoped, failing Playwright strict mode. Mitigated by scoping each step to its container. |
| RISK-TP-ETA-411-004 | MEDIUM | A full pass can be misread as full requirement coverage; three requirements stay partial. |
| RISK-TP-ETA-411-005 | MEDIUM | The negative scenario could drift into asserting today's error text and thereby entrench it. |

## How to record your decision

A chat message is not an approval. Only a schema-valid artifact on disk counts.

1. Copy `features/generated/home-navigation/TP-ETA-411-001-automation-approval.template.json` to
   `features/approved/home-navigation/TP-ETA-411-001-automation-approval.json`.
2. Set `decision`, and one entry in `itemDecisions` per scenario.
3. Fill in `reviewer.name`, `reviewer.role` and `reviewedAt` (ISO 8601, UTC).
4. Answer Q1 and Q2 in `comments`.
5. Run `npm run validate:artifacts`.

That template is produced by the next stage, `AUTOMATION_REVIEW_PACKAGE`. Once the approval artifact
exists, the feature file moves to `features/approved/home-navigation/` and becomes executable. A file
still carrying `MCP_VALIDATION_REQUIRED` fails the build once it backs approved automation, so those
markers must be resolved at `PLAYWRIGHT_VALIDATION` before any test runs.
