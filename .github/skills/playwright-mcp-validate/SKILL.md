---
name: playwright-mcp-validate
description: Validate approved locators and API contracts for a test plan's scenarios by driving Playwright MCP directly against the real eCore application, replacing MCP_VALIDATION_REQUIRED / API_CONTRACT_UNVERIFIED placeholders with confirmed evidence. Use during the PLAYWRIGHT_VALIDATION or IMPLEMENTATION workflow stage, whenever a scenario's locator or API contract still carries an unvalidated placeholder, or when the user asks to "use Playwright MCP" / "explore the app" / "validate a locator" / "observe an API contract" for an approved scenario.
license: MIT
metadata:
  author: sdd-workflow-orchestrator
  version: "1.0"
---

Drive Playwright MCP directly against the real, running eCore application to turn an approved
scenario's placeholder locators and API contracts into validated ones. This is the orchestrator's
own PLAYWRIGHT_VALIDATION / IMPLEMENTATION procedure (see
`.github/agents/sdd-workflow-orchestrator.agent.md`, "PLAYWRIGHT_VALIDATION and IMPLEMENTATION
ownership", and `.github/instructions/playwright-automation.instructions.md`) — it is never
delegated to the generic `playwright-test-planner` / `playwright-test-generator` sub-agents,
because their own built-in output formats (a markdown test plan, a flat `.spec.ts` file) do not
match this framework's governed JSON reports or its strict layering.

**This skill never invents a locator, endpoint, field name or status code.** Everything it
confirms comes from live observation. If the application does not reveal something the plan
expects, that is reported as a mismatch — never guessed around.

## Input

The approved test plan id (`TP-<JIRA>-<nnn>`) and, optionally, one or more `TS-<JIRA>-<nnn>`
scenario ids to scope the work. If omitted, ask which scenarios to validate — never validate an
entire plan speculatively when only one scenario was requested.

## Steps

1. **Read the approved scenario(s).** Open `test-plans/approved/<TP-ID>.json` and the matching
   automation design under `features/generated/<capability>/` or `features/approved/<capability>/`.
   Identify every `MCP_VALIDATION_REQUIRED` locator and `API_CONTRACT_UNVERIFIED` contract the
   scenario(s) still carry. Never touch a scenario outside the requested scope.

2. **Establish the starting state.**
   - For an authenticated UI flow, prefer resuming `.auth/ecore-session.json` (captured via
     `npm run capture:session`) so a live password never passes through an MCP tool argument. If it
     does not exist or is stale, say so before asking the user to run the capture command
     themselves — never request or type a live password.
   - `browser_navigate` to the approved flow's starting point.

3. **Confirm each locator.**
   - `browser_snapshot` to read the live accessibility tree. Never guess an element from memory,
     a screenshot, or a similar-looking prior story.
   - Confirm the accessible role/name/label the approved step actually needs. Locator preference
     order (per `playwright-automation.instructions.md`): `getByRole` → `getByLabel` →
     `getByPlaceholder` → `getByText` → `getByTestId`. Never XPath, never `.nth()`.
   - If no accessible locator exists, a string-selector fallback is allowed only with a
     `VALIDATED -` comment explaining exactly why (e.g., no accessible name exists on this
     control) — write the comment, do not omit it.
   - Drive the rest of the approved steps with `browser_click` / `browser_type` /
     `browser_select_option` / `browser_hover` / `browser_wait_for`, exactly as the plan describes.
     Do not explore behaviour the plan does not already specify.

4. **Confirm each API/hybrid contract, if the scenario is `interfaceType: API` or `HYBRID`.**
   - Drive the real flow, then read `browser_network_requests` / `browser_network_request` to
     capture the calls the application actually made — method, path, status, and (redacted)
     response shape.
   - Record it with `contractSource: OBSERVED`. State plainly that `OBSERVED` describes what the
     application does, never what it should do, and cannot back an assertion on an acceptance
     criterion until a human promotes it to `HUMAN_APPROVED` at Gate 2 (`SEM-API-CONTRACT`).
   - Redact `Authorization` headers, cookies and payload values before writing anything to disk.
   - If the endpoint the plan expects never appears in the captured traffic (it may be genuinely
     external, like an integration-only endpoint), report that plainly instead of fabricating a
     contract — this is a legitimate outcome, not a failure of the skill.

5. **Write the validation output.**
   - `reports/validation/<TP-ID>-browser-validation.json` for locator findings.
   - `reports/validation/<TP-ID>-api-validation.json` for contract findings.
   - Replace each confirmed `MCP_VALIDATION_REQUIRED` / `API_CONTRACT_UNVERIFIED` placeholder in
     the corresponding `src/pages/**` / `src/components/**` / `src/api/**` file, adding the
     `VALIDATED -` comment where a waiver is required.

6. **Handle a mismatch.** If the live application contradicts an approved expectation (a control
   is missing, a label differs, a flow behaves differently), do not silently adjust the
   expectation. Record the mismatch in the validation report and say the scenario must return to
   its owning approval gate for a human decision.

7. **Validate.** Run `npm run validate:automation` (and `npm run typecheck` if any `src/`/`steps/`
   file changed). Report exactly what passed, what remains `MCP_VALIDATION_REQUIRED`/
   `API_CONTRACT_UNVERIFIED` (and why), and what a human needs to decide next.

## Guardrails

- Never guess a locator, endpoint, field name, or status code — confirm every one live.
- Never call a destructive-sounding endpoint (`delete`, `remove`, `void`, `destruct`, `purge`,
  `revoke`, `transfer`, whatever the verb) speculatively "to see what happens." Observation must
  come from driving the plan's own approved, already-safe steps.
- Never widen scope beyond the requested scenario(s) — no speculative exploration.
- Never promote `OBSERVED` to `HUMAN_APPROVED` yourself; that is a human decision at Gate 2.
- Never edit `.features-gen/` — it is regenerated by `bddgen`.
- Stop and report — do not keep retrying — after one failed correction attempt on a validation
  failure, per the orchestrator's general rule.
