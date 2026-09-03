# TP-ETA-411-001 — Test Plan Review (Approval Gate 2)

| | |
| --- | --- |
| **Story** | ETA-411 — Create tests to use Home screen icons |
| **Release** | 1.0 |
| **Capability** | `home-navigation` |
| **Artifact under review** | [test-plans/generated/TP-ETA-411-001.json](TP-ETA-411-001.json) v1 |
| **Derived from** | [requirements/approved/ETA-411.json](../../requirements/approved/ETA-411.json), Gate 1 approval `APR-AC-ETA-411-001` |
| **Specification** | [openspec/changes/add-home-navigation/specs/home-navigation/icon-navigation/spec.md](../../openspec/changes/add-home-navigation/specs/home-navigation/icon-navigation/spec.md) |
| **Approval template** | [TP-ETA-411-001-approval.template.json](TP-ETA-411-001-approval.template.json) |
| **Approval must be saved to** | `test-plans/approved/TP-ETA-411-001-approval.json` |

## What this plan covers

Nine scenarios, one per approved acceptance criterion. Every criterion maps to exactly one scenario
and every scenario maps to exactly one criterion — no criterion is covered twice, none is uncovered.

| Scenario | Criterion | Asserts | Suite |
| --- | --- | --- | --- |
| TS-ETA-411-001 | AC-001 | Sign-in lands on Home | `suite-critical` |
| TS-ETA-411-002 | AC-002 | Three icons offered and activatable | `suite-smoke` |
| TS-ETA-411-003 | AC-003 | New Transaction icon → New Transaction page | `suite-critical` |
| TS-ETA-411-004 | AC-004 | Workspace icon → Workspace page | `suite-critical` |
| TS-ETA-411-005 | AC-005 | Preferences icon → Preferences page | `suite-critical` |
| TS-ETA-411-006 | AC-006 | Command Center returns Home from all three destinations | `suite-critical` |
| TS-ETA-411-007 | AC-007 | Header offers the two duplicate links | `suite-smoke` |
| TS-ETA-411-008 | AC-008 | Header New Transaction link → New Transaction page | `suite-regression` |
| TS-ETA-411-009 | AC-009 | Header Workspace link → Workspace page | `suite-regression` |

## Not all nine scenarios are equally strong

This is the part worth your attention. The scenarios look uniform in the table above and are not.

**Two rest on destinations nobody has visited.** TS-ETA-411-008 and TS-ETA-411-009 expect the header
links to reach the same pages as the dashboard icons. That expectation comes from the links' `href`
attributes. Neither link was ever activated during reconnaissance. An `href` is not proof of
navigation — a redirect, an interstitial or a permission check can intervene, and this application
already uses an interstitial on the login path. Approving these two commits the suite to expectations
that `PLAYWRIGHT_VALIDATION` may contradict. **`RISK-TP-ETA-411-001`.**

**Two can only assert an address.** TS-ETA-411-004 and TS-ETA-411-005 identify their destination by
its URL alone, because the Workspace and Preferences pages expose no unique on-screen element and
every page in the application returns the same browser title. A page that reaches the right address
and then renders an error, an empty result or a permission refusal will pass. You accepted this at
Gate 1 when you resolved AMB-ETA-411-002; it is restated here because it is the plan's most likely
source of a false green. Only TS-ETA-411-003 has a stronger assertion available, and it uses it.
**`RISK-TP-ETA-411-002`.**

**One assumption is untested by design.** TS-ETA-411-002 asserts the icon set as a fact about the
product, on the strength of your AMB-ETA-411-003 answer. One account was observed. Testing the claim
properly needs a second account with different permissions, which this plan does not have.
**`RISK-TP-ETA-411-004`.**

## Two things the plan deliberately does not do

**No negative scenarios.** All nine are `POSITIVE`. The story describes only successful navigation,
so there is no approved criterion saying what should happen when a destination is unavailable, a
session has expired, or a user lacks permission. The suite will prove that navigation works and prove
nothing about how it fails. Inventing a failure rule would breach Gate 1. If you want negative
coverage, a new criterion has to be approved first. **`RISK-TP-ETA-411-008`.**

**No header route to Preferences.** AMB-ETA-411-006 is still open. The header exposes no Preferences
link; the only header-area route to that address is a menu link labelled "Organization". So
Preferences has one planned route while New Transaction and Workspace have two. That asymmetry is
deliberate, not an oversight, and the plan states so in three places so nobody "corrects" it later.
**`RISK-TP-ETA-411-005`.**

## One practical trap flagged for implementation

The header repeats the names *New Transaction* and *Workspace*, so those accessible names resolve to
more than one element on the Home page. Reconnaissance hit exactly this — an unscoped lookup failed
with a strict-mode violation. If the icon scenarios and the header scenarios end up sharing a
locator, TS-ETA-411-003 and TS-ETA-411-008 become the same test wearing two identifiers, and the plan
would report two covered criteria where it has one. Every scenario therefore names which entry point
it uses, and `PLAYWRIGHT_VALIDATION` must confirm the two locators resolve to different elements.
**`RISK-TP-ETA-411-003`.**

## Safety

Every scenario signs in with correct details, so no failed-attempt counter is touched and this suite
cannot lock the account out. No fabricated test data is needed, because there are no negative paths.

## To approve

1. Copy [TP-ETA-411-001-approval.template.json](TP-ETA-411-001-approval.template.json) to
   `test-plans/approved/TP-ETA-411-001-approval.json`.
2. Replace every `REPLACE_WITH_*` placeholder. Set the top-level `decision` and one `decision` per
   scenario — `APPROVE`, `REJECT`, `DEFER` or `REQUEST_CHANGES`.
3. Answer the two questions in `comments`: whether TS-ETA-411-008 and TS-ETA-411-009 may proceed on
   unconfirmed destinations, and whether the Preferences route asymmetry is intended for this release.
4. Run `npm run validate:artifacts`.

Only scenarios carrying an item-level `APPROVE` flow into BDD design. Anything rejected, deferred or
returned for changes is excluded and recorded in the RTM with that status.
