# Gate 3 amendment review — TP-ETA-411-001, artifactVersion 2

**Story:** ETA-411 · **Capability:** home-navigation · **Release:** 1.0
**Raised:** 2026-09-01 · **Supersedes:** the Gate 3 approval given 2026-09-01T13:00:00Z (version 1)

This is a **narrow amendment**, not a re-review of the whole design. One scenario changed. The other
eight are untouched and their version 1 approvals still stand on their own terms.

## What changed

`TS-ETA-411-001`, one added step:

```gherkin
  Scenario: A successful organization sign-in places the user on the Home page
    Given the eCore Command Center login page is open
+   And I have chosen to sign in on behalf of my organization
    When I sign in with correct organization details
    Then I arrive at the eCore Command Center Home page
```

## Why

The scenario failed at EXECUTION with a 30-second timeout on `locator.fill`, waiting for the
`Organization Name` textbox.

`When I sign in with correct organization details` fills the organization fields. The login page only
renders those fields once the sign-in kind has been chosen — that is the behaviour
`AC-ETA-351-003` exists to prove. In ETA-351 the step is preceded by
`Given I have chosen to sign in on behalf of my organization` in all seven places it is used. The
ETA-411 scenario omitted it.

The other eight ETA-411 scenarios were unaffected because
`Given I am signed in as an organization user on the eCore Command Center Home page` chooses the kind
internally.

**The step being added already exists.** No new step definition, no new page object, no new locator.

## What this does not change

| Question | Answer |
| --- | --- |
| Does `AC-ETA-411-001` change? | **No.** The criterion always meant an organization sign-in. Gate 1 stays shut. |
| Does `TP-ETA-411-001` change? | **No.** `TS-ETA-411-001` still covers the same criterion the same way. Gate 2 stays shut. |
| Does any other scenario change? | **No.** |
| Is any new behaviour asserted? | **No.** The scenario asserts exactly what it always asserted. |
| Is any application defect implied? | **No.** The application behaved correctly throughout. |

## Verification already performed

- `npm run bdd` regenerated cleanly, still 11 tests, no undefined or duplicate steps.
- `TS-ETA-411-001` **passes** (35.6s).
- `npm run typecheck` clean; `npm run validate:artifacts` 15 passed / 0 failed / 2 skipped.

The scenario has therefore been proven to work **before** you are asked to approve it. That ordering
is deliberate: it means this gate is a judgement about whether the change is legitimate, not a bet on
whether it functions.

## What the gate did not catch, and why that matters more than the fix

A missing precondition is invisible to a human reading Gherkin for business behaviour — the scenario
reads perfectly. It is invisible to `SEM-FEATURE-TAGS`, which checks traceability tags, and to
`SEM-AUTOMATION-HYGIENE`, which checks locators and waits. It is invisible to `bddgen`, because every
step bound successfully. Nothing in the pipeline models the *state a step requires on entry*.

It surfaced only when a real browser tried it. Three gates, a design document and two automated
rule-sets passed a scenario that could never have worked.

This is worth recording as a known limit of the framework rather than treating the one-line fix as
the whole story. No change to the framework is proposed here — that is a separate decision, and this
gate is not the place to make it.

## Decision requested

Approve, reject or request changes on **`TS-ETA-411-001` only**.

- **Template:** [TP-ETA-411-001-automation-approval.v2.template.json](TP-ETA-411-001-automation-approval.v2.template.json)
- **Write the completed approval to:** `features/approved/home-navigation/TP-ETA-411-001-automation-approval.json`
  (replacing the version 1 artifact, whose content is preserved in this review and in the workflow history)

On approval the workflow resumes at `EXECUTION` for a full clean run.
