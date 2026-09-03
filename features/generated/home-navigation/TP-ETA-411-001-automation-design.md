# Automation design — TP-ETA-411-001

| | |
| --- | --- |
| **Story** | ETA-411 — Create tests to use Home screen icons |
| **Release** | 1.0 |
| **Capability** | `home-navigation` |
| **Test plan** | [test-plans/approved/TP-ETA-411-001.json](../../../test-plans/approved/TP-ETA-411-001.json) v1, approved at Gate 2 |
| **Feature file** | [features/generated/home-navigation/home-icon-navigation.feature](home-icon-navigation.feature) |
| **Specification** | [openspec/changes/add-home-navigation/specs/home-navigation/icon-navigation/spec.md](../../../openspec/changes/add-home-navigation/specs/home-navigation/icon-navigation/spec.md) |

## 1. Starting point

Nine approved scenarios, one per approved acceptance criterion. Every scenario needs an
authenticated session, so this capability starts where `account-access` finishes. The existing
organization sign-in automation is reused, not reimplemented — `TS-ETA-411-001` is the only scenario
that exercises signing in as behaviour; the other eight consume it as a precondition.

## 2. Feature design

One feature file, `home-icon-navigation.feature`. Eight `Scenario` blocks and one `Scenario Outline`.

The outline is `TS-ETA-411-006`. `AC-ETA-411-006` says *any* Home page icon, so the outline walks all
three return legs through an Examples table rather than walking one and inferring two. One scenario
id, three executions — the RTM records the criterion once and the evidence three times.

Nothing else uses an outline. The remaining eight differ in meaning, not in data.

## 3. Step vocabulary

Eleven steps. Six are new, and `Given the eCore Command Center login page is open` plus
`When I sign in with correct organization details` already exist in
[steps/organization-sign-in.steps.ts](../../../steps/organization-sign-in.steps.ts) and are reused
verbatim.

| Step | Used by |
| --- | --- |
| `Given the eCore Command Center login page is open` | TS-001 — reused |
| `When I sign in with correct organization details` | TS-001 — reused |
| `Then I arrive at the eCore Command Center Home page` | TS-001, TS-006 — reused |
| `Given I am signed in as an organization user on the eCore Command Center Home page` | eight scenarios — new |
| `When I look at the icons offered on the Home page dashboard` | TS-002 — new |
| `Then three icons are offered, named New Transaction, Workspace and Preferences` | TS-002 — new |
| `And each of the three icons can be activated` | TS-002 — new |
| `When I activate the {word} icon on the Home page dashboard` | TS-003/004/005 — new, parameterised |
| `When I activate the {word} link in the header navigation bar` | TS-008/009 — new, parameterised |
| `Then I arrive at the {} page` | TS-003/004/005/008/009 — new, parameterised |
| `When I activate the Command Center control in the upper left corner` | TS-006 — new |

The two activation steps are **deliberately separate**. Collapsing them into one parameterised step
would make the entry point a data value, and the entry point is the whole difference between
`TS-ETA-411-003` and `TS-ETA-411-008`. Two steps that read differently are the cheapest guard
against those two silently becoming one test.

## 4. Proposed layers

| Layer | File | Owns |
| --- | --- | --- |
| Feature | `features/generated/home-navigation/home-icon-navigation.feature` | Behaviour only |
| Steps | `steps/home-icon-navigation.steps.ts` | Orchestration only |
| Page | `src/pages/ecore-home.page.ts` — **exists, extend** | Dashboard icons, header links, Command Center control |
| Page | `src/pages/ecore-new-transaction.page.ts` — new | New Transaction page identity |
| Page | `src/pages/ecore-workspace.page.ts` — new | Workspace page identity |
| Page | `src/pages/ecore-preferences.page.ts` — new | Preferences page identity |
| Service | `src/services/organization-login.service.ts` — **exists, reuse** | Authenticated session |
| Fixture | `src/fixtures/test.ts` — extend | Register the three new page objects |

The three destination page objects are thin — two of them can assert nothing but their address. They
exist anyway so that when a unique element is eventually found, there is one place to put it.

## 5. Locator status

Everything here is `MCP_VALIDATION_REQUIRED` until `PLAYWRIGHT_VALIDATION` confirms it. What
reconnaissance observed is recorded below as a starting hypothesis, not as a validated locator.

| Element | Observed hypothesis | Status |
| --- | --- | --- |
| Dashboard icons | Scoped within `#icon-buttons` | `MCP_VALIDATION_REQUIRED` |
| Header links | `a#header.new_transaction`, `a#header.workspace` | `MCP_VALIDATION_REQUIRED` |
| Command Center control | `div#bannerBackground.clickable`, 216×45 at (5,5) | `MCP_VALIDATION_REQUIRED` |
| New Transaction page | "Create Transaction" heading | `MCP_VALIDATION_REQUIRED` |
| Workspace page | Address only — no unique element found | `MCP_VALIDATION_REQUIRED` |
| Preferences page | Address only — no unique element found | `MCP_VALIDATION_REQUIRED` |

Two of these will need a written waiver rather than an accessible locator:

**The Command Center control** exposes no text, no alt text, no title and no accessible name. It is a
`div` with a CSS background image. There is no `getByRole` or `getByLabel` route to it, so it needs a
`VALIDATED -` comment recording that no accessible alternative exists. `AMB-ETA-411-005` accepted the
control as it stands, so this is a locator concession, not a silent lowering of the bar.

**The dashboard icons** must be scoped to `#icon-buttons`. An unscoped accessible-name lookup for
"New Transaction" resolves to both the icon and the header link and fails with a strict-mode
violation — this was observed during reconnaissance, not predicted.

## 6. The trap this design is built around

The header repeats two of the three icon names. Three ways that hurts, in increasing order of how
long it would take to notice:

1. **An unscoped locator throws.** Loud, immediate, harmless. This already happened.
2. **A locator scoped by convenience resolves to the wrong one of the two.** `TS-ETA-411-003` passes
   while exercising the header link. Two criteria report as covered; one actually is.
3. **The two step definitions get merged during a tidy-up.** Same outcome as (2), but now it looks
   intentional.

`PLAYWRIGHT_VALIDATION` must confirm the icon locator and the header locator resolve to **different
elements**, and record both. That check is the single most valuable thing that stage does here.

## 7. Ambiguities and what may resolve them

| ID | Status | Resolvable by observation? |
| --- | --- | --- |
| `AMB-ETA-411-001` … `005` | `RESOLVED` at Gate 1 | — |
| `AMB-ETA-411-006` | `REVIEW_REQUIRED` | **No.** Whether the menu link labelled "Organization" counts as a header route to Preferences is a question about intent, not markup. Walking the link would show where it goes, not whether it counts. |

While `AMB-ETA-411-006` is open, Preferences has one route and the other two destinations have two.
No scenario may be added to close that gap.

## 8. Data and safety

No fabricated test data is required, because there are no negative paths. Every scenario signs in
with correct details from `env.requireEcoreLogin()`, so no failed-attempt counter is touched and this
suite cannot lock the account out.

Destination addresses live in the page objects, never in the feature file and never in a step.

## 9. Execution shape

Sequential within the capability. `TS-ETA-411-006` navigates away and back three times, so it must
not share a page context with a scenario that assumes it is still on Home.

If the qa host is unreachable, results are `BLOCKED` with the host named. A blocked scenario is never
reported as passed and never filed as a defect.

## 10. What this design does not prove

- **The two header destinations.** `TS-ETA-411-008` and `TS-ETA-411-009` are written against link
  addresses. Until `PLAYWRIGHT_VALIDATION` walks them, they are expectations, not observations.
- **That the icon set is the same for every user.** One account was observed. `RISK-TP-ETA-411-004`.
- **Anything about failure.** No negative scenarios exist, by design. `RISK-TP-ETA-411-008`.
- **That `TS-ETA-411-004` and `TS-ETA-411-005` reached a working page.** They assert an address. A
  page that arrives and then fails to render will pass. `RISK-TP-ETA-411-002`.
