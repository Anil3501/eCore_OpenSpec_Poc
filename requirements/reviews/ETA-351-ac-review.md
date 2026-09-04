# ETA-351 — Acceptance Criteria Review Package (Approval Gate 1)

| Field | Value |
| --- | --- |
| Jira story | ETA-351 |
| Release | 1.0 |
| Capability | account-access |
| Artifact under review | [requirements/normalized/ETA-351.json](../normalized/ETA-351.json) |
| Artifact version | 2 (supersedes 1) |
| Raw snapshot | [reports/jira/ETA-351.jira.json](../../reports/jira/ETA-351.jira.json) |
| Retrieved via | Jira REST API v3 (documented fallback — the Atlassian MCP server exposed no issue-fetch tool in this session) |
| Retrieved at | 2026-09-04T13:54:48.102Z |
| Data classification | REAL_JIRA_DATA |
| Approval template | [requirements/reviews/ETA-351-ac-approval.template.json](ETA-351-ac-approval.template.json) |
| Expected approval path | `requirements/approved/ETA-351-ac-approval.json` |

**This is a deliberate full re-run**, requested to validate the framework after the API-testing
capability was integrated. The story was first processed on 2026-08-31 (committed at `caf9b13`).
Everything below was re-derived from a freshly fetched snapshot, not copied forward. Section 10
records every difference from the first run.

**Nothing downstream of this gate has been generated.** No OpenSpec artifacts, no test plan, no
feature files, no page objects.

---

## 1. Jira story information

| Field | Value |
| --- | --- |
| Key | ETA-351 |
| Summary | Organization Login for eCore Command Center: login type selection, credential entry, authentication, and Home page access |
| Type | Story |
| Status | Closed *(was `In Progress` at the first run — see section 10)* |
| Priority | Medium |
| Labels | QA |
| Components | *(none)* |
| Fix versions | *(none)* |
| Parent | ETA-164 — eCore Application Testing, Automation & Migration |
| Linked issues | *(none)* |
| Subtasks | *(none)* |
| Attachments | *(none)* |

---

## 2. Original Jira description

Reproduced from the 2026-09-04 snapshot. The Jira field is Atlassian Document Format; the text below
is the document's text nodes in order, with its hard line breaks preserved. Every quotation used as
a requirement `originalText` was checked against this text, and all 8 matched. Where a requirement
quotes across a wrapped line, the wrap is rendered as a single space and nothing else is altered.

> **Summary**
>
> As an organization user, I want to sign in to eCore Command Center using my organization credentials so that I can access the application
>
> **Story**
>
> As an organization user of eCore Command Center
> I want to sign in using my organization credentials
> So that I can access the application with my assigned permissions
>
> **Context**
>
> The eCore Command Center login page is the entry point to the application. It
> supports more than one kind of sign-in, and the user tells the system which kind
> they are using before entering their details. Organization users authenticate
> against their organization rather than against an individual business entity, so
> the organization they belong to forms part of what they supply at sign-in.
>
> The other supported sign-in kind is Business Entity Login. It exists on the same
> page and the user must be able to tell the two apart and choose between them, but
> its own behaviour is handled elsewhere and is not part of this story.
>
> Which details the page asks for depends on the choice the user makes. The page is
> expected to respond to that choice rather than present every possible field at
> once.
>
> **What the user does**
>
> A user arrives at the login page, indicates that they are signing in on behalf of
> their organization, supplies who they are, which organization they belong to, and
> the secret that proves it, and submits. If everything they supplied is correct,
> they arrive at the eCore Command Center Home page and can work in the application
> within the limits of their organization and permissions.
>
> Passwords are secrets and are treated as such on screen.
>
> Not everything a user submits will be correct. Details can be wrong, and details
> can be left out altogether. In neither case should the user get into the
> application, and in neither case should they be left guessing about what happened.
> Wrong details and missing details are different problems and the user should be
> able to tell which one they have hit.
>
> **Out of Scope**
>
> Business Entity Login behaviour; Forgot Password; password reset; user creation;
> organization creation; role and permission configuration; MFA and SSO; session
> timeout; account lockout; exact error-message wording.

### Comments on the ticket

The snapshot carries 7 comments, all written by the story's own author and all worklog updates about
building this automation framework. **None of them states a business rule about eCore sign-in**, so
no requirement, criterion or ambiguity below is derived from a comment.

---

## 3. Acceptance criteria extracted from Jira

**None.**

The ETA-351 description contains no acceptance criteria section, and the phrase "Acceptance
Criteria" does not appear anywhere in it. This was verified against the raw snapshot, not assumed.

This matters for your review: **every criterion in section 4 is proposed, not extracted.** None of
them carries the authority of the ticket. They are readings of the description, and each one is
traceable to a sentence I have quoted.

*(For contrast, the parent epic ETA-164 does have its own Acceptance Criteria section, but it is
about migrating modules into the Playwright/TypeScript framework — it is not a source of
behavioural criteria for this story.)*

---

## 4. Additional acceptance criteria proposed

All 8 are `PROPOSED_BY_REQUIREMENT_ANALYSIS`, all `PENDING_APPROVAL`, all item version 1 and all
`changeType: UNCHANGED` — the re-run reproduced the first run's set exactly, so no item content
moved. The artifact around them is version 2.

| AC | Requirement | Given | When | Then |
| --- | --- | --- | --- | --- |
| AC-ETA-351-001 | REQ-ETA-351-001 | the login page is open | the user looks at the page before entering any details | the page offers a way to declare which kind of sign-in is being used |
| AC-ETA-351-002 | REQ-ETA-351-002 | the login page is open | the user examines the available sign-in kinds | organization sign-in and Business Entity Login are both offered and can be told apart |
| AC-ETA-351-003 | REQ-ETA-351-003 | the login page is open | the user indicates the sign-in is on behalf of an organization | the page asks for the organization sign-in details and does not present every possible field at once |
| AC-ETA-351-004 | REQ-ETA-351-006 | organization sign-in is selected | the user types the secret that proves who they are | the secret is not readable on screen |
| AC-ETA-351-005 | REQ-ETA-351-005 | organization sign-in is selected | the user supplies correct details and submits | the user arrives at the eCore Command Center Home page |
| AC-ETA-351-006 | REQ-ETA-351-007 | organization sign-in is selected | the user supplies wrong details and submits | the user is not admitted and is told the attempt failed |
| AC-ETA-351-007 | REQ-ETA-351-007 | organization sign-in is selected | the user leaves required details out and submits | the user is not admitted and is told the attempt failed |
| AC-ETA-351-008 | REQ-ETA-351-008 | organization sign-in is selected | wrong details on one attempt, missing details on another | the two responses differ, so the user can tell which problem they hit |

---

## 5. Rationale for each proposed criterion

| AC | Grounded in | Why it stops where it stops |
| --- | --- | --- |
| 001 | "the user tells the system which kind they are using **before entering their details**" | The ordering is stated explicitly, so it is testable. *How* the user declares the kind is not stated → AMB-002. |
| 002 | "the user must be able to **tell the two apart and choose between them**" | Asserts presence and distinguishability only. Business Entity Login behaviour is explicitly out of scope. |
| 003 | "Which details the page asks for depends on the choice… rather than present every possible field at once" | The behaviour is stated; the field set is not enumerated → AMB-001. |
| 004 | "Passwords are secrets and are **treated as such on screen**" | On-screen concealment is the only behaviour that sentence asserts. Anything further → AMB-004. |
| 005 | "If everything they supplied is correct, they arrive at the **eCore Command Center Home page**" | Deliberately stops at arrival. The trailing "within the limits of their organization and permissions" is excluded because role and permission configuration is out of scope → AMB-006. |
| 006 | "In neither case should the user get into the application… nor be left guessing" | Asserts refusal plus feedback. No message text, because exact wording is out of scope → AMB-003. |
| 007 | "details can be **left out altogether**" | Same two obligations as 006. Which details are mandatory is unstated → AMB-005. |
| 008 | "Wrong details and missing details are **different problems** and the user should be able to tell which one they have hit" | Asserted as a *difference between* the two responses, never as specific text → AMB-003. |

---

## 6. Ambiguities requiring human resolution

None of these has been resolved by an agent. All are `REVIEW_REQUIRED`.

| ID | Question | Why it blocks |
| --- | --- | --- |
| AMB-ETA-351-001 | Is "which organization they belong to" one detail or more than one (e.g. organization name *and* a separate identifier)? What is the exact field set? | AC-003 cannot say which details the page asks for, and no test data can be defined. |
| AMB-ETA-351-002 | How does the user declare the sign-in kind — dropdown, radio, tabs, links? | AC-001 and AC-002 can assert the choice exists but not how it is made. |
| AMB-ETA-351-003 | Exact wording is out of scope, yet the two failure cases must be distinguishable. What observable difference is required? | Determines whether AC-006/007/008 are correctly scoped or too weak. |
| AMB-ETA-351-004 | Does "treated as such on screen" mean only concealment, or more (autocomplete, copy, page source)? | AC-004 asserts concealment only. |
| AMB-ETA-351-005 | Which details are mandatory, and does one missing detail behave like several? | Determines how many missing-detail scenarios exist. |
| AMB-ETA-351-006 | Is any permission-dependent behaviour in scope, given permissions are out of scope? | AC-005 currently ends at the Home page. |

**Note on AMB-001.** The repository's `.env` happens to hold both an organization name and an
organization id. That is environment configuration, not a business rule, so it has **not** been used
to answer this question. Only you can.

---

## 7. Clarification questions for the reviewer

1. Are all 8 proposed criteria faithful readings of the description, or has any of them imported an
   assumption the ticket does not make?
2. AMB-001 — what exactly does the organization user supply?
3. AMB-003 — is "the two responses differ" a sufficient assertion, given wording is out of scope?
4. AMB-006 — does this story end at the Home page?
5. Is `account-access` the right capability for RTM partitioning?
6. Should the Business Entity Login *presence* check (AC-002) live in this story at all, or move to
   the Business Entity story?

---

## 8. Initial traceability mapping

Proposed only. Written to
[traceability/capabilities/account-access.rtm.proposed.json](../../traceability/capabilities/account-access.rtm.proposed.json)
and **not** merged — the orchestrator owns the merge, and only after this gate clears.

The eight trace ids are deliberately the same ids the first run used, because the RTM merges by key,
not by position. One consequence you should know about: while this proposal file sits next to the
already-merged `account-access.rtm.json`, `npm run validate:artifacts` will report those eight
trace ids as duplicated across partitions under `SEM-RTM`. That is the expected state between Gate 1
and the orchestrator's merge, and it clears when the proposal is merged and removed.

| Trace | Story | Requirement | AC | Status |
| --- | --- | --- | --- | --- |
| TRC-ETA-351-001 | ETA-351 | REQ-ETA-351-001 | AC-ETA-351-001 | PENDING_APPROVAL |
| TRC-ETA-351-002 | ETA-351 | REQ-ETA-351-002 | AC-ETA-351-002 | PENDING_APPROVAL |
| TRC-ETA-351-003 | ETA-351 | REQ-ETA-351-003 | AC-ETA-351-003 | PENDING_APPROVAL |
| TRC-ETA-351-004 | ETA-351 | REQ-ETA-351-006 | AC-ETA-351-004 | PENDING_APPROVAL |
| TRC-ETA-351-005 | ETA-351 | REQ-ETA-351-005 | AC-ETA-351-005 | PENDING_APPROVAL |
| TRC-ETA-351-006 | ETA-351 | REQ-ETA-351-007 | AC-ETA-351-006 | PENDING_APPROVAL |
| TRC-ETA-351-007 | ETA-351 | REQ-ETA-351-007 | AC-ETA-351-007 | PENDING_APPROVAL |
| TRC-ETA-351-008 | ETA-351 | REQ-ETA-351-008 | AC-ETA-351-008 | PENDING_APPROVAL |

---

## 9. Current coverage gaps

Honest position: **coverage is 0 of 8**, and it cannot be anything else yet.

| Measure | Value |
| --- | --- |
| Acceptance criteria defined | 8 |
| Approved | 0 — this gate has not been cleared |
| Covered by an approved test plan | 0 — no test plan exists |
| Covered by automation | 0 — no feature files exist |
| Executed | 0 — nothing has run |
| Requirements with no AC | **REQ-ETA-351-004 has no AC of its own** — it describes the submission flow and is exercised through AC-003, AC-005, AC-006 and AC-007 rather than asserted directly. Confirm that is acceptable. |
| Ambiguities unresolved | 6 of 6 |

Two further gaps you should know about before approving:

- **Nothing here has been checked against the real application.** No page has been opened, no
  locator validated. That happens at `PLAYWRIGHT_VALIDATION`, after Gates 1 and 2.
- **The QA host requires VPN.** Execution will block without it.

### Interface observation — not a classification

The framework now supports API-level verification, so this is worth stating plainly: **the ETA-351
description says nothing about an API.** It names no endpoint, method, status code, field name or
error payload. Nothing in section 4 was therefore classified as API-verifiable, and no ambiguity was
raised about API specifics, because raising one would imply the story asserts an API contract it
does not mention.

Which interface verifies each criterion is a Gate 2 decision for the test planner, not a requirement
I am entitled to author. If you want any of these eight criteria verified below the UI, say so in
your approval comments so the planner treats it as your instruction rather than its own inference.

---

## 10. Divergence from the first run (2026-08-31, commit `caf9b13`)

This is the point of the exercise, so it is reported whether or not anything moved.

| # | What | First run | This run | Cause |
| --- | --- | --- | --- | --- |
| 1 | Requirements normalized | 8 | 8 | — identical ids, wording and `originalText` |
| 2 | Acceptance criteria | 8, all proposed | 8, all proposed | — identical Given/When/Then and rationale |
| 3 | Acceptance criteria found *in* Jira | 0 | 0 | The description still has no AC section |
| 4 | Ambiguities | 6, all `REVIEW_REQUIRED` | 6, all `REVIEW_REQUIRED` | — |
| 5 | Jira status | `In Progress` | `Closed` | The human closed the ticket. No behavioural content changed. |
| 6 | Jira comments | 0 read | 7 read, 0 used | All 7 are the author's worklog notes about building this framework. None states an eCore business rule. |
| 7 | Artifact version | 1 | 2, `supersedes: 1`, `changeType: UNCHANGED` | Regeneration over an approved v1 |
| 8 | Section 2 of this package | Paraphrased the description and used headings (`User flow`) the ticket does not contain | Reproduces the ticket's own headings and line breaks | **A real defect in the first run's review package.** The requirement `originalText` values were correct both times; only this human-facing quotation drifted. Corrected here. |
| 9 | `source.rawSnapshotPath` | `requirements/raw/ETA-351.json` | `reports/jira/ETA-351.jira.json` | See the note below — the governed promotion could not be performed in this session. |

**Bottom line: the analysis is reproducible.** Same 8 requirements, same 8 criteria, same 6
ambiguities, from an independently re-fetched snapshot. The only substantive finding is row 8.

### Open item — the raw snapshot has not been promoted

`requirements/raw/ETA-351.json` still holds the **2026-08-31** snapshot. The 2026-09-04 snapshot
lives at `reports/jira/ETA-351.jira.json` and is what everything above was derived from, so
`source.rawSnapshotPath` points there rather than claiming a promotion that did not happen.

Promoting it is a byte-for-byte file copy, and this session exposed no tool that can execute one.
Retyping a 2,529-line snapshot cannot be guaranteed verbatim, and a raw artifact that is *almost*
the Jira response is worse than none. One command completes the stage:

```powershell
Copy-Item reports/jira/ETA-351.jira.json requirements/raw/ETA-351.json -Force
```

After that, `source.rawSnapshotPath` should be set back to `requirements/raw/ETA-351.json`.

---

## How to approve

1. Copy [ETA-351-ac-approval.template.json](ETA-351-ac-approval.template.json) to
   `requirements/approved/ETA-351-ac-approval.json`.
2. Replace every `REPLACE_WITH_…` placeholder. Each of the 8 items takes its own decision —
   `APPROVE`, `REJECT`, `DEFER` or `REQUEST_CHANGES`.
3. Answer the six ambiguities in `comments` or in the per-item comments.
4. Run `npm run validate:artifacts`.
5. Tell me to resume. **Only items you marked `APPROVE` will flow downstream.**

Approving in chat does not work — the workflow reads the artifact, not the conversation.
