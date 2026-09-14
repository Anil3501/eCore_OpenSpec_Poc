## 1. Test Plan (Gate 2 preparation)

- [ ] 1.1 Draft `test-plans/generated/TP-EC-12000-001.json` covering all 19 acceptance criteria
      (AC-EC-12000-001..019) as `TS-EC-12000-*` scenarios, and verify it validates against
      `test-plans/schemas/test-plan.schema.json` via `npm run validate:artifacts`
- [ ] 1.2 Mark AC-EC-12000-005, -006, -011 through -015 as `interfaceType: API` (or `HYBRID` where the
      same scenario also exercises the UI radio-button path) and verify each carries an `apiContract`
      stub with `contractSource: OBSERVED` / `API_CONTRACT_UNVERIFIED`, per AMB-EC-12000-002's
      resolution
- [ ] 1.3 Write the Gate 2 review package and pre-filled approval template, and verify
      `npm run validate:artifacts` reports `TPL-REVIEW-SECTIONS` passing for the pending package
- [ ] 1.4 Stop at Gate 2 (`TEST_PLAN_APPROVAL`) and verify the workflow instance shows
      `status: WAITING_FOR_HUMAN` with `pendingApproval` naming the review package

## 2. BDD Design (after Gate 2 clears)

- [ ] 2.1 Author Gherkin scenarios in `features/generated/paper-out-export/*.feature` for every
      approved `TS-EC-12000-*` scenario, tagged `@release-26.3 @capability-paper-out-export
      @EC-12000 @req-... @ac-... @tp-... @ts-...`, and verify `SEM-FEATURE-TAGS` passes
- [ ] 2.2 Tag the API/HYBRID scenarios `@interface-api` / `@interface-hybrid` to match the test plan's
      declared `interfaceType`, and verify `SEM-API-CONTRACT` does not flag a mismatch
- [ ] 2.3 Write the automation design document and Gate 3 approval template under
      `features/generated/paper-out-export/`, listing every locator still `MCP_VALIDATION_REQUIRED`
      and every contract still `API_CONTRACT_UNVERIFIED`
- [ ] 2.4 Stop at Gate 3 (`AUTOMATION_APPROVAL`) and verify the workflow instance shows
      `status: WAITING_FOR_HUMAN`

## 3. Playwright Validation (after Gate 3 clears)

- [ ] 3.1 Use Playwright MCP against the approved UI flow to validate every locator referenced in the
      approved feature files, and verify each resolves without `MCP_VALIDATION_REQUIRED` remaining
- [ ] 3.2 Drive the approved flow that triggers `eoRequestExport` (with and without `mediaType`) and
      capture the real request/response via Playwright MCP network tools, writing
      `reports/validation/TP-EC-12000-001-api-validation.json` with `contractSource: OBSERVED` and a
      `responseShapeHash` computed via `computeResponseShapeHash()`
- [ ] 3.3 Present the observed `eoRequestExport` contract to a human reviewer for promotion to
      `HUMAN_APPROVED` in the test plan before any API-facing acceptance criterion is asserted, and
      verify the updated test plan still validates

## 4. Implementation

- [ ] 4.1 Add the "Media Type for Paper Out Package" section (radio buttons, default selection) to the
      Paper Out Request page object/component, and verify it renders per AC-EC-12000-001
- [ ] 4.2 Implement the acknowledgement modal (checkbox-gated OK, always-enabled Cancel) as its own
      component/page object, and verify AC-EC-12000-002 through -004 pass
- [ ] 4.3 Align the Paper Out Request modal's right-side section borders, and verify AC-EC-12000-019
      visually (screenshot or layout assertion) passes
- [ ] 4.4 Update the Verify Paper Out modal's last checkbox label, and verify AC-EC-12000-018 passes
- [ ] 4.5 Add the `src/api/` client method and `src/models/api/` Zod contract for `eoRequestExport`'s
      `mediaType` element, sourced only from the `HUMAN_APPROVED` contract produced in Task 3.3, and
      verify the API hygiene checks in `SEM-AUTOMATION-HYGIENE` pass
- [ ] 4.6 Implement/adjust step definitions in `steps/` for the new scenarios, keeping locators and
      data out of the step layer, and verify no step-layer violations are reported
- [ ] 4.7 Add `test-data/paper-out-export.sample.json` with `dataClassification: SYNTHETIC_INPUTS`,
      including the approver/requester test values resolved in AMB-EC-12000-003 (Approver = logged-in
      user, Name of Request = "Anil Kumar"), and verify steps load data only from this file

## 5. BDD Generation and Execution

- [ ] 5.1 Move the approved feature files into `features/approved/paper-out-export/` and run
      `npm run bdd`, and verify `.features-gen/**` contains the compiled specs with no undefined steps
- [ ] 5.2 Run `npm run typecheck` and verify it passes with zero errors
- [ ] 5.3 Run `npm test` (or `--grep` scoped to `@capability-paper-out-export`) and verify an honest
      execution record is produced - no fabricated PASSED results - with per-scenario results, report
      path and trace path captured
- [ ] 5.4 If any scenario fails, route through `FAILURE_TRIAGE` per AGENTS.md before touching the RTM;
      an `@interface-api` failure must never enter `LOCATOR_HEALING`

## 6. Traceability and Archive

- [ ] 6.1 Update `traceability/capabilities/paper-out-export.rtm.json` and
      `paper-out-export.coverage.json` from real test-plan, automation and execution data only, and
      verify `npm run validate:rtm` passes
- [ ] 6.2 Run `npx openspec validate track-paper-out-media-type --strict` and verify it passes before
      archiving
- [ ] 6.3 Once the RTM records a real passing execution for all delivered acceptance criteria, run
      `npx openspec archive track-paper-out-media-type` and verify the CLI moves the files into
      `openspec/specs/paper-out-export/`
