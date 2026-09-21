## 1. Test plan and Gate 2

- [ ] 1.1 Draft the ETA-411 test plan covering all seven requirements in the delta spec, one scenario per spec scenario, and verify `npm run validate:artifacts` passes with the plan present
- [ ] 1.2 Declare an `interfaceType` for every scenario, and verify no scenario claims `API` or `HYBRID` without an accompanying contract
- [ ] 1.3 Record in the plan that the unauthenticated scenario asserts expected rather than observed behaviour, and verify the review package states this so Gate 2 ratifies it knowingly
- [ ] 1.4 Raise for Gate 2 whether Preferences is intended as a grouping or a destination, and verify the question and its consequence appear in the review package
- [ ] 1.5 Produce the Gate 2 review package and approval template, halt, and verify the workflow instance reads `WAITING_FOR_HUMAN`

## 2. Behaviour specification and Gate 3

- [ ] 2.1 Write Gherkin scenarios for the approved plan in business language only, and verify no selector, endpoint or browser mechanic appears in any feature file
- [ ] 2.2 Tag every scenario with its release, capability, story, requirement, acceptance criterion, test plan and test scenario, and verify `SEM-FEATURE-TAGS` passes
- [ ] 2.3 Write the automation design describing structure and reuse, and verify it names no locator that has not been validated against the application
- [ ] 2.4 Produce the Gate 3 review package and approval template, halt, and verify the workflow instance reads `WAITING_FOR_HUMAN`

## 3. Validation against the application

- [ ] 3.1 Walk each approved scenario against eCore and verify every element it depends on is reachable by an accessible name or has a recorded justification for an alternative
- [ ] 3.2 Confirm the behaviour of a direct module request without a session, and verify the outcome is recorded as a finding rather than used to amend the approved specification
- [ ] 3.3 Confirm Organization and Vault are distinguishable by page content, and verify the recorded evidence shows content and not location alone
- [ ] 3.4 Record every mismatch between the application and an approved expectation in the validation report, and verify no approved expectation was edited to match the application

## 4. Implementation and execution

- [ ] 4.1 Implement the step definitions and supporting objects for the approved scenarios, and verify `npm run typecheck` passes
- [ ] 4.2 Keep every negative scenario on fabricated credentials from the capability sample data, and verify no negative path uses the real account, which can lock out
- [ ] 4.3 Generate the executable tests and verify `npm run bdd` reports no undefined or duplicate steps
- [ ] 4.4 Execute the suite and verify each scenario produces a real result, with any environment blocker recorded as `BLOCKED` rather than reported as a pass
- [ ] 4.5 Update the capability traceability matrix from execution evidence and verify the deferred criteria are still reported as uncovered rather than absorbed into the coverage figure
