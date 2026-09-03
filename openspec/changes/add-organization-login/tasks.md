## 1. Test planning (Gate 2)

- [ ] 1.1 Derive a test plan `TP-ETA-351-001` covering all eight approved acceptance criteria, one scenario `TS-ETA-351-NNN` per criterion, and verify `npm run validate:artifacts` reports `TP-STRUCTURE` passing
- [ ] 1.2 Confirm no planned scenario asserts an unresolved ambiguity — no exact error text, no assumed field set, no assumed mandatory field — and verify by reading each scenario against the ambiguity named in its source requirement
- [ ] 1.3 Produce the Gate 2 review package and approval template, and verify the workflow instance reports `status = WAITING_FOR_HUMAN` at `TEST_PLAN_APPROVAL`

## 2. Behaviour design (after Gate 2)

- [ ] 2.1 Write Gherkin scenarios expressing the approved behaviour in business language, and verify each scenario carries `@release-`, `@capability-`, `@<JIRA-ID>`, `@req-`, `@ac-`, `@tp-` and `@ts-` tags so `SEM-FEATURE-TAGS` passes
- [ ] 2.2 Ensure no feature file contains a selector, page-object method name or browser mechanic, and verify `SEM-AUTOMATION-HYGIENE` passes
- [ ] 2.3 Produce the automation design and Gate 3 review package, and verify the workflow instance reports `status = WAITING_FOR_HUMAN` at `AUTOMATION_APPROVAL`

## 3. Application validation (after Gate 3)

- [ ] 3.1 Confirm VPN access to the QA host, and verify the login page is reachable before any locator work begins; if it is not, record an environment blocker rather than proceeding
- [ ] 3.2 Observe the real login page to answer `AMB-ETA-351-001` (field set), `AMB-ETA-351-002` (selection mechanism) and `AMB-ETA-351-005` (mandatory details), and verify each observation is recorded in `reports/validation/`
- [ ] 3.3 Observe both failure paths using fabricated data to answer `AMB-ETA-351-003`, and verify the recorded evidence shows how the two responses differ without depending on their wording
- [ ] 3.4 Escalate `AMB-ETA-351-004` and `AMB-ETA-351-006` to a human, and verify they remain `REVIEW_REQUIRED` rather than being inferred from observed behaviour
- [ ] 3.5 Record any conflict between observed behaviour and an approved expectation as a discrepancy, and verify no approved criterion was edited to match the application

## 4. Implementation

- [ ] 4.1 Implement page objects owning validated locators, and verify `SEM-AUTOMATION-HYGIENE` passes with no remaining `MCP_VALIDATION_REQUIRED` marker
- [ ] 4.2 Implement step definitions that orchestrate only, and verify they contain no locators and no hard-coded data
- [ ] 4.3 Add fabricated test data for the negative paths, and verify no negative scenario uses real credentials
- [ ] 4.4 Register story fixtures, and verify `npm run typecheck` exits zero

## 5. Execution and traceability

- [ ] 5.1 Run `npm run bdd` and verify there are no undefined or duplicate step definitions
- [ ] 5.2 Run `npm test` and verify every scenario produces a real result; record blockers as `BLOCKED` rather than reporting a pass
- [ ] 5.3 Update the capability RTM and coverage matrix from RTM data only, and verify uncovered, deferred, blocked and failed criteria are all listed rather than rounded away
- [ ] 5.4 Refresh `traceability/index/lookup.index.json` and verify `npm run validate:artifacts` passes across every scope
