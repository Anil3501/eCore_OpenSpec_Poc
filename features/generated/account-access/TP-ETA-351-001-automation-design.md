# Automation design — TP-ETA-351-001

| Field | Value |
| --- | --- |
| Test plan | `TP-ETA-351-001` v1, approved at Gate 2 on 2026-08-31 |
| Feature file | [features/generated/account-access/organization-sign-in.feature](organization-sign-in.feature) |
| Jira story | [ETA-351](https://eoriginal.atlassian.net/browse/ETA-351) |
| Release / capability | 1.0 / `account-access` |
| Gate | Awaiting `AUTOMATION_DESIGN` (Gate 3 of 3) |

---

## 1. Starting point

The repository contains **no automation for this story**. `src/pages`, `src/services`, `steps/`,
`features/` and `test-data/` were emptied before this run. Everything below is to be created, not
modified. The only existing automation asset is [src/fixtures/test.ts](../../../src/fixtures/test.ts),
which currently exposes `environment` and `browserCoverage` and is story-agnostic.

## 2. Feature design

One feature file, eight scenarios, one per approved test scenario. Scenario titles match
`TP-ETA-351-001` exactly, so the plan and the feature file can be diffed mechanically.

A `Background` holds the single shared precondition — the login page being open. Choosing the
organization sign-in kind is **not** in the Background, because two scenarios
(`TS-ETA-351-001`, `TS-ETA-351-002`) must observe the page *before* any choice is made. Pushing that
step into the Background would have destroyed the very ordering `AC-ETA-351-001` asserts.

Tags: the four story-level tags sit on the `Feature`, and `@req-`, `@ac-`, `@ts-`, `@risk-` and
`@suite-` sit on each scenario. `SEM-FEATURE-TAGS` treats feature tags as inherited, so all six
required prefixes resolve for every scenario.

## 3. Step vocabulary

Eleven steps cover all eight scenarios. Reuse is high because the negative scenarios differ only in
the data they supply.

| Step | Used by |
| --- | --- |
| `Given the eCore Command Center login page is open` | all (Background) |
| `Given I have chosen to sign in on behalf of my organization` | TS-004…008 |
| `When I look at the page before entering any details` | TS-001 |
| `When I examine the sign-in kinds the page offers` | TS-002 |
| `When I choose to sign in on behalf of my organization` | TS-003 |
| `When I type the secret that proves who I am` | TS-004 |
| `When I sign in with correct organization details` | TS-005 |
| `When I sign in with organization details that are wrong` | TS-006, TS-008 |
| `When I sign in leaving required organization details out` | TS-007, TS-008 |
| `And I remember how the application responded` | TS-008 |
| `And I return to the login page and choose to sign in on behalf of my organization` | TS-008 |

No step names a field, a control or a selector. `TS-ETA-351-008` reuses the two failure steps rather
than duplicating them, and adds only the two steps that make the comparison possible.

## 4. Why `TS-ETA-351-008` looks different

It is the only scenario that performs two sign-in attempts. `AC-ETA-351-008` asserts a
*relationship* between two responses, which no single attempt can demonstrate. The scenario captures
the first response, produces the second, and compares them.

The comparison must be made on something observable that is **not** the message text, because exact
wording is out of scope. What that observable is remains open as `AMB-ETA-351-003` and is resolved at
`PLAYWRIGHT_VALIDATION`, not here.

## 5. Proposed layers

| Layer | File | Responsibility |
| --- | --- | --- |
| Page object | `src/pages/ecore-login.page.ts` | Locators for the sign-in kind control, the organization detail fields, the submit control and whatever conveys a failure. Page-scoped assertions only. |
| Page object | `src/pages/ecore-home.page.ts` | A single arrival assertion for the Home page. Nothing else — permission behaviour is out of scope. |
| Service | `src/services/organization-login.service.ts` | Resolves which detail set a scenario uses: real credentials from `env.requireEcoreLogin()` for the happy path, fabricated values from test data for every failure path. |
| Steps | `steps/organization-sign-in.steps.ts` | Orchestration only. Calls page objects and the service; holds no locator and no literal data. |
| Fixtures | `src/fixtures/test.ts` | Registers the two page objects and the service alongside the existing `environment` and `browserCoverage` fixtures. |
| Test data | `test-data/account-access.sample.json` | `dataClassification: SYNTHETIC_INPUTS`. Fabricated invalid and partial detail sets. Never a real value. |

No component object is proposed. Nothing here is a genuinely reused cross-page widget, and inventing
one for symmetry would be over-abstraction.

## 6. Locator status — every locator is currently unknown

**No locator in this design has been verified.** The application has not been opened. Every locator
will be written with an `MCP_VALIDATION_REQUIRED` marker and must be replaced by the Playwright Test
Planner using Playwright MCP against the real page before the suite can be approved. That marker is
a build failure once a file backs Gate 3 approved automation, so an unverified locator cannot reach
an approved suite even by accident.

Preference order remains `getByRole` → `getByLabel` → `getByPlaceholder` → `getByText` →
`getByTestId`. XPath, positional selection and `waitForTimeout` are unavailable and have no waiver.

## 7. Ambiguities and what may resolve them

| ID | Blocks | Resolvable by observation? |
| --- | --- | --- |
| `AMB-ETA-351-001` field set for organization sign-in | TS-003, and the shape of test data | Yes |
| `AMB-ETA-351-002` how the sign-in kind is declared | TS-001, TS-002, TS-003 | Yes |
| `AMB-ETA-351-003` observable difference between the two failures | TS-006, TS-007, TS-008 | Yes |
| `AMB-ETA-351-005` which details are mandatory | TS-007 | Yes |
| `AMB-ETA-351-004` does "treated as a secret" mean only concealment | TS-004 | **No — business intent** |
| `AMB-ETA-351-006` is permission-dependent behaviour in scope | TS-005 | **No — scope** |
| `CLR-TP-ETA-351-001` REQ-ETA-351-004 has no criterion | — | **No — governance** |

### A trap worth naming

`src/utils/env.ts` defines an `EcoreLogin` shape with five fields: login type, username,
organization, organization id and password. It is tempting to read that as the answer to
`AMB-ETA-351-001`.

**It is not.** Environment configuration records what someone once wired up. It is not a business
rule, it carries no approval, and the story does not mention it. `AMB-ETA-351-001` stays
`REVIEW_REQUIRED` until the real page is observed or a human answers it. If the observed page
disagrees with that interface, the interface is what is wrong.

## 8. Data and safety

Only `TS-ETA-351-005` uses the real account, via `env.requireEcoreLogin()`. Every other scenario —
including `TS-ETA-351-004`, which types a secret but never submits it — uses fabricated values.

This matters more than the story admits. The login page warns that an account can lock after a
number of incorrect attempts. `TS-ETA-351-006`, `TS-ETA-351-007` and `TS-ETA-351-008` submit failing
attempts, and `TS-ETA-351-008` submits two on its own. Pointing those at the real account would risk
locking the only credential the capability has. Account lockout is listed out of scope by the story,
but a locked account does not care what the story says.

Credentials are read through `env` at run time. They appear in no artifact, no feature file, no test
data file and no log.

## 9. Execution shape

- `features/approved/**` is the only input to `bddgen`. This file stays in `features/generated/`
  until Gate 3 clears.
- After approval: `npm run bdd`, then `npx playwright test --list` to confirm all eight scenarios
  are discovered before any run.
- No plain Playwright spec may duplicate a business scenario — `SEM-NO-DUPLICATES` enforces it, and
  `tests/seed.spec.ts` must keep asserting no business behaviour.

## 10. What is not proven

- **The application has never been opened in this run.** Every locator, every field name and every
  failure signal is unknown.
- **VPN access to the qa host is unconfirmed.** If it is unavailable at `PLAYWRIGHT_VALIDATION`, the
  correct outcome is an `ENVIRONMENT_BLOCKER` — never a healed test and never a filed bug, because a
  failure that never reached the application proves nothing about it.
- **No step definition or page object exists yet.** This document is a design, not an implementation.
