# Jira Story Intake Standard — Writing a Story This Framework Can Automate Without Guessing

This document is for the **human writing the Jira story**, not for an agent authoring a governed
artifact. Its purpose is to stop `AMB-*` ambiguities and `MCP_VALIDATION_REQUIRED` /
`API_CONTRACT_UNVERIFIED` placeholders from ever being raised in the first place, by naming exactly
what information the framework needs *before* Stage 1 (`JIRA_RETRIEVAL`) begins.

It does not replace [README.md](../README.md) or [AGENTS.md](../AGENTS.md), which remain the
authority on architecture and rules. It also does not replace
[docs/framework-file-creation-sequence.md](framework-file-creation-sequence.md), which is the
authority on *what gets created and in what order*. This document only answers: **what must the
story itself already say, so none of that downstream work stalls on a question a human has to
answer mid-flight?**

Two real, unresolved ambiguities already on file make the cost concrete:
[requirements/approved/ETA-351.json](../requirements/approved/ETA-351.json) still carries
`AMB-ETA-351-004` (does concealing a password on screen also require blocking autocomplete/clipboard/
page-source exposure?) and `AMB-ETA-351-006` (does anything change by role/permission after Home?) —
both **DEFERRED**, both because the story never said. This standard exists so the next story doesn't
repeat that.

---

## Part 1 — Why the framework asks questions instead of assuming

Three non-negotiable rules (from [AGENTS.md](../AGENTS.md)) force an `AMB-*` the moment a story is
silent on something material:

| Rule | What it forbids | What it produces when the story is silent |
| --- | --- | --- |
| **Never invent a business rule** | An agent may not author a role, error message, limit, timeout, security policy, validation rule, integration behaviour, or regulatory requirement. | `AMB-<JIRA>-<nnn>` in `requirements/normalized/<JIRA-ID>.json`, blocking Gate 1 or carried forward `DEFERRED`. |
| **Never guess a locator or an API contract** | A UI locator stays `MCP_VALIDATION_REQUIRED`; an API endpoint, field name, or status code stays `API_CONTRACT_UNVERIFIED` until observed or approved. `OBSERVED` traffic may reach a state but may **never** judge an acceptance criterion — only `HUMAN_APPROVED` or `OPENAPI` can. | A scenario that cannot assert anything until a human agrees the contract at Gate 2, or an `AGENT_DRAFTED` draft that stays `UNVERIFIED` forever without a second, explicit, per-contract human confirmation. |
| **Never fabricate a passing result** | No `PASSED` without a real execution record; a zero-denominator coverage measure is `null`, never 0%/100%. | Nothing to automate at all if the story never says what "correct" looks like. |

Every field in Part 2 exists to feed one of these rules an answer the story already contains, so an
agent never has to choose between inventing one and stalling the workflow.

### 1.1 Two realities this standard must not paper over

**"Just ask for the environment URL" does not scale, and the framework does not actually work that
way.** Confirmed in [src/utils/env.ts](../src/utils/env.ts): a story never carries a URL. Execution
resolves `PLAYWRIGHT_BASE_URL` / `API_BASE_URL` from `.env`/CI secrets at run time, keyed only by a
logical `TEST_ENVIRONMENT` tier (`local | dev | qa | uat | staging` — **`prod` is not in that enum
today**). A URL embedded in a story would (a) go stale the moment a fifth `dev` box or a rotated
`staging` host appears, and (b) itself be exactly the kind of hard-coded value
`SEM-AUTOMATION-HYGIENE` forbids in `src/`. So the story must describe environment facts that stay
true across however many physical hosts a tier has — never a host.

The prod gap is real and this document does not close it by itself: `TEST_ENVIRONMENT` has no
`prod` value, and the one built-in safety net for negative scenarios (fabricated `SAMPLE_DATA`
instead of the real account) exists because a real account can lock out — a risk that is far more
expensive to trigger against production. **A story that will eventually run against prod must say so
explicitly and declare what "prod-safe" means for each of its scenarios** (§2 and §6 below); whether
the framework's `TEST_ENVIRONMENT` enum should be extended to include `prod` is a schema decision for
the team, not something this document or an agent may quietly assume.

**"The story author will supply all the test data" is also not true in practice**, and the schema
reflects that: `test-plans/test-plan.schema.json`'s `testDataRequirements` is today just an array of
free-text strings — it has no field for *who* supplies a value, whether it already exists, or whether
it is still missing. Left implicit, an agent is one keystroke away from inventing a value to fill the
gap, which is exactly what rule 2 (never invent a business rule) and the `SAMPLE_DATA` isolation rule
exist to prevent. §6 below (Test Data Contract) makes that three-way split — author-supplied,
pre-existing/seeded, fabricated-synthetic — and a fourth, honest **gap** status — an explicit part of
the story, so a missing value becomes a tracked risk instead of a guess.

---

## Part 2 — The Standard Story Template

Copy this into the Jira description (or an attached spec) for any story headed into this framework.
Sections marked **(API/HYBRID only)** apply whenever any acceptance criterion is backed by a call the
UI makes, not only when the story is "an API story" — most of this codebase's real stories are UI
stories with an API-backed scenario buried inside one AC (see the eCore finding below: nearly nothing
here is API-first).

```markdown
## 1. Summary
One sentence: who does what, and why.

## 2. Preconditions / environment
- Which logical tier(s) this must pass on — by TIER NAME (`dev` / `qa` / `uat` / `staging` / `prod`),
  never a URL or hostname. A URL is resolved per physical run from `.env`/CI secrets and would go
  stale the moment a second `dev` box exists; naming one here would itself violate the framework's
  no-hard-coded-URL rule.
- If `prod` is one of the target tiers: say so explicitly and mark every scenario below (§3/§6)
  `prod-safe: yes/no`. A `prod-safe: no` scenario runs only on pre-prod tiers — name which one stands
  in for it. Today the framework's `TEST_ENVIRONMENT` configuration has no `prod` value; flag this
  story as needing that decided (schema/config, not this story) rather than assuming it already works.
- Which role/account type is required (be explicit — "a user" is not enough; name the role).
- Any state the account/data must already be in before the scenario starts — describe it here by
  reference to §6 (Test Data Contract) rather than inline, so it isn't duplicated or contradicted.

## 3. Acceptance Criteria (Given/When/Then, one block per criterion)
For EACH criterion:
- AC-<n>: Given <preconditions>, When <action>, Then <observable, checkable outcome>.
- Interface: UI | API | HYBRID   <!-- omit only if genuinely UI; never omit to avoid deciding -->
- If the "Then" involves a number, threshold, timeout, message, or limit — state the exact value.
  "an appropriate error" / "a reasonable timeout" / "the correct message" are not acceptance
  criteria; they are ambiguities waiting to be raised.

## 4. Explicitly out of scope
List what this story deliberately does NOT cover (a later reader — human or agent — must not guess
whether an adjacent behaviour was forgotten or excluded on purpose).

## 5. API details (REQUIRED whenever any AC above is API or HYBRID)
For EACH endpoint any in-scope AC depends on:
- Method + full path (or the operation name if it's an RPC-style verb, e.g. an `.eo` endpoint).
- Auth mechanism (session cookie, bearer token, form POST + redirect, etc.).
- Request shape: content type, and every parameter/field name + type the story requires
  (form-encoded fields, JSON body keys — whichever is real for this system).
- Response shape: content type, and every field name + type an assertion will depend on.
  If the response is HTML or a markup-bearing envelope rather than data, say so explicitly —
  don't leave it to be discovered.
- Expected status code(s) for success and for each named failure.
- Exact error codes/messages for each failure case named in an AC.
- Is this endpoint documented in an OpenAPI/Swagger spec? If yes, link it — that becomes the
  framework's `contractSource: OPENAPI`, the strongest possible authority.
  If no OpenAPI document exists, say who is authorized to approve the contract shape at Gate 2
  (this becomes `contractSource: HUMAN_APPROVED`) — because without one, the contract can only ever
  be `OBSERVED` from live traffic, which is allowed to set up a scenario's state but is **never**
  allowed to judge whether the scenario passed.
- Side effects: does this call mutate/delete state? If it does, name how the data gets restored
  after the test runs (the framework requires a `CLEANUP -` waiver for any destructive call,
  including a destructively-named endpoint reached by an unexpected HTTP method).

## 6. Test Data Contract (state which of the four buckets EVERY data value falls into)
Do not leave a single value implicit. For each data element any AC or negative case needs:
- **Author-supplied** — a business-meaningful value the story owner is providing directly here
  (a specific threshold, limit, role name, message text). Give the literal value.
- **Pre-existing / seeded** — a record expected to already exist in every target tier (an account,
  a container, a transaction). Describe it **abstractly** (role, entity type, required state), never
  by a tier-specific ID/username — an ID that exists in `qa` will not exist in `staging`. Name who
  seeds it (a fixture, a backend setup script, a manually provisioned QA account) and, if it doesn't
  exist yet in every needed tier, say so — that is a real dependency, not a detail to skip.
- **Fabricated / synthetic** — values invented for negative or edge cases only, never for a
  happy-path assertion or the real account (this mirrors the framework's own
  `test-data/<capability>.sample.json` convention: `dataClassification: SYNTHETIC_INPUTS`, and only
  the happy path may use the real account).
- **Gap — not yet available** — say so explicitly rather than leaving it silent or guessing a value.
  A `TEST_DATA_GAP` entry names what's missing and who is expected to supply or provision it, and is
  carried forward as an open risk (`RISK-TP-*`) or ambiguity (`AMB-*`) rather than silently
  fabricated — the same rule that forbids inventing a business rule forbids inventing a data value
  that changes whether an assertion passes.

## 7. Negative / edge cases
Enumerate them explicitly — wrong input, missing input, boundary values, duplicate submission,
concurrent access, etc. — each with the exact expected outcome from #3's rule about avoiding vague
language, and each pointing at its data source from §6.

## 8. Non-functional exclusions
State explicitly whether MFA, SSO, session timeout, lockout, rate limiting, and localization are
in or out of scope for this story. Silence here is exactly what produced `AMB-ETA-351-004` and
`AMB-ETA-351-006` in the real ETA-351 story.
```

### Field-to-rule traceability

| Story field above | Consumed by | Enforced by |
| --- | --- | --- |
| §3 Interface: UI/API/HYBRID | `test-plans/*/scenarios[].interfaceType` | `test-plan.schema.json`, `SEM-API-CONTRACT` |
| §3 exact values (no vague language) | `acceptanceCriteria[].given/when/then` | `requirements/schemas/jira-requirement.schema.json`; unresolved vagueness becomes `AMB-*` |
| §4 out of scope | `test-plans/*.json` → `scope.outOfScope` | Human-reviewed at Gate 2 |
| §5 method/path/status codes | `apiContract.method/path/expectedStatusCodes` | `test-plan.schema.json` `$defs.apiContract` (all three are `required`) |
| §5 OpenAPI link vs. named approver | `apiContract.contractSource` (`OPENAPI` / `HUMAN_APPROVED`) + `contractProvenance` | `SEM-API-CONTRACT` — rejects any approved, non-scaffolding assertion backed by anything else (e.g. `OBSERVED`) |
| §5 response field names/types | `responseContractRef` → a Zod model in `src/models/api/`, plus `responseShapeHash` | `SEM-API-CONTRACT` requires a hash on every `HUMAN_APPROVED` contract that asserts an AC |
| §5 destructive/side-effecting calls | `CLEANUP -` waiver in the API client | `.github/instructions/playwright-automation.instructions.md`, `SEM-AUTOMATION-HYGIENE` |
| §2 tier names (never a URL) | `env.testEnvironment` at run time, not the story artifact | `src/utils/env.ts` `TEST_ENVIRONMENT` enum; a hard-coded URL in `src/` fails `SEM-AUTOMATION-HYGIENE` |
| §2 `prod-safe` declaration | Risk/assumption entries in `test-plans/*.json` (`risks[]`, `assumptions[]`) | Human-reviewed at Gate 2; no schema field enforces this today — treat as a Gate 2 discussion point |
| §6 author-supplied values | Literal values inside `acceptanceCriteria[].given/when/then` or scenario `testDataRequirements` | `requirements/schemas/jira-requirement.schema.json`; `test-plan.schema.json` |
| §6 pre-existing/seeded data | `test-plans/*.json` → `assumptions[]` / `dependencies[]`, described abstractly | Human-reviewed at Gate 2 — an agent may not assume a seeded record exists without this |
| §6 fabricated/synthetic data | `test-data/<capability>.sample.json` with `dataClassification: SYNTHETIC_INPUTS` | `SEM-SAMPLE-ISOLATION` — never mixed with `REAL_JIRA_DATA` |
| §6 data gaps | `ambiguities[]` (`AMB-*`) or `test-plans/*.json` → `risks[]` (`RISK-TP-*`) | `jira-requirement.schema.json` `$defs.ambiguity`; never silently fabricated |
| §8 non-functional exclusions | `ambiguities[]` (if left unanswered) or `scope.outOfScope` (if answered) | `requirements/schemas/jira-requirement.schema.json` `$defs.ambiguity` |

---

## Part 3 — Worked example

### 3.1 What eCore's real API surface looks like (why this matters)

Before writing an API section for *any* eCore story, read
[reports/validation/ecore-api-discovery.json](../reports/validation/ecore-api-discovery.json). It is
evidence, not a spec: eCore is a **server-rendered Java application**, not a REST-backed SPA.
Sign-in is a form POST returning a `302`; there is no token and no JSON login body. The only AJAX
surface lives under `/ssweb/setup/workspace/**/ajax/`, uses RPC-style verbs ending in `.eo`, and
takes **form-encoded** requests. Three endpoints have been observed; one of them
(`submitTransactionSearch.eo`) lives under `/ajax/` yet returns an HTML fragment, not data — a trap
for anyone assuming "ajax path" means "JSON contract." A further ~178 `.eo` paths are declared in the
application's markup but never exercised, and several are destructively named
(`deleteTransaction`, `voidDocument`, `authorizeDestruction`, `mersTransfer`, `removeTransactions`).
None of that is permission to call them — nothing enters `src/api/` until it is observed with a
captured request/response or an OpenAPI document says otherwise.

This is why §5 of the template above asks for the *exact* method/path/shape rather than "call the
search API": on this system there usually isn't a clean one to call, and guessing produces either a
markup assertion (useless) or a call against a destructive, unverified path (dangerous).

### 3.2 Bad story (would stall at Gate 1 and Gate 2)

> **ETA-777 — Let users search their workspace and see results**
> As a user I want to search for transactions in my workspace so I can find what I need.
> AC: User can search and see appropriate results in a reasonable time.

Every clause here fails Part 2: "a user" (which role?), "appropriate results" (what fields, what
values?), "a reasonable time" (what threshold?), no interface declared, no endpoint named, no
response shape, no error case, **no target environment tier**, and **no test data contract** — it
never says whether the matching transaction already exists anywhere, so an agent would either invent
a fixture or stall waiting for one. This story would generate at least six open items (`AMB-*` plus a
`TEST_DATA_GAP`) and could not clear Gate 1, let alone reach an `apiContract`.

### 3.3 Good story (reaches Gate 3 with only its genuinely-unknown items flagged)

> **ETA-777 — Workspace transaction search returns matching results in the results grid**
>
> **1. Summary:** An organization user searches their workspace for transactions matching a
> container name, and the matching rows appear in the results grid.
>
> **2. Preconditions:** Target tiers: `qa`, `staging`; not yet run against `prod` (all scenarios
> below marked `prod-safe: no` pending a decision on extending `TEST_ENVIRONMENT`). Role:
> `Organization User` with `Workspace` access, already signed in (see `ETA-351` for sign-in — reuse,
> do not re-derive). Data preconditions are fully enumerated in §6, not here.
>
> **3. Acceptance Criteria:**
> - **AC-1** (Interface: UI, prod-safe: no) — Given the user is on the Workspace page, When they
>   type the seeded container name from §6 into the container name field and press Search, Then the
>   results grid shows at least one row whose `containerName` cell displays that value.
> - **AC-2** (Interface: HYBRID, prod-safe: no) — Given the search in AC-1 has been submitted, When
>   the grid requests its data, Then the underlying data call returns HTTP 200 with a DataTables
>   envelope containing `draw`, `recordsTotal`, `recordsFiltered`, and a `data` array whose rows
>   include a `containerName` field — asserted only on the presence/shape of this envelope, never on
>   exact row count (row count is seed-data-dependent and out of scope for this AC).
> - **AC-3** (Interface: UI, prod-safe: no) — Given no transaction matches the typed value, When
>   Search is pressed, Then the grid displays its existing empty-state message (see AMB-ETA-777-001
>   below — the exact wording is not yet known and must be observed, not authored).
>
> **4. Out of scope:** Sorting, column filtering, pagination controls, and CSV export — separate
> stories. Search performance/timing thresholds — not specified by product, excluded here rather than
> guessed.
>
> **5. API details:**
> - Endpoint: `POST /ssweb/setup/workspace/container/ajax/getWorkspaceTableData.eo`
>   (see `reports/validation/ecore-api-discovery.json#OBS-003` for the already-observed shape).
> - Auth: existing authenticated session cookie (no separate token).
> - Request: `application/x-www-form-urlencoded`, DataTables server-side protocol — `draw`, and a
>   `columns[i]` block per visible column with the searched value under
>   `columns[i][search][value]` for the `containerName` column.
> - Response: `application/json;charset=UTF-8`; envelope keys `draw`, `recordsTotal`,
>   `recordsFiltered`, `data[]`; every business field inside a `data[]` row is an **HTML string**
>   (e.g. `"<span title='...'>Test-Contract-001</span>"`), not a plain value — AC-2 must assert
>   envelope shape and field *presence*, never parse or match the embedded HTML as if it were plain
>   text.
> - No OpenAPI document exists for this endpoint. Contract must be agreed at Gate 2 as
>   `HUMAN_APPROVED` by the QA lead named in the review, recording a `responseShapeHash`.
> - Non-destructive (read-only search). No `CLEANUP -` waiver required.
>
> **6. Test Data Contract:**
> - **Author-supplied:** the searched container-name value is arbitrary for this story; use
>   whatever the seeded record below is named.
> - **Pre-existing/seeded:** one transaction with a known `containerName` (e.g.
>   `"Test-Contract-001"`) must already exist for the signed-in organization in **every** target
>   tier named in §2 (`qa`, `staging`). Seeded by: [name the fixture/backend script/QA owner here —
>   this story does not assume it already exists in `staging` just because it exists in `qa`].
> - **Fabricated/synthetic:** none needed for AC-3 — "no match" is achieved by searching for a value
>   guaranteed absent (e.g. a random GUID), not by a fabricated *record*.
> - **Gap:** `TEST_DATA_GAP-ETA-777-001` — whether the seeded container already exists in `staging`
>   is unconfirmed at story-write time. Carried as `RISK-TP-ETA-777-001` until confirmed; AC-1/AC-2
>   are not run against `staging` until it resolves.
>
> **7. Negative/edge cases:** No matches (AC-3); container name containing special characters used
>   in DataTables search syntax — expected to be treated as a literal string, not a regex (flag as
>   `AMB-ETA-777-002` if product has not confirmed this).
>
> **8. Non-functional exclusions:** MFA/SSO — out of scope, inherited from ETA-351. Session timeout —
>   out of scope. Rate limiting — not applicable to this search volume; out of scope.

Only two genuine gaps remain here — `AMB-ETA-777-001` (exact empty-state wording) and
`TEST_DATA_GAP-ETA-777-001`/`RISK-TP-ETA-777-001` (unconfirmed seed data in `staging`) — because the
story owner correctly recognized both as unknown rather than inventing an answer, and flagged them
instead of leaving them silent. Those are **correct** open items, resolved by observation at
`PLAYWRIGHT_VALIDATION` and by confirming seed data respectively, not a symptom of an incomplete
story.

### 3.4 How that story flows through the framework

Using [docs/framework-file-creation-sequence.md](framework-file-creation-sequence.md) stage-by-stage,
the good story above produces (capability `workspace-search`, illustrative IDs):

1. `requirements/approved/ETA-777.json` — three ACs, `AC-ETA-777-001` (UI), `AC-ETA-777-002`
   (HYBRID), `AC-ETA-777-003` (UI); one ambiguity `AMB-ETA-777-001` carried `DEFERRED` until observed.
2. `test-plans/approved/TP-ETA-777-001.json` — scenario `TS-ETA-777-002` carries:
   ```json
   {
     "testScenarioId": "TS-ETA-777-002",
     "acIds": ["AC-ETA-777-002"],
     "interfaceType": "HYBRID",
     "apiContract": {
       "method": "POST",
       "path": "/ssweb/setup/workspace/container/ajax/getWorkspaceTableData.eo",
       "expectedStatusCodes": [200],
       "contractSource": "HUMAN_APPROVED",
       "contractProvenance": "APR-TP-ETA-777-001-002",
       "responseContractRef": "src/models/api/workspace-search.contract.ts",
       "responseShapeHash": "<sha256 from computeResponseShapeHash>",
       "scaffoldingOnly": false
     }
   }
   ```
3. `features/approved/workspace-search/workspace-transaction-search.feature` — the scenario for
   `TS-ETA-777-002` carries the `@interface-hybrid` tag alongside the standard
   `@release-/@capability-/@req-/@ac-/@tp-/@ts-` tags.
4. `src/api/workspace-search.api.ts` — extends `ApiClient`, owns this endpoint the way a page object
   owns locators; no absolute URL, no `process.env`.
5. `src/models/api/workspace-search.contract.ts` — a Zod contract that parses the **whole**
   DataTables envelope (not three spot-checked fields), matching `responseContractRef` above.
6. `reports/validation/TP-ETA-777-001-api-validation.json` — the `OBSERVED` evidence captured during
   `PLAYWRIGHT_VALIDATION`, distinct from the Gate-2 `HUMAN_APPROVED` decision it supports.
7. `test-plans/approved/TP-ETA-777-001.json` → `risks[]` carries `RISK-TP-ETA-777-001` (staging seed
   data unconfirmed) so it stays visible instead of silently gating only `qa` executions.
8. Standard Stage 12–15 output: `traceability/executions/EXEC-ETA-777-001.json`,
   `traceability/capabilities/workspace-search.rtm.json`,
   `traceability/capabilities/workspace-search.coverage.json` — the `staging` row stays absent/`null`
   until `RISK-TP-ETA-777-001` resolves, never fabricated as passing.

Nothing in this flow required an agent to invent an endpoint, a field name, a status code, a
hostname, a piece of seed data, or an empty-state message — every one of those was either stated in
the story or explicitly raised as an ambiguity/risk for a human to resolve.

---

## Part 4 — Pre-submission checklist

Paste this into the story before it enters the workflow. If any box would be unchecked, that is the
exact ambiguity the framework will raise — resolve it now, or accept that it will surface later as an
`AMB-*`/`DEFERRED` item and may block Gate 1 or Gate 2.

- [ ] Every acceptance criterion is Given/When/Then with concrete, checkable values (no "appropriate",
      "reasonable", "correct", "valid" left unquantified).
- [ ] Every acceptance criterion declares its interface: UI, API, or HYBRID.
- [ ] Every API/HYBRID criterion names: method, full path (or operation name), auth mechanism,
      request shape, response shape (including whether fields are plain values or markup-bearing
      strings), expected status codes, and exact error codes/messages.
- [ ] Every API/HYBRID criterion states whether an OpenAPI document exists (link it) or names who
      approves the contract at Gate 2.
- [ ] Every destructive or ambiguously-named endpoint states how test data is restored afterward.
- [ ] Target environment tier(s) are named by logical tier (`dev`/`qa`/`uat`/`staging`/`prod`), never
      by URL or hostname.
- [ ] If `prod` is a target tier, every scenario declares `prod-safe: yes/no`, and a `no` names which
      pre-prod tier substitutes for it.
- [ ] Every data value used by an AC or negative case is classified as author-supplied,
      pre-existing/seeded (named per tier, not by a tier-specific ID), fabricated/synthetic, or an
      explicit gap — never left implicit.
- [ ] Every "pre-existing/seeded" data item names who provisions it and confirms it exists in every
      target tier, not just the one the author tested against.
- [ ] Out-of-scope items are listed, not left implicit.
- [ ] Negative/edge cases are enumerated with their exact expected outcome.
- [ ] MFA, SSO, session timeout, lockout, and rate limiting are each explicitly marked in or out of
      scope.
- [ ] Roles/permissions referenced by any criterion are named precisely, not "a user."

---

## Related reading

| Topic | File |
| --- | --- |
| Full architecture, gates, coverage model | [README.md](../README.md) |
| Non-negotiable rules this standard exists to satisfy | [AGENTS.md](../AGENTS.md) |
| Every file a story produces, in order | [docs/framework-file-creation-sequence.md](framework-file-creation-sequence.md) |
| How environment tiers/URLs and API auth actually resolve at run time (why a story never carries a URL) | [src/utils/env.ts](../src/utils/env.ts) |
| Synthetic test-data convention (`dataClassification: SYNTHETIC_INPUTS`) | [test-data/account-access.sample.json](../test-data/account-access.sample.json) |
| Normalized requirement shape (what `story`/`requirements`/`acceptanceCriteria`/`ambiguities` must contain) | [requirements/schemas/jira-requirement.schema.json](../requirements/schemas/jira-requirement.schema.json) |
| Test plan / scenario / `apiContract` shape | [test-plans/test-plan.schema.json](../test-plans/test-plan.schema.json) |
| What eCore's real API surface is (read before writing any API section) | [reports/validation/ecore-api-discovery.json](../reports/validation/ecore-api-discovery.json) |
| The rule that rejects an unauthoritative contract backing an approved assertion | `checkApiContracts` (`SEM-API-CONTRACT`) in [src/utils/semantic-rules.ts](../src/utils/semantic-rules.ts) |
| A real, human-facing-only worked story (never an authoring reference) | [requirements/approved/ETA-351.json](../requirements/approved/ETA-351.json) |
