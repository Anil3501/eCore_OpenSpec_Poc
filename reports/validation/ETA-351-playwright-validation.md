# ETA-351 — Playwright Validation Report

| Field | Value |
| --- | --- |
| Workflow | `WF-ETA-351-R1.0` |
| Stage | `PLAYWRIGHT_VALIDATION` |
| Release / capability | `1.0` / `account-access` |
| Test plan | `TP-ETA-351-001` (approved, Gate 2) |
| Automation design | approved at Gate 3 (`APR-AD-ETA-351-001`) |
| Environment | `https://qa1.eoriginal.org:8443/ssweb/setup/showLogin.eo` |
| Date | 2026-08-27 |
| Status | **OBSERVED — proceed to `IMPLEMENTATION` with recorded discrepancies** |

## 1. How this validation was performed

The official Playwright MCP server exposed **no browser tools in this session**. Rather than guess
locators, the application was observed directly with scripted Playwright probes, which is the same
evidence in a different wrapper. Each probe writes a JSON record under `reports/validation/`.

| Probe | Script | Record |
| --- | --- | --- |
| Login page structure | [scripts/eta-351-login-probe.ts](../../scripts/eta-351-login-probe.ts) | `ETA-351-login-page-probe.json` |
| Sign-in behaviour | [scripts/eta-351-behaviour-probe.ts](../../scripts/eta-351-behaviour-probe.ts) | `ETA-351-behaviour-probe.json` |
| Omission shapes | [scripts/eta-351-missing-probe.ts](../../scripts/eta-351-missing-probe.ts) | `ETA-351-missing-details-probe.json` |
| Message containers | [scripts/eta-351-message-probe.ts](../../scripts/eta-351-message-probe.ts) | `ETA-351-message-probe.json` |

**Only fabricated credentials were submitted.** The real account was never used, because the
application's own message states that *"Your account may lock out after a configured number of
incorrect attempts."* The happy path (`TS-ETA-351-005`) was therefore **not** exercised during
validation and remains unproven until `EXECUTION`.

## 2. Observed page structure

Page title: `eOriginal Command Center™`. The configured base URL serves a browser-capability
interstitial that redirects to `/ssweb/setup/showLogin.eo`; a real browser is required.

**Default state — Business Entity Login is preselected:**

| Control | id | Accessible label |
| --- | --- | --- |
| `select` | `loginType` | — (options: `Organization Login`, `Business Entity Login`) |
| `input[text]` | `userName` | Username |
| `input[text]` | `businessEntity` | Business Entity |
| `input[password]` | `password` | Password |
| `input[submit]` | — | `Sign In` |

**After choosing `Organization Login`:**

| Control | id | Accessible label |
| --- | --- | --- |
| `select` | `loginType` | — |
| `input[text]` | `userName` | Username |
| `input[text]` | `orgName` | **Organization Name** |
| `input[password]` | `password` | Password |
| `input[submit]` | — | `Sign In` |

The `businessEntity` field is **replaced** by `orgName`. The page therefore does ask only for the
details relevant to the chosen kind, which is the behaviour `AC-ETA-351-003` describes.

## 3. Observed behaviour

| Submitted | Response |
| --- | --- |
| All three fields empty | Stays on page. `p#validateTips.darkRed` lists **`Username is required.` / `Organization Name is required.` / `Password is required.`** |
| Password omitted | `Password is required.` only |
| Organization Name omitted | `Organization Name is required.` only |
| All present, all wrong | Stays on page. A single message: *"Your login attempt failed. You may have entered one or more of your credentials incorrectly, or selected the incorrect Organization Login/Business Entity Login scope… Your account may lock out after a configured number of incorrect attempts…"* |

The two failure responses are **materially different in kind**, not merely in wording: omission
names the specific missing field; wrong details give one generic refusal that deliberately does not
reveal which detail was wrong. `AC-ETA-351-008` is observably satisfiable.

> An earlier behaviour probe reported *no* message for the empty submission. That was a probe
> defect — its selector list did not include `#validateTips`. It is recorded here because the
> corrected finding, not the first one, is the evidence. No defect was raised on the application.

## 4. Ambiguities resolved by observation

| Ambiguity | Outcome |
| --- | --- |
| `AMB-ETA-351-001` — which details are asked for | **Resolved.** Username, Organization Name, Password. Three details. |
| `AMB-ETA-351-002` — how the kind is declared | **Resolved.** A `select` with exactly two options, before any details are entered. |
| `AMB-ETA-351-003` — do the two failures differ | **Resolved.** Yes — per-field naming versus one generic refusal. |
| `AMB-ETA-351-005` — which details are mandatory | **Resolved.** All three. Enforced server-side, not by HTML `required`. |
| `AMB-ETA-351-004` — secret handling *intent* | **Partially.** Concealment on screen is confirmed (`input[type=password]`). The policy intent behind it stays a human question. |
| `AMB-ETA-351-006` — permission scope after sign-in | **Not resolved.** Requires the real account and a human decision. Still open. |
| `CLR-TP-ETA-351-001` — `REQ-ETA-351-004` has no AC | **Not resolved.** Human decision. Still open. |

Observation narrows what a question *could* mean. It does not answer a question about intent, and
none of the still-open items were closed by guessing.

## 5. Discrepancies — recorded, not silently corrected

**D-1 · `EcoreLogin` requires a detail the page never asks for.**
[src/utils/env.ts](../../src/utils/env.ts) declares `EcoreLogin` with five fields:
`loginType, username, organization, organizationId, password`. The Organization Login form asks for
**three**: `userName`, `orgName`, `password`. `organizationId` has no corresponding control.

This is a pre-existing scaffolding assumption, not an approved business rule — the automation
design already warned that environment configuration is not a source of requirements. The observed
page is authoritative. **`IMPLEMENTATION` must not invent a field to satisfy the interface, and must
not submit `organizationId` anywhere.** Whether to narrow the interface is a separate change and is
out of scope here.

**D-2 · Two `input[type=submit]` controls exist.** Values `Sign In` and `Submit`. Only `Sign In`
performs login. Any bare `input[type="submit"]` locator is a strict-mode violation. Page objects
must use `getByRole('button', { name: 'Sign In' })`.

**D-3 · Message containers carry no ARIA role or landmark.**

| Message | Container |
| --- | --- |
| Missing details | `p#validateTips.darkRed` → `span` per field |
| Wrong details | `.errorMessage` → `li` → `span` |

Neither exposes `role="alert"` or an accessible name, so `getByRole`/`getByLabel` cannot address
them. String selectors are genuinely unavoidable here and must carry a `VALIDATED -` comment
citing this report, per `SEM-AUTOMATION-HYGIENE`.

**No approved expectation was altered to match the application.** Where the two disagree, the
disagreement is written down above.

## 6. Validated locators for `IMPLEMENTATION`

| Purpose | Locator | Basis |
| --- | --- | --- |
| Sign-in kind | `getByLabel('Login Type')` unavailable → `locator('#loginType')` | `VALIDATED -` §2 |
| Username | `getByLabel('Username')` | accessible label observed |
| Organization Name | `getByLabel('Organization Name')` | accessible label observed |
| Password | `getByLabel('Password')` | accessible label observed |
| Sign In | `getByRole('button', { name: 'Sign In' })` | Playwright's own suggested locator |
| Missing-detail messages | `locator('#validateTips')` | `VALIDATED -` §5 D-3 |
| Failure message | `locator('.errorMessage')` | `VALIDATED -` §5 D-3 |

`#loginType` should be confirmed against `getByLabel` during implementation; if no accessible label
exists it stays a validated string selector.

**No `MCP_VALIDATION_REQUIRED` marker may survive into the implementation** — every locator above
is now backed by observation, and such a marker is a build failure in a file backing Gate 3
approved automation.

## 7. Scenario readiness

| Scenario | Ready | Note |
| --- | --- | --- |
| `TS-001` declare kind before details | Yes | Select present before any field is touched |
| `TS-002` both kinds offered | Yes | Exactly two options observed |
| `TS-003` asks org details only | Yes | `businessEntity` → `orgName` swap observed |
| `TS-004` secret not readable | Yes | `input[type=password]` |
| `TS-005` correct details → Home | **Unproven** | Not exercised; real account withheld to avoid lockout |
| `TS-006` wrong details refused | Yes | Message observed |
| `TS-007` missing details refused | Yes | Messages observed |
| `TS-008` responses differ | Yes | Both observed and materially different |

`TS-005` is the one scenario validation could not de-risk. It is honest to say so now rather than
discover it at `EXECUTION`.

## 8. Outcome

`PLAYWRIGHT_VALIDATION` is complete. No approved artifact was modified. Three discrepancies and two
still-open human questions are recorded above and carry forward.
