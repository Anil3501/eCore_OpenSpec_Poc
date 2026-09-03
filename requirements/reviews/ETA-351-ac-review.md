# ETA-351 — Acceptance Criteria Review Package (Approval Gate 1)

| Field | Value |
| --- | --- |
| Jira story | ETA-351 |
| Release | 1.0 |
| Capability | account-access |
| Artifact under review | [requirements/normalized/ETA-351.json](../normalized/ETA-351.json) |
| Artifact version | 1 |
| Raw snapshot | [requirements/raw/ETA-351.json](../raw/ETA-351.json) |
| Retrieved via | Jira REST API v3 (documented fallback — the Atlassian MCP server exposed no issue-fetch tool in this session) |
| Retrieved at | 2026-08-31T12:44:24.412Z |
| Data classification | REAL_JIRA_DATA |
| Approval template | [requirements/reviews/ETA-351-ac-approval.template.json](ETA-351-ac-approval.template.json) |
| Expected approval path | `requirements/approved/ETA-351-ac-approval.json` |

**Nothing downstream of this gate has been generated.** No OpenSpec artifacts, no test plan, no
feature files, no page objects.

---

## 1. Jira story information

| Field | Value |
| --- | --- |
| Key | ETA-351 |
| Summary | Organization Login for eCore Command Center: login type selection, credential entry, authentication, and Home page access |
| Type | Story |
| Status | In Progress |
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

Reproduced verbatim from the snapshot. Every quotation used as a requirement `originalText` was
checked programmatically against this text and all 8 matched.

> **Story**
>
> As an organization user of eCore Command Center
> I want to sign in using my organization credentials
> So that I can access the application with my assigned permissions
>
> **Context**
>
> The login page is the entry point to eCore Command Center. It supports more than one kind of
> sign-in, and the user tells the system which kind they are using before entering their details.
>
> This story covers Organization Login. Organization users authenticate against their organization
> rather than against an individual business entity, so the organization they belong to forms part
> of what they supply at sign-in.
>
> The other supported sign-in kind is Business Entity Login. It exists on the same page and the user
> must be able to tell the two apart and choose between them, but its own behaviour is handled
> elsewhere and is not part of this story.
>
> Which details the page asks for depends on the choice the user makes. The page is expected to
> respond to that choice rather than present every possible field at once.
>
> **User flow**
>
> A user arrives at the login page, indicates that they are signing in on behalf of their
> organization, supplies who they are, which organization they belong to, and the secret that proves
> it, and submits. If everything they supplied is correct, they arrive at the eCore Command Center
> Home page and can work in the application within the limits of their organization and permissions.
>
> Passwords are secrets and are treated as such on screen.
>
> Not everything a user submits will be correct. Details can be wrong, and details can be left out
> altogether. In neither case should the user get into the application, and in neither case should
> they be left guessing about what happened. Wrong details and missing details are different
> problems and the user should be able to tell which one they have hit.
>
> **Out of Scope**
>
> Business Entity Login behaviour; Forgot Password and password reset; user creation; organization
> creation; role and permission configuration; MFA and SSO; session timeout; account lockout; exact
> error-message wording.

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

All 8 are `PROPOSED_BY_REQUIREMENT_ANALYSIS`, all `PENDING_APPROVAL`, all version 1.

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
