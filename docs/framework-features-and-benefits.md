# Framework Features & Benefits

> **Purpose of this document.** A comprehensive talk-track and architectural reference for presenting
> this framework to stakeholders — engineering leads, QA managers, product owners, or executive
> sponsors. It is organized as **feature → why it matters (benefit)**, mapping the journey from a
> raw Jira ticket to an executed, traceable, and living test suite. Every statement in this document
> is grounded in the actual implementation within this repository (see [README.md](../README.md) and
> [AGENTS.md](../AGENTS.md)).

---

## 1. The One-Line Pitch

**A Jira story becomes an approved, traceable, executable Playwright-BDD test — through a durable,
resumable, agent-driven workflow with three mandatory human approval gates — without engineers
authoring repetitive boilerplate, and without an AI agent ever being trusted to approve its own work.**

---

## 2. Executive Comparison: Why Governed SDD?

| Capability | Traditional Manual Automation | Ungoverned GenAI Coding | Governed SDD Framework (This POC) |
| --- | --- | --- | --- |
| **Intake & Scope** | Manual test authoring; unclear requirement gaps until bugs arise | Scrapes story and hallucinates missing business rules | Normalizes story, flags ambiguities (`AMB-*`), generates rationale-backed AC proposals |
| **Trust & Approvals** | Peer PR review after code is already written | Zero formal gates; agent generates and merges code silently | **3 Human Gates** (ACs, Test Plan, Automation Design); disk artifacts verified by schema |
| **Locator & API Quality** | Manual inspection in DevTools; fragile selectors prone to drift | Guesses selectors and endpoints from LLM memory | **No Guessing**: MCP validation against live DOM; API contracts verified with shape hashes |
| **UI + API Integration** | Separate siloed UI suites and Postman/API collections | Inconsistent mixing of UI and network calls | **First-class `HYBRID` mode**: One business scenario validates both screen and backend calls |
| **Execution State** | One-shot scripts; if interrupted, start over from scratch | Black-box LLM context; loops indefinitely on failures | **Durable State Machine**: 18 stages, single-stage execution, resumes at exact checkpoint |
| **Traceability & RTM** | Manually updated spreadsheets or stale Jira plugins | No traceability; tests disconnected from Jira IDs | **Automated, Partitioned RTM**: 4 honest coverage metrics; scales beyond 3,000+ tests |
| **Failure Handling** | Manual triage; repetitive bug logging in Jira | Modifies test assertions to force green runs | **Governed Triage & Healing**: Capped at 2 repairs; bugs fingerprinted & human-confirmed |

---

## 3. End-to-End Workflow Architecture

```
Jira Story
   │  (Atlassian MCP — human-authenticated OAuth)
   ▼
[Stage 1-4] Requirement Analysis & Normalization ──► GATE 1: Acceptance Criteria Approval (Human)
   ▼ (approved)
[Stage 6]   OpenSpec Change Proposal (Spec Layer)
   ▼
[Stage 7]   Test Plan Generation (Scenarios & Reuse) ──► GATE 2: Test Plan Approval (Human)
   ▼ (approved)
[Stage 9]   BDD Feature & Automation Design ──────────► GATE 3: Automation Design Approval (Human)
   ▼ (approved)
[Stage 11]  Playwright MCP Live Validation (Locators & API Contracts)
   ▼
[Stage 12]  Implementation (Pages, Fixtures, Steps, Test Data)
   ▼
[Stage 13]  BDD Compilation (bddgen -> .features-gen)
   ▼
[Stage 14]  Execution (Playwright Test Runner)
   │
   ├──► ALL PASSED ──► [Stage 17] RTM & Coverage Update ──► [Stage 18] OpenSpec Archive (Living Spec)
   │
   └──► ANY FAILED ──► [Stage 15a] Failure Triage (Deterministic Classification)
                            ├── CONTRACT_MISMATCH / APP_DEFECT ──► [Stage 16] Bug Reporting (Human Confirmed)
                            └── LOCATOR_SUSPECT ──► [Stage 15b] Locator Healing (Max 2 Attempts)
                                                        ├── Healed ────► RTM Update
                                                        └── Unhealed ──► Bug Reporting (Human Confirmed)
```

---

## 4. Deep-Dive: Core Architectural Pillars

### 4.1 The Orchestration Layer — State-Driven, Resumable, Bounded

Rather than letting an autonomous agent wander across a multi-hour task, the framework is driven by a
**deterministic workflow orchestrator** (`sdd-workflow-orchestrator`):

- **Data-Driven State Machine (`sdd-jira-to-automation.workflow.json`):** Defines all 18 stages,
  their owning specialized agent, exact input prerequisites (`requires`), and expected outputs
  (`produces`). No agent can jump stages or skip validation checks.
- **Single-Stage Execution per Invocation:** The orchestrator executes exactly one stage at a time
  and halts, persisting state to disk (`workflow/instances/WF-<STORY>-R<release>.json`).
  - *Benefit:* Eliminates runaway token loops, prevents agent hallucination chains, and allows humans
    to inspect progress after every atomic operation.
- **Resumability from Last Successful Checkpoint:** If an environment, network, or review halt occurs,
  the workflow resumes at `lastSuccessfulStage` without redoing already-approved work.
- **Cooperative Capability Locking (`processingLock`):** Protects capability partitions from concurrent
  write collisions when multiple story workflows run across the same repository.
- **Idempotency Checks:** A stage inspects recorded `completedStages` and file artifacts before
  acting, preventing accidental duplicate file generation.

---

### 4.2 Governed Prompts and Modular Skills Architecture

To ensure high-quality, reproducible interactions without ad-hoc prompting drift, the framework
separates intent from execution using **Governed Prompts** and **Project Skills**:

- **Governed Prompts (`.github/prompts/opsx-*.prompt.md`):**
  - Standardized slash commands (`/opsx-propose`, `/opsx-apply`, `/opsx-sync`, `/opsx-archive`, `/opsx-explore`)
    that load rigorous context, instructions, and constraints into the session.
  - *Benefit:* Human operators and agents invoke identical, audited prompt structures rather than
    typing improvised instructions that yield inconsistent results.
- **Modular Project Skills (`.github/skills/*/SKILL.md`):**
  - Encapsulated capabilities with strict operating guardrails:
    - `playwright-mcp-validate`: Drives browser exploration against the live application to verify locators and API contracts without generating ungoverned code.
    - `openspec-*`: Manages spec diffing, schema validation, and living spec synchronization.
    - `blocker-escalation-note`: Formats unresolved ambiguities (`AMB-*`) or blockers into human-forwardable decision notes.
  - *Benefit:* Gives the AI specialized operational toolsets while strictly confining what tools it may invoke during each stage.

---

### 4.3 Path-Scoped Guardrails (`.github/instructions/`)

Instead of overloading every prompt with a monolithic 50-page rulebook, context is injected
**dynamically by file path**:

- `governed-artifacts.instructions.md` auto-attaches when editing `requirements/`, `test-plans/`, `workflow/`, or `traceability/`.
- `playwright-automation.instructions.md` auto-attaches when editing `features/`, `steps/`, `src/pages/`, `src/fixtures/`.
- `framework-tooling.instructions.md` auto-attaches when editing `src/utils/` or `scripts/`.
- *Benefit:* Guarantees 100% adherence to architectural boundaries while preserving token budget and LLM attention on the active task.

---

### 4.4 Rigorous Jira Intake & Governed AC Generation Rules

Intake handles raw Jira reality without ever fabricating business rules:

- **MCP-First Retrieval:** Uses Atlassian MCP (OAuth) to pull raw story fields verbatim into
  `requirements/raw/`. A fallback CLI script handles environments where MCP is unavailable.
- **Mandatory Non-AC Intake Upfront:** Preconditions, out-of-scope boundaries, backend API details,
  and test-data contracts are captured during intake regardless of how complete the story's ACs are.

#### Explicit Governing Rules for AC Generation

Every acceptance criterion in a normalized requirement is generated under exactly one of three
governed conditions:

| Story Intake Condition | Framework Action | Output Classification | Governing Constraint |
| --- | --- | --- | --- |
| **Complete ACs Present** | Extracts criteria verbatim; assigns immutable `AC-*` IDs | `EXTRACTED_FROM_JIRA` | Exact text preservation; no added assumptions |
| **Partial ACs Present** | Extracts explicit ACs; proposes missing coverage gaps as separate criteria | `EXTRACTED_FROM_JIRA` + `PROPOSED_BY_REQUIREMENT_ANALYSIS` | Every proposed AC **must** include a non-empty `rationale` |
| **Unstructured / Narrative Only** | Decomposes narrative text into structured testable criteria | 100% `PROPOSED_BY_REQUIREMENT_ANALYSIS` | Classified by **structure**, not field presence; every AC requires a `rationale` |

- **Zero-Hallucination Ambiguity Policy:** If a business rule, error message, permission role, or
  timeout is missing, the framework generates a tracked `AMB-*` ambiguity record rather than inventing
  a default value.
- *Benefit:* Reviewers at Gate 1 have 100% transparency into what the business authored vs. what the
  AI proposed, and can approve, reject, or modify each criterion individually.

---

### 4.5 Three Mandatory Human Approval Gates

Automation cannot proceed without explicit, schema-validated human sign-off on disk:

| Gate | Stage | Reviewed Artifacts | Approval Artifact Format |
| --- | --- | --- | --- |
| **Gate 1: Acceptance Criteria** | `AC_APPROVAL` | Extracted/Proposed ACs, Ambiguities, Out-of-scope | `requirements/approved/<STORY>-ac-approval.json` |
| **Gate 2: Test Plan** | `TEST_PLAN_APPROVAL` | Scenario matrix, UI/API interface types, reuse claims | `test-plans/approved/<TP-ID>-approval.json` |
| **Gate 3: Automation Design** | `AUTOMATION_APPROVAL` | Feature files, page objects, step orchestration, locators | `features/approved/<capability>/<TP-ID>-automation-approval.json` |

- **Chat is Never Approval:** Approvals must exist as schema-valid JSON files (`requirements/schemas/approval.schema.json`).
- **No Self-Approval:** Agents are programmatically barred from generating or modifying approval files.
- **Rejection Circuit:** Rejecting a criterion or scenario immediately routes the workflow back to
  the authoring stage for correction.

---

### 4.6 Zero Guessing: Live MCP Validation & API Shape Hashes

The framework enforces strict validation before code generation begins:

- **No Guessed Locators:** Selectors begin as `MCP_VALIDATION_REQUIRED`. The orchestrator drives
  Playwright MCP against the live application to verify accessibility trees and element existence
  before approving locator code.
- **No Guessed API Contracts:** Endpoints, payloads, and response codes must be:
  - `OBSERVED`: Captured from live application network traffic (sufficient for test setup, never to judge ACs).
  - `HUMAN_APPROVED`: Explicitly ratified by human review, sealed with a **`responseShapeHash`**
    (fingerprints keys and types so contract drift is immediately detected).
  - `OPENAPI`: Sourced directly from a versioned OpenAPI specification.
- **No Fabricated Passing Results:** Coverage numbers require verified execution records on disk.
  Zero-denominator measures report as `null`, never as fake 0% or 100%.

---

### 4.7 First-Class Hybrid UI + API Testing

Modern enterprise apps blend client-side UI with background asynchronous APIs:

- **First-Class `interfaceType`:** Scenarios explicitly declare `UI`, `API`, or `HYBRID`.
- **Unified Scenario Execution:** In a `HYBRID` scenario, a single test navigates the live DOM (e.g.
  submitting a form, selecting radio buttons) while simultaneously verifying backend network contracts
  (payload headers, XML/JSON envelopes, status codes).
- **Comprehensive Zod Validation:** The API response is validated **in full** against its runtime
  Zod model in `src/models/api/` — eliminating partial field spot-checks that mask backend regressions.
- *Benefit:* Replaces disjointed UI and API suites with unified business flows that validate the
  entire system surface in one pass.

---

### 4.8 Cross-Story Test Reuse Without Test Debt

- **Intelligent Reuse Proposals:** When a new story exercises functionality already covered by an
  existing capability, the framework proposes test reuse instead of generating redundant test cases.
- **Human Confirmation Required:** Cross-story reuse is treated with the same rigor as an API contract:
  an agent may propose it, but `SEM-TEST-REUSE` enforces that it must resolve to real evidence and be
  ratified by a human at Gate 2. Title matching alone is never accepted.
- *Benefit:* Eliminates test suite bloat and prevents redundant execution time while ensuring new
  coverage gaps are not accidentally skipped.

---

### 4.9 Strict Maintainable Layering

Code generation adheres to a strict 4-tier separation of concerns:

```
Features (.feature)     ──► Pure Gherkin business narrative; zero selectors or technical syntax
   │
Steps (steps/*.ts)      ──► Thin orchestration; invokes page objects & fixtures; no raw locators
   │
Page Objects (src/pages)──► Owns locators (getByRole, getByLabel); no XPath, no .nth(), no sleep()
   │
API Clients (src/api)   ──► Extends ApiClient; owns endpoints; validates complete Zod models
```

- **Clean Locators:** Enforces semantic locator hierarchies (`getByRole` → `getByLabel` → `getByPlaceholder`
  → `getByText` → `getByTestId`). XPath and index-based `.nth()` selectors are barred.
- **Modular Fixtures:** Domain fixtures are partitioned by capability (`src/fixtures/<capability>.fixture.ts`)
  and re-exported through `test.ts`, avoiding merge bottlenecks.

---

### 4.10 Governed Failure Handling & Fingerprinted Defect Reporting

When a test run fails, the framework executes a controlled triage protocol:

```
Test Execution Failed
   │
   ▼
[Failure Triage] ──► Deterministic Classification (npm run triage:failures)
   │
   ├── CONTRACT_MISMATCH / APP_DEFECT ──► Preserves trace.zip, screenshots, API payloads
   │                                          │
   │                                          ▼
   │                                      Computes unique Failure Fingerprint Hash
   │                                          │
   │                                          ├── Hash already REPORTED? ──► Mark as DUPLICATE (Skip Jira)
   │                                          │
   │                                          └── New Failure ──► Compose Jira Bug in Chat
   │                                                                 │
   │                                                                 ▼
   │                                                             HUMAN CONFIRMATION IN CHAT
   │                                                                 │
   │                                                                 ▼
   │                                                             File Jira Bug (Assigned to named lead)
   │
   └── LOCATOR_SUSPECT ──► Governed Locator Healer (Scoped to src/pages/** only)
                               ├── Max 2 healing attempts against failing scenario only
                               ├── Succeeded? ──► Re-run suite ──► Update RTM
                               └── Failed?    ──► Escalate to Bug Reporting
```

- **No Silent Test Weakening:** The healer cannot touch feature files, step definitions, assertions,
  or test data. It cannot weaken an assertion to make a broken build pass.
- **Duplicate Prevention:** Bugs are fingerprinted with a deterministic hash covering the error stack
  and root cause. Existing bugs are flagged as `DUPLICATE` rather than cluttering Jira.
- **Human-in-the-Loop Bug Filing:** The agent composes the Jira bug and presents it in chat; it
  cannot call Jira API creation tools until a human explicitly confirms.

---

### 4.11 Enterprise Scalability (3,000+ Test Suite Design)

The architecture is explicitly designed to avoid monolithic scaling bottlenecks:

| Scaling Constraint | Framework Architecture Solution |
| --- | --- |
| **Monolithic RTM Bottleneck** | Partitioned RTM files per capability (`traceability/capabilities/<capability>.rtm.json`) |
| **Linear Search Overhead** | `traceability/index/lookup.index.json` maps IDs directly to capability files |
| **LLM Context Window Limits** | Bounded batching: 1 story and maximum 10 scenarios per agent execution |
| **Merge Collisions** | Unique immutable IDs (`REQ-*`, `AC-*`, `TP-*`, `TS-*`, `TRC-*`); capability locks |
| **Historical Drift** | Release Baselines (`traceability/releases/<release>.baseline.json`) freeze historical state |

---

### 4.12 24-Check Automated Verification Suite

Governance is enforced by machine validation, not human memory. `npm run validate:artifacts` executes
24 automated checks before any artifact or code can be merged:

| Validation Category | Sample Enforced Rules |
| --- | --- |
| **Gate & Approval Integrity** | `SEM-GATES` (enforces all 3 gates), `SEM-APPROVAL-EVIDENCE` (validates disk signatures) |
| **Traceability & Coverage** | `SEM-RTM` (checks bi-directional link integrity), `SEM-COVERAGE` (verifies mathematical formulas) |
| **Code & Automation Hygiene** | `SEM-AUTOMATION-HYGIENE` (bans XPath/.nth/unwaived waits), `SEM-FEATURE-TAGS` (enforces tag schemas) |
| **Contract & API Governance** | `SEM-API-CONTRACT` (verifies API tags match approved contracts), `SEM-NO-DUPLICATES` |
| **Defect & Isolation Governance**| `SEM-DEFECT-EVIDENCE` (backs bugs with real traces), `SEM-SAMPLE-ISOLATION` (isolates test data) |

---

### 4.13 Configuration Safety & Browser Code Coverage

- **Zero Secret Exposure:** Configuration runs through a typed loader (`src/utils/env.ts`). The repo
  scaffolds and validates without secrets; errors name variable *keys*, never sensitive *values*.
- **Chromium V8 Code Coverage (`npm run test:coverage`):** Measures application JavaScript execution
  using V8 and Istanbul.
- **Honest Metric Separation:** Browser code coverage is strictly separated from business requirement
  coverage. Executed code lines are **never** cited as proof that an acceptance criterion passed.

---

## 5. Stakeholder Demo Q&A / Talking Points

- **Q: How do we know the AI isn't inventing requirements or locators?**
  *A:* Section 4.4 & 4.6. Business rules cannot be authored by agents (they raise `AMB-*` records),
  locators start as `MCP_VALIDATION_REQUIRED` and must be proven on live DOM, and API contracts require
  shape hashes.
- **Q: Who retains control over what gets automated?**
  *A:* Section 4.5. Three mandatory human gates on disk. No agent can approve its own work or bypass a gate.
- **Q: What stops the AI from filing dozens of duplicate or false-alarm bugs?**
  *A:* Section 4.10. Environment errors are filtered out, failures are fingerprinted to catch duplicates,
  healing is capped at 2 attempts without touching assertions, and bug filing requires explicit human confirmation.
- **Q: Can this handle our legacy backend and hybrid workflows?**
  *A:* Section 4.7. First-class `HYBRID` support runs unified UI and API validation with full Zod schema checks.
- **Q: Will this slow down as our test suite grows to thousands of tests?**
  *A:* Section 4.11. Capability partitioning, fast indexed lookups, and bounded agent batching ensure
  linear performance at enterprise scale.
- **Q: What is the current maturity / POC status of this repository?**
  *A:* Two real Jira stories (`ETA-351`, `ETA-411`) have executed end-to-end through all three gates
  against QA environments. Scaffolding, validation checks, and state machines are fully operational across
  the repository.

