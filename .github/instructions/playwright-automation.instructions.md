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

Only the Playwright Test Planner, using Playwright MCP against the real application, may replace an
`MCP_VALIDATION_REQUIRED` locator with a validated one. If the application contradicts an approved
expectation, **record the mismatch and return to the owning approval gate** — never silently change
the expectation.

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
