# Gate 2 review package — Test plan TP-ETA-351-001

| Field | Value |
| --- | --- |
| Test plan | `TP-ETA-351-001`, artifactVersion 1 |
| Artifact | [test-plans/generated/TP-ETA-351-001.json](../generated/TP-ETA-351-001.json) |
| Jira story | [ETA-351](https://eoriginal.atlassian.net/browse/ETA-351) |
| Release / capability | 1.0 / `account-access` |
| Gate | `TEST_PLAN` (Gate 2 of 3) |
| Approval template | [test-plans/generated/TP-ETA-351-001-approval.template.json](TP-ETA-351-001-approval.template.json) |
| Expected approval path | `test-plans/approved/TP-ETA-351-001-approval.json` |

---

## 1. What you are approving

Eight test scenarios, one for each acceptance criterion approved at Gate 1. Approving this plan
authorises the framework to write Gherkin feature files for these scenarios and nothing else.

Approving does **not** authorise executable automation. That is Gate 3.

## 2. Provenance

Every scenario derives from an approved acceptance criterion. Nothing in this plan comes from
observing the application, because the application has not been observed yet.

| Source | State |
| --- | --- |
| `requirements/approved/ETA-351.json` v1 | All 8 criteria `APPROVED` |
| `requirements/approved/ETA-351-ac-approval.json` | Gate 1 `APPROVE`, 8/8 items `APPROVE` |
| `openspec/changes/add-organization-login` | `openspec validate --strict` passes; spec delta references all 8 criteria |

## 3. Scenario summary

| Scenario | Criterion | Type | Data | Suite |
| --- | --- | --- | --- | --- |
| `TS-ETA-351-001` Declare sign-in kind before entering details | `AC-ETA-351-001` | POSITIVE | none | smoke |
| `TS-ETA-351-002` Both sign-in kinds offered and distinguishable | `AC-ETA-351-002` | POSITIVE | none | smoke |
| `TS-ETA-351-003` Page asks for organization details, not every field | `AC-ETA-351-003` | POSITIVE | none | regression |
| `TS-ETA-351-004` Password not readable on screen | `AC-ETA-351-004` | POSITIVE | fabricated | critical |
| `TS-ETA-351-005` Correct details reach the Home page | `AC-ETA-351-005` | POSITIVE | **real account** | critical |
| `TS-ETA-351-006` Wrong details refused and reported | `AC-ETA-351-006` | NEGATIVE | fabricated | regression |
| `TS-ETA-351-007` Missing details refused and reported | `AC-ETA-351-007` | NEGATIVE | fabricated | regression |
| `TS-ETA-351-008` The two failure responses differ | `AC-ETA-351-008` | NEGATIVE | fabricated | regression |

Coverage of approved criteria: **8 of 8**. No criterion is unmapped, and no scenario exists without
a criterion behind it.

## 4. Why the expectations look vague

Four criteria describe an effect without naming the signal that carries it, because the story does
not state one and exact error-message wording is explicitly out of scope. The Gate 1 approval you
signed carried the condition that no unresolved ambiguity may be hardened into an expectation.

This plan honours that. `TS-ETA-351-003` does not name the fields it expects. `TS-ETA-351-006` and
`TS-ETA-351-007` do not quote a message. `TS-ETA-351-008` asserts that two responses *differ*
rather than what either one says.

That vagueness is deliberate and is the point of the ambiguity register. It will be resolved by
observing the real page at `PLAYWRIGHT_VALIDATION` — and observation may reveal *how* a criterion
is met, but it must never redefine *what* the criterion requires.

## 5. Decisions that need your judgement

**5.1 One scenario uses the real account.** `TS-ETA-351-005` is the only scenario that signs in
successfully, so it is the only one that can use real credentials. Every other scenario uses
fabricated values.

This is not tidiness. The login page warns that an account can lock out after a number of incorrect
attempts. The story lists account lockout as out of scope, but a locked account is just as locked
whether or not the story mentions it, and it would block the whole capability. Credentials are read
through environment configuration and never appear in this plan, in test data, or in a feature file.

**5.2 `AC-ETA-351-008` is comparative and gets its own scenario.** It cannot be evaluated from a
single attempt — it asserts a relationship between two responses. `TS-ETA-351-008` therefore
performs both attempts and compares them, rather than inferring the comparison from the separate
results of `TS-ETA-351-006` and `TS-ETA-351-007`. Two passing scenarios would not prove their
responses differ.

**5.3 `REQ-ETA-351-004` has no scenario, because it has no criterion.** The requirement that the
user supplies their identity, their organization and the secret, then submits, was extracted from
the story but never received a criterion of its own — this was flagged in the Gate 1 review and you
approved it as it stood. It is exercised indirectly by every sign-in scenario.

I have not invented a criterion to close the gap. `CLR-TP-ETA-351-001` asks whether indirect
coverage is acceptable. If it is not, the fix is a new criterion approved at Gate 1, not a scenario
added here.

## 6. Open clarifications carried into this plan

All six ambiguities remain `REVIEW_REQUIRED`. None was resolved by inference.

| ID | Blocks | Who can answer |
| --- | --- | --- |
| `AMB-ETA-351-001` field set for organization sign-in | `TS-ETA-351-003` | Observation at `PLAYWRIGHT_VALIDATION` |
| `AMB-ETA-351-002` how the sign-in kind is declared | `TS-ETA-351-001`, `TS-ETA-351-002` | Observation |
| `AMB-ETA-351-003` observable difference between failures | `TS-ETA-351-006/007/008` | Observation |
| `AMB-ETA-351-005` which details are mandatory | `TS-ETA-351-007` | Observation |
| `AMB-ETA-351-004` does "treated as a secret" mean only concealment | `TS-ETA-351-004` | **You. Observation cannot answer intent.** |
| `AMB-ETA-351-006` is permission-dependent behaviour in scope | `TS-ETA-351-005` | **You. Observation cannot answer scope.** |
| `CLR-TP-ETA-351-001` uncovered `REQ-ETA-351-004` | — | **You.** |

The last three are not waiting on the environment. Watching a login page cannot tell anyone what the
business meant.

## 7. Risks recorded in the plan

| Risk | Level |
| --- | --- |
| Account lockout from repeated failed attempts | HIGH — mitigated by fabricated data everywhere except the happy path |
| Premature hardening of an abstract expectation | HIGH — mitigated by keeping expectations at criterion level |
| VPN unavailable at execution time | MEDIUM — recorded as `BLOCKED`, never as a pass, never filed as a defect |
| `AC-ETA-351-008` needs a cross-scenario comparison | MEDIUM — mitigated by a single comparative scenario |
| `REQ-ETA-351-004` covered only indirectly | LOW — raised as `CLR-TP-ETA-351-001` |

## 8. How to approve

Copy the template to `test-plans/approved/TP-ETA-351-001-approval.json`, set the top-level
`decision`, set each of the eight `itemDecisions`, fill in your name and role, then run:

```powershell
npm run validate:artifacts
```

Nothing downstream is produced until that file exists and validates. A message in chat is not an
approval.

| Decision | Effect |
| --- | --- |
| `APPROVE` | Plan moves to `test-plans/approved/`; `BDD_DESIGN` begins |
| `REQUEST_CHANGES` | Plan returns to `TEST_PLAN_GENERATION`; only the rejected scenarios are reworked |
| `REJECT` / `DEFER` | Those scenarios are excluded and recorded in the RTM with that status |

Item-level decisions are honoured individually. A scenario you mark `DEFER` will not be written as
a feature file, and the RTM will show its criterion as uncovered rather than quietly dropping it.

## 9. What I could not verify

- **The application has not been observed.** Every expectation here comes from the approved
  criteria alone. Whether the real page behaves this way is unknown until `PLAYWRIGHT_VALIDATION`.
- **VPN access has not been confirmed** for this session, so the qa host is currently unproven.
- **No agent may approve this.** I generated the plan; approving it would be self-approval. The
  decision is yours.
