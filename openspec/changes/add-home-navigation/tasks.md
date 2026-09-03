## 1. Test planning (Gate 2)

- [ ] 1.1 Derive a test plan `TP-ETA-411-001` covering all nine approved acceptance criteria, one scenario `TS-ETA-411-NNN` per criterion, and verify `npm run validate:artifacts` reports `TP-STRUCTURE` passing
- [ ] 1.2 Confirm no planned scenario asserts a header Preferences route, and verify by checking that no scenario reaches `/ssweb/setup/prefs/preferences.eo` from anywhere other than the Home page Preferences icon while `AMB-ETA-411-006` is unresolved
- [ ] 1.3 Confirm no planned scenario asserts an accessible name for the Command Center control, and verify each Command Center step is expressed as a navigation outcome only
- [ ] 1.4 Mark the scenarios for `AC-ETA-411-008` and `AC-ETA-411-009` as dependent on unconfirmed destinations, and verify the plan records that both must be walked at `PLAYWRIGHT_VALIDATION` before assertion
- [ ] 1.5 Produce the Gate 2 review package and approval template, and verify the workflow instance reports `status = WAITING_FOR_HUMAN` at `TEST_PLAN_APPROVAL`

## 2. Behaviour design (after Gate 2)

- [ ] 2.1 Write Gherkin scenarios expressing the approved behaviour in business language, and verify each scenario carries `@release-`, `@capability-`, `@<JIRA-ID>`, `@req-`, `@ac-` , `@tp-` and `@ts-` tags so `SEM-FEATURE-TAGS` passes
- [ ] 2.2 Reuse the existing organization sign-in steps for the precondition rather than writing new ones, and verify `npm run bdd` reports no duplicate step definition
- [ ] 2.3 Ensure no feature file contains a selector, an address, a page-object method name or a browser mechanic, and verify `SEM-AUTOMATION-HYGIENE` passes
- [ ] 2.4 Produce the automation design and Gate 3 review package, and verify the workflow instance reports `status = WAITING_FOR_HUMAN` at `AUTOMATION_APPROVAL`

## 3. Application validation (after Gate 3)

- [ ] 3.1 Confirm VPN access to the QA host, and verify the Home page is reachable before any locator work begins; if it is not, record an environment blocker rather than proceeding
- [ ] 3.2 Walk the header New Transaction link and the header Workspace link, and verify each lands on the address claimed by `AC-ETA-411-008` and `AC-ETA-411-009` rather than trusting the link address
- [ ] 3.3 Validate the locator for the Command Center control, and verify it is recorded with a `VALIDATED -` waiver because no accessible name exists to target
- [ ] 3.4 Confirm the three dashboard icons resolve unambiguously, and verify the locator is scoped so the header links of the same name do not produce a strict-mode violation
- [ ] 3.5 Escalate `AMB-ETA-411-006` to a human, and verify it remains `REVIEW_REQUIRED` rather than being inferred from the observed "Organization" menu link
- [ ] 3.6 Record any conflict between observed behaviour and an approved expectation as a discrepancy, and verify no approved criterion was edited to match the application

## 4. Implementation

- [ ] 4.1 Implement page objects owning validated locators, and verify `SEM-AUTOMATION-HYGIENE` passes with no remaining `MCP_VALIDATION_REQUIRED` marker
- [ ] 4.2 Implement step definitions that orchestrate only, and verify they contain no locators and no hard-coded addresses
- [ ] 4.3 Reuse the existing organization sign-in service for the authenticated precondition, and verify only the happy path calls `env.requireEcoreLogin()`
- [ ] 4.4 Register story fixtures, and verify `npm run typecheck` exits zero

## 5. Execution and traceability

- [ ] 5.1 Run `npm run bdd` and verify there are no undefined or duplicate step definitions
- [ ] 5.2 Run `npm test` and verify every scenario produces a real result; record blockers as `BLOCKED` rather than reporting a pass
- [ ] 5.3 Create `traceability/capabilities/home-navigation.rtm.json` and its coverage matrix from RTM data only, and verify uncovered, deferred, blocked and failed criteria are all listed rather than rounded away
- [ ] 5.4 Record `AMB-ETA-411-006` as an open clarification against the capability, and verify coverage is not reported as complete while it is unresolved
- [ ] 5.5 Refresh `traceability/index/lookup.index.json` and verify `npm run validate:artifacts` passes across every scope
