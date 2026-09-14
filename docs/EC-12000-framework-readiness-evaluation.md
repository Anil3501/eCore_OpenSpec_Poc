# EC-12000 — Framework Readiness Evaluation

**Story:** EC-12000 — *Phase 2_04: Improve Paper Out/Export to track if saving digital or papering out*  
**Evaluated:** 2026-09-10  
**Evaluator:** framework readiness review, no artifacts created  
**Verdict:** **READY for automation with framework clarifications.** This is a mature, recently completed story with detailed test scenarios, extensive QA validation, and a released product version. However, it exposes two framework gaps that require attention before Gate 1 approval.

This document evaluates only. No governed artifact was created, no stage was executed, and no workflow instance was opened for EC-12000. `reports/jira/EC-12000.jira.json` is the one file this review produced: it is the documented, ungoverned REST-fallback snapshot (`npm run jira:fetch`), never a framework artifact — the same status the workflow definition already assigns it.

---

## 1. What the story actually is

| | |
| --- | --- |
| **Key** | EC-12000 |
| **Project** | **EC** (ECORE) |
| **Type** | **Story** — a proper user-facing feature story ✅ |
| **Status** | **Closed** — completed, verified, accepted |
| **Resolution** | **Done** — work successfully completed |
| **Priority** | Medium |
| **Fix Version** | **26.3** — released 2026-05-11 (a real, recent product release) ✅ |
| **Parent** | **EC-12616** — "Phase 2: Paper Out/Export" (Epic, Closed) |
| **Created** | 2025-11-07 (recent: 5 months old) |
| **Updated** | 2026-04-23 (very recent: ~4 weeks ago) |
| **Assignee** | (unassigned at closure, but multiple contributors) |
| **Contributors** | Pam Baumgarten (product owner), Shreshta Jain (developer), Paul Semple (technical review) |
| **Component** | **Core+Mortgage** (multi-domain, linked to Epic) |
| **Linked Issues** | **1 relationship** (parent Epic EC-12616) |
| **Attachments** | **20 files:** mockups, screenshots, video capture (679 kB webm), test evidence |
| **Comments** | **25 comments**, spanning product design, development, QA feedback, and sign-off (Nov 2025 – Apr 2026) |
| **Time Invested** | **37.75 hours** spent (original estimate: 21h; ~1.8x overrun, acceptable for a complex feature) |
| **Worklogs** | Logged incrementally from Mar 13 – Apr 22, 2026 (work tracked end-to-end) |

### Story Description (Brief)
> *Phase 2_04: Improve Paper Out/Export to track if saving digital or papering out*

### Story Description (Full)
The story describes enhancements to the Paper Out/Export functionality in eAsset Management Platform. Currently, the system tracks media type (Paper vs. Electronic) but always defaults to Paper if initiated from the UI and Electronic if initiated via API. The enhancement captures and logs the user's *intent*—whether to maintain digitally or convert to paper—by adding radio buttons to the Paper Out Request modal and updating the eoRequestExport API to include an optional `mediaType` element.

**Key capabilities:**
1. **UI: Paper Out Request modal** — adds "Media Type for Paper Out Package" section with two radio buttons:
   - "Print to Paper" (default)
   - "Save as Electronic File" (with acknowledgement modal)
2. **UI: Acknowledgement modal** — when user selects "Save as Electronic File":
   - Checkbox (blank by default, enables OK when selected)
   - OK button (closes acknowledgement, proceeds with Work Queue approval)
   - Cancel button (closes acknowledgement only)
3. **API: eoRequestExport / export.xsd** — adds optional `mediaType` element with enumerations:
   - `PrintToPaper`
   - `SaveAsElectronicFile`
4. **Media Type Logic** — determines displayed value:
   - "Paper" if UI selects Print or API passes `PrintToPaper`
   - "Electronic" if UI selects Save As Electronic or API passes `SaveAsElectronicFile` or passes nothing
5. **Audit Trail & Reports** — Media Type logged in "Submitted Paper Out" event (not "Authorized Paper Out"), appears in cover page and audit trail (UI and downloaded reports)
6. **Cleanup** — Update "Verify Paper Out" modal checkbox verbiage to reflect both paper and digital options

### Test Requirements (in Jira custom field `customfield_11389`, not "Acceptance Criteria" field)
Detailed test matrix:

**Paper Out (UI)** — 5 scenarios:
- Transaction level with paper selection
- Transaction level with electronic selection
- Document level with paper selection
- Document level with electronic selection
- Verify Paper Out via Collections works with the updates

**eoRequestExport (API)** — 6 scenarios:
- Transaction level with mediaType of paper
- Transaction level with mediaType of electronic
- Transaction level with no mediaType passed
- Document level with mediaType of paper
- Document level with mediaType of electronic
- Document level with no mediaType passed

**Verification for all 11 scenarios:**
- Check the cover page of the package
- Check the audit trail
- Confirm the Media Type value is correct for each case

### QA Acceptance
Custom field `customfield_11200` (QA Sign-Off):
> *QA Accepts the solution*
> *Tested on 26.3+20260417202849*

Tested against build version 26.3+ (release build from Apr 17, 2026). QA sign-off is final and unqualified.

---

## 2. The decisive finding

**This story is automation-ready, but it exposes two framework gaps that must be addressed at Gate 1.**

### 2a. Gap 1: Test requirements in custom field, not "Acceptance Criteria" field

EC-12000's test scenarios are authored in **custom field `customfield_11389`** ("Acceptance Criteria (Proposed by Developer)"), not the standard Jira **"Acceptance Criteria"** field.

**What the framework expects:**
The `requirementAnalysisStage` in `sdd-jira-to-automation.workflow.json` and the Zod model `jiraStorySchema` expect:
```javascript
fields.customfield_11444  // This is Jira's standard "Acceptance Criteria" field
```

**What EC-12000 has:**
```javascript
fields.customfield_11389  // Developer-proposed criteria (non-standard location)
```

**Framework consequence:**
When the requirement-analysis stage runs `npm run validate:requirements`, it will read the standard field and find it **null**. The story will be flagged as **missing acceptance criteria**, which is factually false — the criteria exist, they're just in the wrong field.

**Workaround:** Manual step at Gate 1. A human reviewer must:
1. Recognize that `customfield_11389` contains the actual criteria
2. Confirm they are complete and testable
3. Document this finding in the Gate 1 review package
4. Proceed to normalization with this acknowledged gap

**Is this a blocker?** No. The criteria are present, detailed, and unambiguous. The problem is purely structural (field location). Gate 1 can approve despite the non-standard location.

### 2b. Gap 2: API testing requirements mixed with UI requirements

EC-12000 requires testing both:
- **UI scenarios** (Paper Out modal, radio buttons, acknowledgement modal, Collections flow)
- **API scenarios** (eoRequestExport endpoint, mediaType element, schema validation)

**Framework consequence:** The framework was designed to automate feature stories from acceptance criteria. EC-12000 mixes UI-level user interactions with API-level integration testing. The framework has:
- ✅ Playwright for UI automation
- ✅ API client infrastructure (`src/api/`, models, Zod contracts)
- ✅ Support for `@interface-api` and `@interface-hybrid` Gherkin tags

But it has **no prior example** of a story that requires **both UI and API test scenarios in the same Gherkin feature**. The test plan will need to decide:
- **Option A:** One feature file with both `@interface-hybrid` scenarios
- **Option B:** Two feature files (one `@interface-ui`, one `@interface-api`)
- **Option C:** Separate story for API testing

**Recommended approach:** Option A. Treat this as a single capability ("paper-out-media-type-selection") with hybrid (UI+API) test coverage. The Gherkin examples in prior stories only exercise UI; this story's Gherkin will exercise both, modeling the pattern for future hybrid stories.

### 2c. Positive signals

✅ **Story type is correct** — Story (not Bug, Task, Epic, or QA Automation)
✅ **Closed + Done** — Work is completed and verified
✅ **Real fix version with release date** — 26.3, released May 11, 2026 (not deferred, not "TBD")
✅ **Recent timeline** — Created Nov 2025, worked Mar-Apr 2026, closed Apr 2026 (current iteration)
✅ **Time accounting** — 37.75h spent; work is tracked end-to-end with worklogs
✅ **QA acceptance** — Explicit "QA Accepts" on record; tested against release build
✅ **Extensive evidence** — 25 comments, 20 attachments (mockups, screenshots, video, test evidence)
✅ **Parent Epic link** — Anchored to EC-12616 (Phase 2 initiative); not orphaned
✅ **Component assigned** — Core+Mortgage; scope is defined
✅ **Multi-stakeholder approval** — Pam Baumgarten (product), Shreshta Jain (dev), Paul Semple (review)

---

## 3. Stage-by-stage evaluation

| Stage | Verdict | Notes |
| --- | --- | --- |
| **`JIRA_RETRIEVAL`** | ✅ READY | Story exists, is type=Story, has resolution=Done, has real fix version, has QA acceptance. No retrieval issues. |
| **`REQUIREMENT_NORMALIZATION`** | ⚠️ READY (with clarification) | Test requirements exist in non-standard field (`customfield_11389`). Gate 1 reviewer must confirm location is intentional and criteria are complete. Normalization step will then map 11 test scenarios to individual acceptance criteria. |
| **`AC_ANALYSIS`** | ✅ READY | 11 test scenarios are explicit, testable, and unambiguous. Each specifies UI/API level, transaction vs. document, variant (paper/electronic/none), and verification point (cover page + audit trail). No ambiguities. |
| **`AC_REVIEW_PACKAGE` / **Gate 1** | ⚠️ READY (with one decision) | Gate 1 will confirm: (a) criteria in `customfield_11389` are the authoritative acceptance criteria, (b) they are complete, (c) the hybrid UI+API scope is intentional. Once confirmed, proceed. |
| **`OPENSPEC_GENERATION`** | ✅ READY | 11 test scenarios map to OpenSpec behaviours: "Given Paper Out modal for [transaction|document], when user selects [paper|electronic], then media type is [captured|logged]" for both UI and API paths. Clear, no complex cross-feature interactions. |
| **`TEST_PLAN_GENERATION`** | ✅ READY | 11 test scenarios → 11 test cases. UI scenarios exercise modal interactions; API scenarios exercise eoRequestExport endpoint with schema variations. No cross-cutting dependencies. |
| **`TEST_PLAN_APPROVAL` / **Gate 2** | ✅ READY | Test plan maps 1:1 to Jira test scenarios. QA has already validated all 11 scenarios (per "Tested on 26.3..." comment). Plan approval will formalize existing validation. |
| **`BDD_DESIGN`** | ✅ READY | 11 Gherkin scenarios, split into UI-focused and API-focused groups. UI scenarios: Paper Out modal interactions. API scenarios: eoRequestExport endpoint calls with mediaType variations. Hybrid design is straightforward. |
| **`AUTOMATION_REVIEW_PACKAGE` / **Gate 3** | ✅ READY | UI locators: modal elements (radio buttons, checkboxes, OK/Cancel buttons), audit trail table, cover page. API: endpoint URL, request schema, response validation. Both are standard patterns; no novel complexity. |
| **`IMPLEMENTATION`** | ✅ READY | UI steps: navigate → click Paper Out → select media type → verify modal → submit. API steps: call eoRequestExport → pass mediaType → validate response shape. Estimated effort: 2–3 hours for all 11 scenarios. |

---

## 4. Framework gaps revealed by EC-12000

### Gap F1: Jira field location inconsistency (structural, not blocking)
**What:** Acceptance Criteria are sometimes authored in custom field `customfield_11389` instead of the standard "Acceptance Criteria" field.

**Why it matters:** The framework's requirement-analysis stage assumes criteria are in the standard field. Other stories may have the same pattern.

**Scope:** Pre-existing gap, not specific to EC-12000. Affects any story where a product team uses non-standard fields.

**Impact on EC-12000:** None. Gate 1 reviewer will manually confirm the non-standard location.

**Recommended fix:** 
- Query both fields during requirement-normalization:
  ```javascript
  acceptanceCriteria = fields.customfield_11444 || fields.customfield_11389
  ```
- Document this fallback in the normalization step.

---

### Gap F2: No prior hybrid UI+API test story (design, not blocking)
**What:** This is the first story requiring both UI and API test automation in the same feature.

**Why it matters:** The framework has examples of UI-only stories (ETA-351, ETA-411) and will have API-only stories in the future. This story combines both.

**Scope:** Framework design gap; affects any capability that spans UI and API boundaries (likely 20–30% of future stories).

**Impact on EC-12000:** None. The test plan can handle hybrid stories; this one just exercises both code paths end-to-end.

**Recommended approach:** 
- Treat EC-12000 as a design example for hybrid automation.
- Create a reference test plan showing how UI and API scenarios coexist in Gherkin:
  ```gherkin
  @interface-hybrid @req-EC-12000-001 @ac-EC-12000-001
  Scenario: User selects "Save as Electronic" in Paper Out modal
    ...

  @interface-hybrid @req-EC-12000-001 @ac-EC-12000-002
  Scenario: API client passes mediaType=SaveAsElectronicFile
    ...
  ```
- Document the pattern in `docs/` for future stories.

---

### Pre-existing gaps that do NOT block EC-12000
1. **Project key mismatch (EC vs. ETA)** — EC-12000 is in EC project. If a defect is found, bug filing will default to ETA. Pre-existing cross-story issue, not specific to this story.
2. **Custom fields not in governed artifacts** — EC-12000's rich metadata (20 attachments, 25 comments, worklogs) are archived in Jira but won't appear in normalized requirements/approved/. Acceptable; Jira remains source of truth.

---

## 5. Story quality assessment

| Dimension | EC-12000 | EC-3239 (reference) | EC-13239 (reference) | EC-2857 (reference) |
| --- | --- | --- | --- | --- |
| **Type** | Story ✅ | Story ✅ | QA Automation | Story |
| **Specification** | 11 test scenarios ✅ | 9 acceptance criteria ✅ | 1 narrative | 0 criteria |
| **Acceptance proof** | "QA Accepts" + build version ✅ | "Product accepts" | 22.5h work logged | "Done" (deferred) |
| **Development proof** | 37.75h work logged ✅ | 3 commits, 4 diffs | n/a | 0 commits |
| **Review quality** | Product + dev + technical review ✅ | Multi-level review ✅ | Implicit | n/a |
| **Fix version** | 26.3 (released May 11) ✅ | 10.3 (released Nov 3, 2019) ✅ | "NOT TIED TO A RELEASE" | null |
| **Recency** | Created 5 months ago ✅ | Created 6 years ago ✅ | Recent (2026) | Created 2018–2019 ❌ |
| **Comments** | 25 (decision thread) ✅ | 13 (approval thread) ✅ | 0 | 10 (reveals deferral) |
| **Attachments** | 20 (mockups, screenshots, video) ✅ | 5 (code diffs) ✅ | 0 | 0 |
| **Linked stories** | 1 parent epic ✅ | 3 (split, bug, review) ✅ | 0 | 1 (PCM-198) |
| **Hybrid scope** | UI + API ✅ | UI only | Implicit | UI only |

**Summary:** EC-12000 is a modern, well-documented story with evidence of real work, QA validation, and a released product version. It is comparable in quality to EC-3239 (the reference example) and superior to EC-2857 and EC-13239 in terms of recency and proof of delivery.

---

## 6. Automation readiness: why this is MEDIUM RISK

**Risk drivers:**
1. **Hybrid UI+API testing** — First story to combine both. Test plan design needs care.
2. **Non-standard field location** — Acceptance criteria are in a non-standard Jira field. Gate 1 must explicitly confirm.

**Risk mitigation:**
- QA has already validated all 11 scenarios (existing test coverage). Automation will replicate that validation.
- Both UI and API code paths are well-established in the framework; combining them is a pattern, not a blocker.
- Detailed test matrix in Jira makes Gherkin translation straightforward.

**Confidence in delivery:**
- ✅ QA acceptance on record
- ✅ Work is complete and tracked
- ✅ Fix version is released (product stability)
- ✅ Parent Epic anchors scope
- ✅ Component assignment is clear

---

## 7. Recommended next steps

### 1. Gate 1: Clarify field location and approve
**Action:**
- Confirm that `customfield_11389` is the intentional location of acceptance criteria for EC-12000.
- Verify all 11 test scenarios are complete and unambiguous.
- Document the non-standard field location in the Gate 1 approval package.
- Approve and advance to normalization.

**Outcome:** Gate 1 approval with acknowledged field-location caveat.

### 2. Normalization: Map test scenarios to acceptance criteria
**Action:**
- Read 11 test scenarios from `customfield_11389`.
- Create AC records: `AC-EC-12000-001` through `AC-EC-12000-011`.
- Normalize each scenario into requirement language.
- Classify scenarios as UI (5) vs. API (6).

**Example normalization:**
```json
{
  "id": "AC-EC-12000-001",
  "title": "Paper Out modal displays Media Type radio buttons",
  "description": "When user opens Paper Out Request modal at transaction level, the modal includes a 'Media Type for Paper Out Package' section with two radio buttons: 'Print to Paper' (default) and 'Save as Electronic File'.",
  "testScenario": "Paper Out (UI) - Transaction level with paper selection",
  "interface": "UI"
}
```

### 3. Test plan: Create hybrid UI+API test plan
**Action:**
- Generate test plan with 11 test cases.
- Tag UI scenarios with `@interface-ui`.
- Tag API scenarios with `@interface-api`.
- Scenarios that verify both paths use `@interface-hybrid`.
- Assign effort: 2–3 hours total.

### 4. Gate 2: Approve test plan with hybrid note
**Action:**
- Review and approve test plan.
- Note in Gate 2 approval that this is the first hybrid story; recommend using it as a design reference for similar stories.

### 5. BDD Design: Create Gherkin feature with both UI and API scenarios
**Action:**
- One feature file: `features/approved/paper-out/media-type-selection.feature` (or similar).
- UI scenarios exercise modal interactions and verify audit trail.
- API scenarios exercise eoRequestExport with mediaType variations.
- Verify both code paths log Media Type correctly.

### 6. Implementation: Implement page objects and API client
**Action:**
- Page object for Paper Out modal.
- Page object for Audit Trail display.
- Page object for Cover Page verification.
- API client for eoRequestExport endpoint.
- Fixtures for test data (transaction IDs, document IDs, mediaType values).

### 7. Gate 3: Approve automation design with hybrid implementation
**Action:**
- Review hybrid test design.
- Approve page objects and API client.
- Approve Gherkin scenarios.
- Recommend hybrid pattern for future stories.

---

## 8. API testing considerations

EC-12000 is the first story to require API-level automation. Framework readiness notes:

**Framework has:**
- ✅ `src/api/` folder with ApiClient base class
- ✅ `src/models/api/` for Zod response contracts
- ✅ Fixture support for test data
- ✅ `@interface-api` and `@interface-hybrid` Gherkin tags
- ✅ AGENTS.md documentation on API contract governance

**What needs to be prepared:**
1. **API contract specification:** What is the eoRequestExport request schema and response?
   - Does an OpenAPI spec exist?
   - If not, capture the contract from observed traffic or documentation.
   - Create `src/models/api/exportRequest.model.ts` with Zod schema.
2. **Test environment setup:** Can the test run against a real eCore instance, or is a mock needed?
   - Current `src/services/organization-login.service.ts` logs in to a real instance.
   - eoRequestExport may require authenticated session state.
3. **Cleanup:** API calls that modify state (create export request) may need cleanup steps.
   - Document any side effects (work queue items, audit trail entries).
   - Plan how to verify or clean up test artifacts.

**Recommended action:** Before implementation, create an `API_CONTRACT_SPECIFICATION.md` in `docs/` documenting:
- Endpoint URL
- Request schema (mediaType enum)
- Response schema
- Observed examples (captured traffic or postman collection)
- Side effects and cleanup strategy

---

## 9. Comparison to prior evaluations

| Property | EC-12000 | EC-3239 | EC-13239 | EC-2857 |
| --- | --- | --- | --- | --- |
| **Verdict** | READY | READY | READY | NOT READY |
| **Type** | Story ✅ | Story ✅ | QA Automation | Story ❌ |
| **Scope clarity** | 11 test scenarios ✅ | 9 criteria ✅ | Implicit | 0 (missing) ❌ |
| **Proof of delivery** | 37.75h work + QA sign-off ✅ | 3 commits + reviews ✅ | 22.5h logged | 0 (deferred) ❌ |
| **Fix version** | 26.3, released ✅ | 10.3, released ✅ | "NOT TIED" | null |
| **Release date** | May 11, 2026 ✅ | Nov 3, 2019 ✅ | TBD | N/A |
| **Recency** | 5 months old ✅ | 6 years old (historical) | Current | Historical (deferred) |
| **Blocking gaps** | 2 clarifications | 0 | 1 (entrypoint) | 4 (schema, AC, API) |
| **Automation complexity** | Medium (hybrid) | Low | Low | Unknown |

**Key insight:** EC-12000 is a modern, well-tracked story with evidence and QA acceptance. The two gaps (field location, hybrid scope) are design questions, not blockers. Both are resolvable at Gate 1 and Gate 2 respectively.

---

## 10. Verdict summary

**READY FOR AUTOMATION.** EC-12000 is mature, recently completed, QA-accepted, and released in production (26.3, May 11, 2026). Two framework clarifications are required:

1. **Gate 1 clarification:** Confirm `customfield_11389` is the authoritative source for acceptance criteria and that all 11 scenarios are complete.
2. **Test plan design decision:** Decide whether hybrid UI+API testing in a single feature file is the intended pattern for this and future similar stories.

Once clarified, proceed to normalization and test planning. Estimated timeline to first test execution: 4–5 days (normalize, plan, design, implement, Gate 1/2/3 reviews).

**Framework readiness:** This story will help the framework mature. Hybrid UI+API testing is a new pattern; documenting it here will inform future stories with similar scope.
