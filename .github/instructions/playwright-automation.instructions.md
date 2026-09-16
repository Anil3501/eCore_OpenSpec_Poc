---
description: "Use when writing Gherkin feature files, playwright-bdd step definitions, page objects, components, fixtures or Playwright config. Covers strict layering, accessible locators, MCP_VALIDATION_REQUIRED markers and Node 24 TypeScript constraints."
name: "Playwright-BDD automation layering"
applyTo: ["features/**", "steps/**", "src/pages/**", "src/components/**", "src/fixtures/**", "src/services/**", "src/api/**", "src/models/api/**", "test-data/**", "playwright.config.ts", "tests/**"]
---

# Playwright-BDD automation layering

## TypeScript constraints (these are compile errors, not style)

- Relative imports **must** include the `.ts` extension: `import { env } from '../utils/env.ts'`.
  Node 24 native type-stripping is the runtime; there is no bundler.
- `erasableSyntaxOnly: true` — **parameter properties are forbidden**:

  ```ts
  // WRONG - TS1294
  constructor(private readonly page: Page) {}

  // RIGHT
  private readonly page: Page;
  constructor(page: Page) { this.page = page; }
  ```
- Also forbidden by the same flag: `enum`, namespaces, and constructor overloads.

## Layer responsibilities

| Layer | May contain | Must never contain |
| --- | --- | --- |
| `.feature` | Business behaviour in domain language | Selectors, URLs, page-object method names, technical steps, status codes, JSON |
| `steps/` | Page-object, API-client and service calls | Locators, hard-coded data, assertions on raw DOM, raw HTTP calls, multi-page workflows |
| `src/pages/` | Locators, interactions, page-scoped assertions | Business data, credentials, cross-page navigation chains |
| `src/api/` | Endpoints, headers, request/response shaping | Absolute URLs, `process.env`, business assertions, secrets |
| `src/models/api/` | Zod response contracts | Endpoints, request logic |
| `src/components/` | Genuinely reused cross-page widgets | Single-use wrappers created "for symmetry" |
| `src/fixtures/` | Composition of page objects, API clients, env and services | New browser/context/page creation, hard-coded secrets |
| `src/services/` | Test-data resolution and reusable business flows | Secrets — those come from `env` at runtime |
| `test-data/` | Fabricated inputs, one `<capability>.sample.json` per capability | Any real credential or production value |

Do not create a component object unless the widget is genuinely reused. Over-abstraction is a defect.

## API clients

**An API client is the API's page object.** A page object owns locators; an API client owns
endpoints. Neither leaks upward — a step definition calls `accountApi.signIn(...)` exactly as it
calls `loginPage.signIn(...)`, and never issues a request itself.

Extend `ApiClient` in [src/api/api-client.ts](../../src/api/api-client.ts). It supplies URL
resolution from `API_BASE_URL`, status assertion against the approved contract, and full-body
contract parsing.

**Parse the whole response against its Zod contract. Never spot-check fields.** Asserting three
fields and ignoring forty is the API equivalent of a test that passes because it never looked.

**Never guess an endpoint, field name or status code.** An unverified contract stays marked
`API_CONTRACT_UNVERIFIED` until the planner confirms it against real traffic or an OpenAPI document.
The marker is allowed while generating, and **fails the build** once the file backs Gate 3 approved
automation — the same rule as `MCP_VALIDATION_REQUIRED`.

**Never put a response body in an error message.** It can carry the very token or personal data the
framework is forbidden to log.

Enforced by `SEM-AUTOMATION-HYGIENE` over `src/api`:

| Rule | Waiver |
| --- | --- |
| `HARDCODED_URL` — absolute `http(s)://` literal | none |
| `DIRECT_ENV_READ` — `process.env.*` instead of `env` | none |
| `DESTRUCTIVE_CALL` — `.delete()` / `.put()` against a shared environment | `CLEANUP - <strategy>` |
| `DESTRUCTIVE_PATH` — an endpoint named `delete`/`remove`/`void`/`destruct`/`purge`/`revoke`/`transfer`, whatever the verb | `CLEANUP - <strategy>` |
| `HARD_WAIT` — `waitForTimeout()` | `JUSTIFIED-WAIT:` |
| `DISABLED_TEST` — `test.skip/fixme/slow()` | none |

## Locators

Preference order: `getByRole` → `getByLabel` → `getByPlaceholder` → `getByText` → `getByTestId`.

**Banned:** XPath, `nth()`-based selection, long CSS descendant chains, and `page.waitForTimeout()`.
Use web-first assertions (`await expect(locator).toBeVisible()`) for synchronisation.

These are **enforced**, not advisory. `SEM-AUTOMATION-HYGIENE` (`npm run validate:automation`)
scans `src/pages`, `src/components`, `src/services`, `src/fixtures` and `steps` and fails the build
on XPath, `.nth()` / `:nth-child()`, `waitForTimeout()`, `test.skip/fixme/slow()`, and any
string-selector `.locator('…')` or `getByTestId()`.

Two of those rules accept a **waiver comment** directly above the line. A waiver does not switch the
rule off — it forces the reason into the file, where a reviewer can see it:

```ts
// VALIDATED - no accessible name exists on this control; `#loginType` is the
// most stable handle available. This is an application accessibility gap.
private get loginKindSelect(): Locator {
  return this.page.locator('#loginType');
}
```

- `VALIDATED -` waives `RAW_LOCATOR` (a string selector or `getByTestId`), and is the marker the
  Playwright Test Planner already writes when it confirms a locator through Playwright MCP.
- `JUSTIFIED-WAIT:` waives `HARD_WAIT`. Reach for it only when there is genuinely no observable
  state to assert on; a web-first assertion is almost always available.

XPath, positional selection and disabled tests have **no waiver**. Long CSS descendant chains stay a
review matter — they are not mechanically detectable without false positives.

**Never guess a locator against an application you have not inspected.** Mark every unverified
locator and stop:

```ts
// MCP_VALIDATION_REQUIRED - accessible name not confirmed
private get usernameField(): Locator {
  return this.page.getByLabel('Username');
}
```

The marker is expected while automation is being generated. It becomes a **build failure** once the
file backs Gate 3 approved automation, so an unvalidated locator can never reach an approved suite.

Only the orchestrator, driving Playwright MCP directly against the real application (the
`playwright-test` tool family: `browser_navigate`, `browser_snapshot`, `browser_click`,
`browser_type`, `browser_select_option`, `browser_network_requests`), may replace an
`MCP_VALIDATION_REQUIRED` locator or `API_CONTRACT_UNVERIFIED` contract with a validated one. If the
application contradicts an approved expectation, **record the mismatch and return to the owning
approval gate** — never silently change the expectation.

**MCP exploration playbook** (PLAYWRIGHT_VALIDATION / IMPLEMENTATION): `browser_navigate` to the
approved flow's start (reuse a captured session via `npm run capture:session` for an authenticated
flow — a live password must never pass through an MCP tool argument) → `browser_snapshot` to read
the real accessibility tree before writing any locator → drive the approved steps with
`browser_click` / `browser_type` / `browser_select_option` / `browser_wait_for` → for a HYBRID/API
scenario, read `browser_network_requests` / `browser_network_request` to observe the real calls
(`contractSource: OBSERVED`, never a guess) → only then replace the placeholder and add the
`VALIDATED -` waiver comment. Do this against the specific approved scenario only; never explore
speculative behaviour the plan does not already describe.

## Multi-candidate discovery helpers

A step file sometimes has to find *which* of several live candidates (a collection, a saved search,
a queue item) currently qualifies for a scenario, rather than being told which one to use. This
pattern is legitimate — see `resolveOpenCancelCollectionName`, `resolveSecondaryOpenCancelCollectionName`
and `resolveSubmittableCollectionName` in
[steps/paper-out-media-type.steps.ts](../../steps/paper-out-media-type.steps.ts) — but it has two
rules of its own.

**A candidate is eligible only once real content, not container chrome, has been asserted.**
Confirmed live against qa5 on 2026-09-16: the application reuses the exact same dialog title for its
real modal and for an unrelated error response (a locked-transaction rejection). A `try`/`catch`
loop that only asserts a dialog/role/title is visible will silently accept a candidate that is
actually ineligible — and because the wrong one gets cached, every later scenario that reuses the
cached choice fails for a reason that has nothing to do with what it is testing. Always assert a
piece of content that exists **only** on the genuine success state (a specific section heading, a
field, a value) before treating a candidate as usable. This is enforced by `SEM-DISCOVERY-SIGNAL`
(`npm run validate:automation`), which flags a discovery-style `try { expectOpen(); ... } catch` loop
that never asserts anything beyond opening the container.

**An ineligible candidate must be disqualified quickly, not by absorbing a default action timeout.**
A `.check()`/`.click()`/`.fill()` call against a locator that does not exist on the rejected state
does not fail instantly — it polls for Playwright's default actionability timeout (~30s) before the
surrounding `catch` ever runs. Multiply that by several rejected candidates in one discovery loop and
an otherwise-healthy scenario can exceed its test timeout. Put the cheapest content assertion
(`expect(...).toBeVisible()` on the distinguishing element) **before** any interaction call, so a bad
candidate is rejected in milliseconds, not tens of seconds per candidate.

**Caching the resolved candidate for the rest of the worker's run is intentional, not a shortcut to
be "fixed."** `resolveOpenCancelCollectionName` and `resolveSubmittableCollectionName` cache their
result in a module-level variable so a discovery loop that may try every candidate in the pool only
pays that cost once per run, not once per scenario. The trade-off this accepts: if the environment's
state changes *after* the cache is populated (a fixture appears, a collection becomes locked), the
cached choice is not re-validated. That is acceptable because every candidate is re-screened by the
content assertion above on the one occasion the cache is populated — it is not acceptable to add a
second, uncached discovery path "to be safe," since that reintroduces the exact per-scenario cost the
cache exists to avoid.

## Configuration and secrets

- Import `env` from `src/utils/env.ts`. **Never touch `process.env` directly.**
- Require values lazily inside the method that needs them (`env.requireBaseUrl()`,
  `env.requireCredentials()`, `env.requireEcoreLogin()`) so scaffolding and validation work with an
  empty `.env`.
- Never log, assert on, or embed a credential in an error message. Error text names variables only.
- `PLAYWRIGHT_BASE_URL` currently points at the application **login page**, not a site root. Do not
  append a hard-coded path to it.
- **A negative scenario must never use the real account.** The eCore login page warns that an
  account can lock out after a configured number of incorrect attempts, so wrong-credential and
  missing-field paths use fabricated values from `test-data/<capability>.sample.json`
  (`dataClassification: SYNTHETIC_INPUTS`). Only the happy path calls `env.requireEcoreLogin()`.
  See [src/services/organization-login.service.ts](../../src/services/organization-login.service.ts).

## Feature files

Every scenario needs all six traceability tag prefixes, or `SEM-FEATURE-TAGS` fails:

```gherkin
@release-1.0 @capability-account-access @ETA-351 @tp-TP-ETA-351-001
Feature: ...

  @req-REQ-ETA-351-001 @ac-AC-ETA-351-001 @ts-TS-ETA-351-001
  Scenario: ...
```

Feature and scenario names must match the approved test plan. A scenario may only exist if its
`TS-*` id appears in an approved plan, and **a business scenario must never be duplicated** as a
plain Playwright spec — `SEM-NO-DUPLICATES` fails.

## Workflow

- `features/approved/**` is the only input to `bddgen`. `features/generated/**` holds design
  packages awaiting Gate 3.
- Run `npm run bdd` after changing a feature or step file, then `npx playwright test --list` to
  confirm discovery.
- **Never edit `.features-gen/`** — it is regenerated on every run.
- `tests/seed.spec.ts` is the Playwright Test Generator's seed. It must use framework fixtures and must
  assert no business behaviour.
