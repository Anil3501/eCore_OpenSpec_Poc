## 1. Test planning (Gate 2)

- [x] 1.1 Derive a test plan `TP-EC-11358-001` covering all six approved acceptance criteria, one scenario `TS-EC-11358-NNN` per criterion, and verify `npm run validate:artifacts` reports `TP-STRUCTURE` passing
- [ ] 1.2 Scope `AC-EC-11358-005` per the resolution of `AMB-EC-11358-002`: the UI view plus the two report APIs (`eoRequestExport`, `eoGetDocumentActivityHistoryReport`). Mark each API scenario `@interface-api` or `@interface-hybrid` with an `apiContract` whose `contractSource` is `OBSERVED`, and verify the contract is listed in the Gate 2 review for a human to convert to `HUMAN_APPROVED`
- [x] 1.3 Confirm no planned scenario asserts beyond the Gate 1 resolutions — structural presence of the table and its three columns only (`AMB-EC-11358-003`), no exact header labels and no date/time format — and verify by reading each scenario against the ambiguity named in its source requirement
- [x] 1.4 Establish the Confirmed Transfer of Control precondition and org/document selection per the resolutions of `AMB-EC-11358-001` and `AMB-EC-11358-004`, and record the test-data basis in the plan rather than inventing a document
- [x] 1.5 Produce the Gate 2 review package and approval template, and verify the workflow instance reports `status = WAITING_FOR_HUMAN` at `TEST_PLAN_APPROVAL`

## 2. Behaviour design (after Gate 2)

- [x] 2.1 Write Gherkin scenarios expressing the approved behaviour in business language, and verify each scenario carries `@release-`, `@capability-`, `@<JIRA-ID>`, `@req-`, `@ac-`, `@tp-` and `@ts-` tags so `SEM-FEATURE-TAGS` passes
- [x] 2.2 Tag each report-API scenario with `@interface-api` or `@interface-hybrid` matching its approved plan, and verify `SEM-API-CONTRACT` passes; a scenario with no `@interface-` tag is treated as UI
- [x] 2.3 Ensure no feature file contains a selector, page-object method name, endpoint, status code or browser mechanic, and verify `SEM-AUTOMATION-HYGIENE` passes
- [x] 2.4 Produce the automation design and Gate 3 review package, listing every `MCP_VALIDATION_REQUIRED` locator and every `API_CONTRACT_UNVERIFIED` contract, and verify the workflow instance reports `status = WAITING_FOR_HUMAN` at `AUTOMATION_APPROVAL`

## 3. Application validation (after Gate 3)

- [x] 3.1 Confirm environment access to the QA host, and verify a transferred financial asset document's Document Activity History Report is reachable before any locator work begins; if it is not, record an environment blocker rather than proceeding
- [ ] 3.2 Observe the real report to validate the Control History table locators and the presence of the three columns, and verify each observation is recorded in `reports/validation/`
- [ ] 3.3 Drive the approved UI flow to capture the live contracts for `eoRequestExport` and `eoGetDocumentActivityHistoryReport`, record them as `OBSERVED` in `reports/validation/TP-EC-11358-001-api-validation.json`, and verify no endpoint was guessed
- [ ] 3.4 Record any conflict between observed behaviour and an approved expectation as a discrepancy, and verify no approved criterion was edited to match the application

## 4. Implementation

- [ ] 4.1 Implement page objects owning validated locators for the Control History table, and verify `SEM-AUTOMATION-HYGIENE` passes with no remaining `MCP_VALIDATION_REQUIRED` marker
- [ ] 4.2 Implement API clients under `src/api/` for the two report surfaces against their `HUMAN_APPROVED` contracts, with Zod response models under `src/models/api/`, and verify no absolute URL or `process.env` access is present
- [ ] 4.3 Implement step definitions that orchestrate only, and verify they contain no locators, no endpoints and no hard-coded data
- [ ] 4.4 Add test data for the transfer preconditions and register story fixtures, and verify `npm run typecheck` exits zero

## 5. Execution and traceability

- [ ] 5.1 Run `npm run bdd` and verify there are no undefined or duplicate step definitions
- [ ] 5.2 Run `npm test` and verify every scenario produces a real result; record blockers as `BLOCKED` rather than reporting a pass
- [ ] 5.3 Update the capability RTM and coverage matrix from RTM data only, and verify uncovered, deferred, blocked and failed criteria are all listed rather than rounded away
- [ ] 5.4 Refresh `traceability/index/lookup.index.json` and verify `npm run validate:artifacts` passes across every scope
