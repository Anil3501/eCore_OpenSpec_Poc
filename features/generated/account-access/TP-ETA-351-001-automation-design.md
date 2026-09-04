# Automation design — TP-ETA-351-001 v2

| Field | Value |
| --- | --- |
| Test plan | `TP-ETA-351-001` **v2**, approved at Gate 2 on 2026-09-04 by Anil (Reviewer) |
| Feature file | [features/generated/account-access/organization-sign-in.feature](organization-sign-in.feature) |
| Jira story | ETA-351 |
| Release / capability | 1.0 / `account-access` |
| Gate | Awaiting `AUTOMATION_DESIGN` (Gate 3 of 3) |
| Previous approval | v1, approved 2026-08-31 by Nitin Saini |

---

## 1. Starting point — this is not a green field

The v1 design document opened by saying the repository contained no automation for this story. That
was true then. It is not true now, and repeating it would be the easiest lie in this package.

The automation exists, is approved, and passes:

| Asset | Role |
| --- | --- |
| [features/approved/account-access/organization-sign-in.feature](../../approved/account-access/organization-sign-in.feature) | 8 scenarios, business language only |
| [steps/organization-sign-in.steps.ts](../../../steps/organization-sign-in.steps.ts) | Orchestration only |
| [src/pages/ecore-login.page.ts](../../../src/pages/ecore-login.page.ts) | Login page locators |
| [src/pages/ecore-home.page.ts](../../../src/pages/ecore-home.page.ts) | Home page locators |
| [src/services/organization-login.service.ts](../../../src/services/organization-login.service.ts) | Sign-in journeys, real vs fabricated credential selection |
| [test-data/account-access.sample.json](../../../test-data/account-access.sample.json) | `SYNTHETIC_INPUTS` for every negative path |
| [src/fixtures/test.ts](../../../src/fixtures/test.ts) | `environment`, `browserCoverage`, `apiRequest` |

## 2. What actually changed between v1 and v2

**The automation design is unchanged. Nothing in it needs to be rebuilt.**

The chain behind it moved, but every link landed on the same value:

- The eight acceptance criteria were re-derived from a fresh Jira fetch and reproduced identically.
- The eight test scenarios were regenerated and are byte-identical to v1.
- The feature file was checked against the approved plan: the eight `@ts-` tags match the eight
  approved scenarios exactly and in order.

The one substantive delta is the interface declaration, and it is deliberately invisible in the code:

**The approved plan v2 declares every scenario `interfaceType: "UI"`, and no feature file or step
definition changes as a result.** Absence of an `@interface-` tag already means UI. Adding
`@interface-ui` would validate cleanly and would still be wrong — the compatibility rule exists so
that every feature file written before API support existed stays correct without being edited, and
the first file to break that rule teaches the next author to break it too.

So Gate 3 v2 is not asking you to approve new automation. It is asking you to confirm that automation
approved against plan v1 is still the right automation for plan v2.

## 3. The decision this package needs from you

The re-run was requested as a full reset "including automation". Carrying that out literally now
means **deleting working, approved, passing code and regenerating it from inputs that have not
changed**. Two honest options:

**Option A — confirm the existing automation (recommended).** Approve at Gate 3 v2. Nothing is
deleted. The automation is re-executed at the `EXECUTION` stage against the live application, which
is where a genuine regression would surface anyway. The re-run's value came from the requirement
stage, which reproduced independently and caught a real defect in the v1 review package.

**Option B — genuine regeneration.** `steps/organization-sign-in.steps.ts`, `src/pages/ecore-login.page.ts`,
`src/pages/ecore-home.page.ts`, `src/services/organization-login.service.ts` and the feature file are
deleted and rewritten. Every locator returns to `MCP_VALIDATION_REQUIRED` and must be re-validated
through Playwright MCP at `PLAYWRIGHT_VALIDATION`. The suite is red until that completes. This tests
the generator, not the application. It is recoverable — the current state is committed — but it is
still deletion of working code, so it will not happen without you saying so.

Mark this document `REQUEST_CHANGES` with "regenerate" if you want Option B.

## 4. Layering, unchanged and re-verified

- **Feature file**: business behaviour only. Scanned for locators, XPath, css, test ids and
  page-object calls — none found.
- **Steps**: orchestration only. No locators, no hard-coded data, no multi-page workflows.
- **Page objects**: own every locator. Accessible-role locators preferred; any string selector or
  `getByTestId` carries a `VALIDATED -` comment naming the observation that justified it.
- **No API client**: `src/api/` gains nothing from this story. The plan declares no API scenario, no
  endpoint was invented, and no `apiContract` was authored.

`npm run validate:artifacts` reports `SEM-AUTOMATION-HYGIENE` passing across 9 automation source
files and 2 approved feature files against 5 locator and wait rules.

## 5. Credential handling

Only `TS-ETA-351-005` uses the real organization account, through `env.requireEcoreLogin()`. Every
negative scenario draws fabricated values from `test-data/account-access.sample.json`, because the
login page warns that an account can lock out after a number of incorrect attempts. Lockout is out of
scope for the story; the risk to a shared QA account is not.

No credential appears in a feature file, a step definition, a page object or this document.

## 6. What is still unresolved

`AMB-ETA-351-001` through `AMB-ETA-351-006` remain `REVIEW_REQUIRED`. Neither Gate 1 nor Gate 2
answered them. The scenarios that depend on them stay abstract, and the automation asserts the
criterion rather than the mechanism it happened to observe.

## 7. How to record your decision

Copy [TP-ETA-351-001-automation-approval.template.json](TP-ETA-351-001-automation-approval.template.json)
to `features/approved/account-access/TP-ETA-351-001-automation-approval.json`, replace the
placeholders, and save. A message in chat is not an approval.
