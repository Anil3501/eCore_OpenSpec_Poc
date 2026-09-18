# Comprehensive Architectural & Implementation Plan: Test Case Reusability, Lifecycle Management, and Autonomous Workflow Execution

## 1. Executive Summary & Review Queries Matrix

This document provides a comprehensive architectural strategy, design patterns, governance rules, and implementation roadmap for enterprise-scale test automation in the OpenSpec-driven Playwright-BDD framework.

Below are the 6 core architectural review questions presented for evaluation across framework capabilities and modules:

| # | Domain / Query Topic | Review Question | Key Recommendation Summary |
|---|---|---|---|
| **Q1** | **Cross-Release Test Impact & Modification** | *“Let's assume that I have automated a story and completed all steps and gates for this, and after a few releases another story comes to me for automation and it is impacting a few of the test cases which have been already automated in the previous releases' stories. How is my framework supposed to handle this situation and what is your recommendation for this?”* | Use OpenSpec Delta Specs (`MODIFIED`/`REMOVED`) + Test Plan `scenarioAction: "UPDATE" \| "RETIRE"`. Increment RTM capability `artifactVersion` while keeping historical `EXEC-*` records immutable. |
| **Q2** | **Cross-Story Test Reuse vs. Duplication** | *“Let's assume further that a story has been automated already and in next release cycle or after few releases another story comes but this new one has one or more test cases/test scenarios which have been already automated in the previous release. I don't think that creating a duplicate test case for the new story is good practice instead of reusing old test cases/scenarios. What is your recommendation?”* | Adopt a 3-Tier Reusability Model: Global Step Definition reuse (Tier 1), Domain Service & Fixture Preconditions (Tier 2), and RTM Scenario-Level Mapping via `scenarioAction: "REUSE"` (Tier 3) to satisfy `SEM-NO-DUPLICATES` with 0 duplicate tests. |
| **Q3** | **Page Object & Locator Lifecycle Management** | *“When you are already creating page object modules, are you using objects of same pages in different stories if required or are you creating new locators for new stories every time? What is your recommendation for this?”* | Page Objects (`src/pages/`) and Components (`src/components/`) represent physical application surfaces, not stories. Check existing views first and extend existing classes with role-based locators. Never duplicate page objects across stories. |
| **Q4** | **Autonomous Pipeline Execution Between Gates** | *“If any given story is having all details and no question is asked which is supposed to be answered by human, then I want that my framework should only stop on human approval gates and all stages of the framework should be executed autonomously without any human confirmation. What is the solution for this without compromising with framework structure?”* | Enforce 4 Autonomous Execution Epochs bounded exclusively by the 3 Human Approval Gates. When `AMB_COUNT === 0`, stages 1–4, 5–6, 7–8, and 9–16 execute end-to-end without interactive chat stops. |
| **Q5** | **Multi-Role Credentials & Dynamic Data Management** | *“I'm working on application automation which is complex in nature and it may be possible that for some stories or test cases special login details/api tokens are required so I don't think giving all users details in .env file is good practice. What is your recommendation for this and how to resolve it? Because some of my test cases may use dynamic locators while for some test cases I have to provide a specific ID of a transaction.”* | Role-based credential dictionaries in `config/environments/<profile>.json` accessed via lazy typed getters (`env.requireRoleCredentials('admin')`), scenario-scoped fixture state (`HybridExportContext`) for dynamic IDs, and parameterized semantic locators. |
| **Q6** | **Enterprise Flow Smoothing & Discoverability** | *“Any other ideas which you think are good to have for smoothing the flow?”* | Automated Gherkin Step Catalog (`npm run docs:steps`), Capability Asset Lookup CLI (`npm run lookup`), CI Suite Matrix Tagging, and Governed Teardown Hook Registries. |

---

## 2. In-Depth Solutions, Architectural Rationale & Recommendations for Each Query

---

### Query 1: Handling Stories Impacting Pre-Existing Test Cases (Cross-Release Modification)

> **User Review Question:**
> *"Let's assume that I have automated a story and completed all steps and gates for this, and after a few releases another story comes to me for automation and it is impacting a few of the test cases which have been already automated in the previous releases' stories. How is my framework supposed to handle this situation and what is your recommendation for this?"*

#### The Scenario & Problem Context
- In Release 1.0, Story `ETA-351` automated the happy path login (`TS-ETA-351-001`).
- In Release 2.0, Story `ETA-500` introduces mandatory Multi-Factor Authentication (MFA) or alters the post-login dashboard workflow.
- Running the existing `TS-ETA-351-001` against Release 2.0 will fail because the application workflow has fundamentally changed.

#### Recommended Architectural Solution
1. **OpenSpec Delta Specification (`openspec/changes/<change-name>/specs/<capability>/spec.md`):**
   - Story `ETA-500` creates an OpenSpec delta specification targeting the living capability spec (`openspec/specs/<capability>/spec.md`).
   - Requirements are tagged with delta markers:
     - `MODIFIED: REQ-ETA-351-001` (updates behavior from single-factor to MFA).
     - `ADDED: REQ-ETA-500-001` (new MFA verification step).
     - `REMOVED: REQ-ETA-351-003` (deprecated legacy bypass rule).
2. **Test Plan Scenario Action (`scenarioAction: "UPDATE" | "RETIRE"`):**
   - In Stage 6 (`TEST_PLAN_GENERATION`), the test plan `TP-ETA-500-001.json` declares the action for the existing scenario:
     ```json
     {
       "testScenarioId": "TS-ETA-351-001",
       "title": "Organization sign-in with MFA verification",
       "scenarioAction": "UPDATE",
       "artifactVersion": "2.0.0",
       "changeType": "MODIFIED",
       "acIds": ["AC-ETA-500-001", "AC-ETA-500-002"],
       "capability": "account-access",
       "interface": "UI",
       "notes": "Updated to reflect MFA challenge screen introduced in Release 2.0"
     }
     ```
   - If a scenario is no longer valid, it is declared with `scenarioAction: "RETIRE"` and `automationStatus: "RETIRED"`.
3. **Feature File & Step Evolution:**
   - For `scenarioAction: "UPDATE"`, the existing Gherkin feature file (`features/approved/account-access/organization-sign-in.feature`) is updated in place, retaining its stable `@ts-TS-ETA-351-001` tag and adding `@release-2.0` and `@req-REQ-ETA-500-001` tags.
4. **Immutability of Historical Execution Records:**
   - Historical execution records (`traceability/executions/EXEC-ETA-351-001.json`) from Release 1.0 are **never modified or deleted** — they remain frozen evidence of R1.0 quality.
   - The new run creates `traceability/executions/EXEC-ETA-500-001.json` for Release 2.0.
5. **RTM Capability Partition Versioning:**
   - `traceability/capabilities/account-access.rtm.json` increments its `artifactVersion` (e.g. `1.0.0` -> `2.0.0`), records `changeType: "MODIFIED"`, and updates the scenario mapping.

#### Detailed Reasoning & Why We Recommend This Approach
- **Compliance & Audit Integrity:** Regulated enterprise environments require historical test runs to remain immutable. Versioning RTM partitions while preserving historical `EXEC-*` records satisfies ISO/SOC2 audits.
- **Single Source of Truth:** Evolving feature files in place avoids orphan `.feature` files representing obsolete legacy functionality.
- **Intent-Driven Engineering:** Explicit `scenarioAction` (`UPDATE` vs `CREATE` vs `RETIRE`) clearly signals test intention to reviewers at Gate 2 and Gate 3.

---

### Query 2: Reusing Existing Test Scenarios in Future Stories Without Duplication

> **User Review Question:**
> *"Let's assume further that a story has been automated already and in next release cycle or after few releases another story comes but this new one has one or more test cases/test scenarios which have been already automated in the previous release. I don't think that creating a duplicate test case for the new story is good practice instead of reusing old test cases/scenarios. What is your recommendation?"*

#### The Scenario & Problem Context
- Story `ETA-600` (e.g. "Export Transaction Records") requires the user to sign in as an Organization User before navigating to exports.
- `AC-ETA-600-001` states: "User must successfully authenticate before accessing export functions."
- If the engineer or AI agent creates a new feature file `features/approved/export/export-login.feature` with scenario "Organization sign-in", it violates `SEM-NO-DUPLICATES`, inflates test execution time, and creates redundant test code.

#### Recommended Architectural Solution & 3-Tier Reusability Model
```
┌────────────────────────────────────────────────────────────────────────┐
│                        3-TIER REUSABILITY MODEL                        │
├────────────────────────────────┬───────────────────────────────────────┤
│ Tier 1: Step-Level Reuse       │ Global Given/When/Then steps across   │
│ (Micro / Syntax)               │ steps/**/*.steps.ts                   │
├────────────────────────────────┼───────────────────────────────────────┤
│ Tier 2: Domain Preconditions   │ Background services & fixtures        │
│ (Macro / State Setup)          │ (OrganizationLoginService, Fixtures)  │
├────────────────────────────────┼───────────────────────────────────────┤
│ Tier 3: RTM Cross-Story Link   │ scenarioAction: "REUSE" in Test Plan  │
│ (Governance / Coverage)        │ Maps AC directly to existing TS       │
└────────────────────────────────┴───────────────────────────────────────┘
```

1. **Tier 1: Global Step Definition Reuse:**
   - Step definitions in `steps/**/*.steps.ts` are globally available to all feature files.
   - New feature files reuse existing steps (e.g. `Given I am signed in as an organization user`) without authoring new step definitions.
2. **Tier 2: Domain Service & Fixture Composition for Backgrounds:**
   - When a scenario needs sign-in purely as a precondition, the feature file uses:
     ```gherkin
     Background:
       Given I am signed in as an organization user
       And I have navigated to the "Workspace" module
     ```
   - Under the hood, this invokes `OrganizationLoginService` and domain fixtures directly, avoiding repetitive multi-page UI steps.
3. **Tier 3: RTM Cross-Story Requirement Linking (`scenarioAction: "REUSE"`):**
   - When `AC-ETA-600-001` is already fully satisfied by `TS-ETA-351-001`, the test plan `TP-ETA-600-001.json` explicitly declares:
     ```json
     {
       "testScenarioId": "TS-ETA-351-001",
       "title": "Organization sign-in with valid credentials",
       "scenarioAction": "REUSE",
       "acIds": ["AC-ETA-600-001"],
       "capability": "account-access",
       "existingArtifactPath": "features/approved/account-access/organization-sign-in.feature"
     }
     ```
   - In `traceability/capabilities/account-access.rtm.json`, `AC-ETA-600-001` is linked to `TS-ETA-351-001`.
   - **No new `.feature` file is written for this AC.**
   - `SEM-NO-DUPLICATES` passes with zero errors, and RTM coverage reaches 100% with full audit traceability.

#### Detailed Reasoning & Why We Recommend This Approach
- **Eliminates Suite Bloat:** Prevents executing redundant 30-second browser tests that provide zero additional quality signals.
- **Zero Maintenance Overhead:** A change in the login page requires updating only 1 feature file and 1 step file, instead of 50 duplicated files across different directories.
- **Honest Requirement Coverage:** The RTM proves `AC-ETA-600-001` is verified by an existing, passing automated test without fabricating duplicate tests.

---

### Query 3: Page Object Module & Locator Reuse vs. Recreation

> **User Review Question:**
> *"When you are already creating page object modules, are you using objects of same pages in different stories if required or are you creating new locators for new stories every time? What is your recommendation for this?"*

#### The Scenario & Problem Context
- If every new story authors its own page objects (e.g. `Story1WorkspacePage`, `Story2WorkspacePage`), locator definitions drift, duplicate selectors proliferate, and UI redesigns break hundreds of disconnected classes.

#### Recommended Architectural Solution
1. **Domain-Driven Page Object Architecture (Application Surfaces, Not Stories):**
   - `src/pages/`: Represents whole document surfaces (e.g. `EcoreLoginPage`, `EcoreWorkspacePage`, `EcoreVaultPage`).
   - `src/components/`: Represents reusable widgets, modals, and overlays (e.g. `PaperOutRequestModalComponent`, `WorkQueueComponent`, `NavigationMenuComponent`).
   - `src/services/`: Represents end-to-end multi-page user journeys (e.g. `OrganizationLoginService`, `PaperOutExportService`).
2. **Page Object Discovery Protocol (Before Authoring):**
   - During Stage 10 (`IMPLEMENTATION`), the orchestrator and sub-agents first inspect `src/pages/` and `src/components/`.
   - If the screen or component already exists:
     - The agent **extends** the existing class by adding new methods or control getters.
     - Existing locators and methods are preserved.
   - If and only if an entirely new UI surface is introduced, a new class is created following the naming convention `<surface-name>.page.ts` or `<widget-name>.component.ts`.
3. **Strict Locator Priority & Validation Rules:**
   - Locators must follow the standard accessibility priority chain:
     $$\text{getByRole} \longrightarrow \text{getByLabel} \longrightarrow \text{getByPlaceholder} \longrightarrow \text{getByText} \longrightarrow \text{getByTestId}$$
   - Any raw CSS/locator string requires a `// VALIDATED -` comment with MCP evidence.
   - XPath, `.nth()` index selectors, and hardcoded `page.waitForTimeout()` remain strictly prohibited by `SEM-AUTOMATION-HYGIENE`.

#### Detailed Reasoning & Why We Recommend This Approach
- **Encapsulation of UI Change:** When eCore changes an HTML button or input, editing a single Page Object method repairs every automated test in the repository.
- **Architectural Cleanliness:** High cohesion and low coupling across tests, steps, and UI elements.

---

### Query 4: Autonomous Pipeline Execution Between Human Approval Gates

> **User Review Question:**
> *"If any given story is having all details and no question is asked which is supposed to be answered by human, then I want that my framework should only stop on human approval gates and all stages of the framework should be executed autonomously without any human confirmation. What is the solution for this without compromising with framework structure?"*

#### The Scenario & Problem Context
- When a Jira story contains all necessary business rules, acceptance criteria, and API/UI specs with zero ambiguities (`AMB_COUNT === 0`), stopping to ask interactive questions at every intermediate stage creates unnecessary friction and delays.

#### Recommended Architectural Solution & 4 Autonomous Epochs
The SDD Workflow Orchestrator enforces 4 execution epochs bounded exclusively by the 3 Human Approval Gates:

```
┌────────────────────────────────────────────────────────────────────────┐
│                     THE 4 AUTONOMOUS WORKFLOW EPOCHS                   │
├────────────────────────────────────────────────────────────────────────┤
│  EPOCH 1: Intake & AC Analysis (Autonomous)                            │
│  Stage 1 (JIRA_RETRIEVAL) ──> Stage 2 (REQUIREMENT_NORMALIZATION) ──>  │
│  Stage 3 (AC_ANALYSIS) ──> Stage 4 (AC_REVIEW_PACKAGE)                 │
│                                                                        │
│  🛑 GATE 1: AC_APPROVAL (Human signs requirements/approved/*.json)     │
├────────────────────────────────────────────────────────────────────────┤
│  EPOCH 2: Spec & Test Strategy (Autonomous)                            │
│  Stage 5 (OPENSPEC_GENERATION) ──> Stage 6 (TEST_PLAN_GENERATION)      │
│                                                                        │
│  🛑 GATE 2: TEST_PLAN_APPROVAL (Human signs test-plans/approved/*.json)│
├────────────────────────────────────────────────────────────────────────┤
│  EPOCH 3: BDD & Automation Design (Autonomous)                         │
│  Stage 7 (BDD_DESIGN) ──> Stage 8 (AUTOMATION_REVIEW_PACKAGE)          │
│                                                                        │
│  🛑 GATE 3: AUTOMATION_APPROVAL (Human signs features/approved/*.json) │
├────────────────────────────────────────────────────────────────────────┤
│  EPOCH 4: Implementation, Validation & Completion (Autonomous)         │
│  Stage 9 (PLAYWRIGHT_VALIDATION) ──> Stage 10 (IMPLEMENTATION) ──>     │
│  Stage 11 (BDD_GENERATION) ──> Stage 12 (EXECUTION) ──>                │
│  Stage 13 (FAILURE_TRIAGE / HEALING) ──> Stage 14 (RTM_UPDATE) ──>     │
│  Stage 15 (OPENSPEC_ARCHIVE) ──> Stage 16 (COMPLETED)                  │
└────────────────────────────────────────────────────────────────────────┘
```

- **Zero-Ambiguity Fast-Forward Rule:** When `AMB_COUNT === 0`, all non-gate stages transition automatically without prompting the user.
- **Autonomous Failure Branching in Epoch 4:**
  - If tests pass: Transitions directly to `RTM_UPDATE` -> `OPENSPEC_ARCHIVE` -> `COMPLETED`.
  - If a UI test fails: Executes `FAILURE_TRIAGE` -> `LOCATOR_HEALING` (up to 2 attempts) -> re-run.
  - If an API test fails or locator healing fails: Executes `BUG_REPORTING` (requires human confirmation before filing Jira ticket) -> `RTM_UPDATE` -> `COMPLETED`.

#### Detailed Reasoning & Why We Recommend This Approach
- **High Throughput with Zero Governance Loss:** Reduces manual touchpoints from 16 manual command prompts down to exactly 3 meaningful review checkpoints.
- **Full Non-Negotiable Rule Compliance:** Rule 1 ("A chat message is never an approval. Only a schema-valid JSON artifact on disk counts") remains 100% enforced.

---

### Query 5: Multi-Role Credentials, Dynamic Identifiers & Secret Management

> **User Review Question:**
> *"I'm working on application automation which is complex in nature and it may be possible that for some stories or test cases special login details/api tokens are required so I don't think giving all users details in .env file is good practice. What is your recommendation for this and how to resolve it? Because some of my test cases may use dynamic locators while for some test cases I have to provide a specific ID of a transaction."*

#### The Scenario & Problem Context
- Complex enterprise applications have multiple roles (e.g. `StandardUser`, `AdminUser`, `ComplianceAuditor`, `ApiIntegrationUser`).
- Storing dozens of plain-text passwords or tokens in a flat `.env` file is dangerous, brittle, and unmaintainable.
- Tests often create dynamic records (e.g. `Batch_2026_09_16_A49`, dynamic transaction IDs) that cannot be hardcoded in `.env` or feature files.

#### Recommended Architectural Solution
1. **Multi-Role Environment Credential Resolution:**
   - Multi-environment profiles (`config/environments/<profile>.json`) define role structures:
     ```json
     {
       "profile": "qa5",
       "baseUrl": "https://qa5.ecore.internal",
       "roles": {
         "standard": {
           "usernameEnvKey": "ECORE_USER",
           "passwordEnvKey": "ECORE_PASSWORD"
         },
         "admin": {
           "usernameEnvKey": "ECORE_ADMIN_USER",
           "passwordEnvKey": "ECORE_ADMIN_PASSWORD"
         },
         "auditor": {
           "usernameEnvKey": "ECORE_AUDITOR_USER",
           "passwordEnvKey": "ECORE_AUDITOR_PASSWORD"
         },
         "api_service": {
           "apiKeyEnvKey": "ECORE_API_KEY",
           "apiUserEnvKey": "ECORE_API_USER"
         }
       }
     }
     ```
   - In `src/utils/env.ts`, provide lazy, type-safe role accessors:
     ```ts
     env.getRoleCredentials('admin');
     env.requireRoleCredentials('admin');
     env.getApiCredentials();
     ```
   - Real secret values reside in environment variables or local `.env` (git-ignored), never in committed JSON profiles.
2. **Dynamic Transaction & Batch State in Scenario-Scoped Fixtures:**
   - Dynamic identifiers generated during a test are encapsulated in scenario fixture state (e.g. `HybridExportContext` in `src/fixtures/paper-out-export.fixture.ts`):
     ```ts
     export interface HybridExportContext {
       batchId?: string;
       transactionId?: string;
       exportedRecordCount?: number;
     }
     ```
   - Steps read and write to this context object within the test runner process.
3. **Parameterized Accessible Locators in Page Objects:**
   - Dynamic elements (such as grid rows matching a dynamic ID) use parameterized methods:
     ```ts
     getTransactionRow(transactionId: string): Locator {
       return this.page.getByRole('row', { name: new RegExp(transactionId, 'i') });
     }
     ```

#### Detailed Reasoning & Why We Recommend This Approach
- **Robust Security:** Secrets are never committed; role mappings are decoupled from credentials.
- **Parallel Execution Safety:** Scenario-scoped fixtures ensure dynamic IDs are completely isolated per worker process with zero cross-test collision.

---

### Query 6: Additional Enterprise Recommendations for Flow Smoothing

> **User Review Question:**
> *"Any other ideas which you think are good to have for smoothing the flow?"*

#### Recommended Architectural Enhancements
1. **Step Definition Catalog Generator (`npm run docs:steps`):**
   - Automatically scans `steps/**/*.steps.ts` using TypeScript AST parsing to produce `docs/step-definition-catalog.md`.
   - Categorizes all available Given/When/Then steps with parameter signatures, docstrings, and usage examples.
2. **Capability Asset Lookup CLI (`npm run lookup -- <capability|term>`):**
   - A fast CLI querying `traceability/index/lookup.index.json`, page objects, components, and fixtures.
   - Allows AI agents and engineers to discover existing assets before drafting new files.
3. **Automated Suite Matrix Filtering in CI:**
   - Enforce standard suite tags: `@suite-smoke`, `@suite-regression`, `@suite-critical`, `@interface-ui`, `@interface-api`, `@interface-hybrid`.
   - Allows CI pipelines to run focused test slices across parallel workers.
4. **Governed Teardown Hook Registry:**
   - Formalize `CLEANUP -` lifecycles in fixtures to ensure any created transactional test data is automatically cancelled or rolled back, preserving shared QA environments.

---

## 3. Step-by-Step Implementation Roadmap

| Phase | Description | Key Files & Artifacts |
|---|---|---|
| **Phase 1: Scenario Reusability & Modification Engine** | Enable `scenarioAction: "REUSE" \| "UPDATE" \| "RETIRE"` across test plan models, RTM capability updater, and `SEM-NO-DUPLICATES` semantic rules. | `src/models/test-plan.model.ts`, `src/utils/semantic-rules.ts`, `src/utils/rtm-merge.ts` |
| **Phase 2: Step Definition Catalog & Lookup Tooling** | Create automated step catalog generator script and asset lookup helper. | `scripts/generate-step-catalog.ts`, `scripts/lookup-asset.ts`, `package.json` |
| **Phase 3: Multi-Role Credentials & Dynamic Locator Helpers** | Extend `src/utils/env.ts` with role-based credential getters and document parameterized locator patterns. | `src/utils/env.ts`, `config/environments/qa.json.example` |
| **Phase 4: Autonomous Epoch Controller in Orchestrator** | Configure the 4 autonomous workflow epochs in the SDD Workflow Orchestrator. | `workflow/definitions/sdd-jira-to-automation.workflow.json`, `.github/agents/sdd-workflow-orchestrator.agent.md` |
| **Phase 5: Framework Documentation & Governance Updates** | Save final plan to `docs/test-case-reusability-lifecycle-and-automation-plan.md` and update `AGENTS.md`, instructions, and sequence docs. | `docs/test-case-reusability-lifecycle-and-automation-plan.md`, `AGENTS.md`, `.github/instructions/*.md` |

---

## 4. Verification & Non-Breaking Guarantee

1. **Schema & Semantic Parity:** All modified schemas and models must pass `npm run validate:artifacts` (23+ semantic checks).
2. **TypeScript Compilation:** Zero errors under `npm run typecheck` (`erasableSyntaxOnly: true`, explicit `.ts` extensions).
3. **Zero Impact on Existing Approvals:** Existing approved artifacts (`ETA-351`, `ETA-411`) remain fully valid and pass all checks without modification.
