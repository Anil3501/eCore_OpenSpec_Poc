## Why

The eCore Command Center Home page is the entry point every organization user lands on after signing
in, and the icons it presents are the primary way users reach the rest of the application. ETA-411
defines that navigation behaviour, and nine acceptance criteria were approved at Gate 1
(`APR-AC-ETA-411-001`). None of them is currently specified, so there is no agreed statement of what
the Home page must offer, where each icon must lead, or how a user returns Home.

This change captures that approved behaviour as a specification, so the test plan and automation that
follow are derived from a spec rather than from a one-sentence Jira description.

## What Changes

- Introduce a specification for Home page icon navigation covering the nine approved acceptance
  criteria `AC-ETA-411-001` through `AC-ETA-411-009`.
- Specify that a successful organization sign-in places the user on the Home page.
- Specify that the Home page presents three activatable dashboard icons: New Transaction, Workspace
  and Preferences.
- Specify the destination each dashboard icon leads to, identified by the address of the destination
  page.
- Specify that the header navigation bar additionally offers New Transaction and Workspace links that
  duplicate two of those dashboard icons, and the destination each leads to.
- Specify that a Command Center control in the upper left corner returns the user from a destination
  page to the Home page.

No breaking change. This is a new capability with no existing spec to modify.

### Deliberately not specified

- **A header route to Preferences.** The header duplicates only two of the three dashboard icons.
  There is no header Preferences link. The single header-area route to the Preferences page is a menu
  link labelled "Organization", and whether that counts as a navigation route for this story is
  unresolved (`AMB-ETA-411-006`). Specifying it either way would invent a business rule, so this
  change specifies the asymmetry exactly as approved: two destinations with two routes each,
  Preferences with one.
- **Any accessible name for the Command Center control.** The control exposes none today. Gate 1
  accepted it as-is (`AMB-ETA-411-005`), so the spec states the navigation outcome and says nothing
  about how the control is labelled or exposed.
- **The wider navigation menu.** Roughly fifteen further destinations exist (Configuration Changes,
  eAsset® Analytics, Event Analytics, Infographics, Manage Scheduled Reports, Open Requests,
  Permission Analysis, Transaction Retention Analysis, User Activity Analysis, Vault Content,
  Organization, Vault, Tutorials, Support, About). `AMB-ETA-411-001` was resolved to exclude them.
- **What any destination page does.** This change specifies arrival at a destination, never the
  behaviour of the destination itself.
- **Any permission-dependent variation** in the icon set. Gate 1 recorded that the set is identical
  for all organization users (`AMB-ETA-411-003`); no criterion depends on role or configuration, and
  none is specified.
- **Sign-in mechanics**, which belong to `account-access/organization-login` and are not restated
  here.

## Capabilities

### New Capabilities
- `home-navigation/icon-navigation`: Home page navigation for eCore Command Center — the icons the
  Home page presents, the destination each one leads to, the header links that duplicate two of them,
  and the return to Home from a destination page.

### Modified Capabilities
<!-- None. No existing spec under openspec/specs/ changes. -->

## Impact

- **Traceability**: `traceability/capabilities/home-navigation.rtm.json` is created and gains
  `openSpecRefs` linking each of the nine acceptance criteria to its specification requirement.
- **Depends on**: `account-access/organization-login` establishes the authenticated session that this
  capability begins from. That spec is unchanged.
- **Downstream stages**: this spec becomes an input to `TEST_PLAN_GENERATION` (Gate 2) and, after
  approval, to BDD design and automation.
- **Carried into the test plan**: two destinations reached only by a header link (`AC-ETA-411-008`,
  `AC-ETA-411-009`) were approved on link-address evidence alone and were never navigated during
  reconnaissance. `PLAYWRIGHT_VALIDATION` must confirm both before any test asserts them.
