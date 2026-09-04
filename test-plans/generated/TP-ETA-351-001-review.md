# Approval Gate 2 — Test Plan Review — TP-ETA-351-001 v2

| | |
| --- | --- |
| Test plan | `TP-ETA-351-001`, artifactVersion 2 (supersedes the version approved 2026-08-31) |
| Story | ETA-351 — Organization Login for eCore Command Center |
| Release / capability | 1.0 / account-access |
| Source | [requirements/approved/ETA-351.json](../../requirements/approved/ETA-351.json) v2, approved at Gate 1 by Anil (Reviewer) |
| Scenarios | 8, one per approved acceptance criterion |
| Decision needed | APPROVE / REJECT / DEFER / REQUEST_CHANGES, overall and per scenario |

## 1. Why there is a version 2 at all

The eight scenarios are unchanged. Their titles, steps, expected results and data requirements are
byte-identical to the version you approved on 2026-08-31, because the eight acceptance criteria they
come from are themselves unchanged — the story was re-fetched from Jira on 2026-09-04 and every
requirement and criterion reproduced identically.

Two things did change, and they are the only things this gate is really asking you about:

1. **Every scenario now declares `interfaceType: "UI"` explicitly.** Version 1 was written before the
   framework could express an API scenario at all.
2. **The plan now cites the API discovery evidence** as a dependency, so the claim in point 1 can be
   audited rather than taken on trust.

If you are short of time, section 2 is the part that needs your judgement. Everything else is
carried forward from a decision you have already made.

## 2. The interface judgement — the decision this gate exists for

**Proposed: all 8 scenarios are UI. No acceptance criterion is API-verifiable.**

This is a testing judgement, not something ETA-351 states, so it is put to you rather than applied
silently.

The evidence is in [reports/validation/ecore-api-discovery.json](../../reports/validation/ecore-api-discovery.json),
captured by driving the real application:

- eCore sign-in is a **form POST that returns `302`**. There is no login endpoint, no token, no JSON
  request body and no JSON response body. There is nothing for an API scenario to call.
- The login page issues **no XHR whatsoever**. Neither do the Home, New Package or Preferences pages.
- The only AJAX surface in the application lives under `/ssweb/setup/workspace/**/ajax/`, belongs to
  the transaction workspace, and has nothing to do with authentication.

So no endpoint was invented to manufacture an API scenario. That matters more than it sounds: an
invented endpoint in a plan becomes an invented endpoint in code, and a guessed `DELETE` has
consequences a guessed locator does not.

**What approving this means:** you are agreeing that ETA-351 is verified entirely through the user
interface, and that the sign-in journey keeps its end-to-end proof rather than being reduced to a
faster call that would leave the coverage number identical while testing less.

**If you disagree**, mark the affected scenarios `REQUEST_CHANGES` and say which criterion you
believe has an API surface. Nothing will be authored against a guessed contract.

## 3. Scenario-by-scenario

| Scenario | Criterion | Type | Interface | Suite | Real account? |
| --- | --- | --- | --- | --- | --- |
| TS-ETA-351-001 — a way to declare the sign-in kind exists before details are entered | AC-001 | POSITIVE | UI | smoke | no |
| TS-ETA-351-002 — both sign-in kinds are offered and distinguishable | AC-002 | POSITIVE | UI | smoke | no |
| TS-ETA-351-003 — choosing organization sign-in changes which details are asked for | AC-003 | POSITIVE | UI | regression | no |
| TS-ETA-351-004 — the password is not readable on screen | AC-004 | POSITIVE | UI | critical | no |
| TS-ETA-351-005 — correct details reach the Home page | AC-005 | POSITIVE | UI | critical | **yes** |
| TS-ETA-351-006 — wrong details are refused and reported | AC-006 | NEGATIVE | UI | regression | no |
| TS-ETA-351-007 — missing details are refused and reported | AC-007 | NEGATIVE | UI | regression | no |
| TS-ETA-351-008 — the two failure responses are distinguishable | AC-008 | NEGATIVE | UI | regression | no |

Only TS-ETA-351-005 uses the real organization account. Every negative scenario uses fabricated
values from `test-data/account-access.sample.json`, because the login page warns that an account can
lock out after a number of incorrect attempts. Lockout is out of scope for the story, but the risk to
a shared QA account is real whatever the scope says.

## 4. What these scenarios deliberately do not assert

Four criteria describe an observable effect without naming the observable signal, because the story
never states it. The six ambiguities raised at Gate 1 remain `REVIEW_REQUIRED` — your Gate 1 approval
agreed the behaviour, not the mechanism.

| Left abstract | Because |
| --- | --- |
| Which fields organization sign-in asks for | `AMB-ETA-351-001` unanswered |
| How the sign-in kind is chosen | `AMB-ETA-351-002` unanswered |
| The wording of any error message | `AMB-ETA-351-003` unanswered — no scenario asserts message text |
| Secret handling beyond on-screen concealment | `AMB-ETA-351-004` unanswered |
| What counts as a required field | `AMB-ETA-351-005` unanswered |
| Permission-dependent behaviour after the Home page | `AMB-ETA-351-006` unanswered |

Expected results are written at the same level of abstraction as the criteria. Observation at the
next stage may reveal *how* the application meets a criterion; it must never quietly become *what*
the criterion requires.

`REQ-ETA-351-004` still has no acceptance criterion and therefore no scenario of its own. It is
exercised indirectly. Giving it direct coverage requires a new criterion approved at Gate 1 first —
it will not be invented here.

## 5. Risks

`RISK-TP-ETA-351-001` through `-005` are carried forward unchanged from version 1. One is new:

- **`RISK-TP-ETA-351-006` (LOW)** — the UI-only judgement in section 2. Mitigated by resting it on
  captured evidence and by putting it in front of you here.

## 6. How to record your decision

Copy [test-plans/generated/TP-ETA-351-001-approval.template.json](TP-ETA-351-001-approval.template.json)
to `test-plans/approved/TP-ETA-351-001-approval.json`, replace the placeholders, and save. Only
scenarios carrying an item-level `APPROVE` flow into automation; anything else is recorded in the RTM
with its decision and is not built.

A message in chat is not an approval. The artifact on disk is.
