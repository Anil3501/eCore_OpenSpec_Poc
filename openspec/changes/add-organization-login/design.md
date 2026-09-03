## Context

See [proposal.md](proposal.md) — Why. The requirements are in
[specs/account-access/organization-login/spec.md](specs/account-access/organization-login/spec.md).

The constraint that shapes this design is not technical. ETA-351 carries **no acceptance criteria in
Jira**; the eight approved criteria are readings of a prose description, and six ambiguities
(`AMB-ETA-351-001` … `AMB-ETA-351-006`) were **deferred, not answered**, at Gate 1. The specification
is therefore deliberately weaker than a reader might expect in several places, and the main design
problem is preventing that weakness from being quietly "fixed" by someone downstream inventing a
business rule.

## Goals / Non-Goals

**Goals**

- Keep every specified requirement traceable to exactly one approved acceptance criterion.
- Make each unresolved ambiguity visible at the point where it constrains a requirement, so it
  cannot be silently resolved during test planning or automation.
- Route each ambiguity to whichever authority can actually answer it.

**Non-Goals**

- Deciding any deferred ambiguity. That is a human decision, or an observation of the running
  application — never an inference from this document.
- Specifying automation structure. Feature files, step definitions and page objects are produced at
  BDD design and implementation, after Gate 2 and Gate 3.

## Decisions

**Requirements assert only what the story literally states.**
Chosen over the alternative of writing fuller, more conventional login requirements. A richer spec
would read better and be easier to test, but every added detail would be invented. The story's
own out-of-scope list names exact error-message wording and account lockout, so a spec asserting
message text would contradict the source.

**Failure responses are specified as *different from each other*, not as specific content.**
The alternative — asserting what each response says — is unavailable: wording is explicitly out of
scope, yet the story still demands the user can tell the two problems apart. Distinguishability is
the strongest claim that is both supported and non-inventive. It is also genuinely verifiable:
compare the two responses to each other rather than to a fixed string.

**Ambiguities are split by who can answer them.**
Not all six are alike, and treating them alike would send unanswerable questions to a browser.

| Answerable by observing the application | Requires a human decision |
| --- | --- |
| `AMB-001` field set | `AMB-004` scope of secret handling |
| `AMB-002` selection mechanism | `AMB-006` whether permission behaviour is in scope |
| `AMB-003` what differs between the two failure responses | |
| `AMB-005` which details are mandatory | |

The first group is resolved at `PLAYWRIGHT_VALIDATION` by observing real behaviour. The second
cannot be: watching a login page cannot reveal what the business *intended* by "treated as such on
screen". Those must return to a human.

**Each requirement names the ambiguity that limits it.**
Rather than collecting them in one section. Inline placement means a test planner reading a single
requirement sees its limitation without cross-referencing.

## Risks / Trade-offs

- **A downstream stage hardens a deferred ambiguity into an expectation** → each requirement names
  its ambiguity inline, and the Gate 1 approval comment instructs downstream stages not to assert
  unresolved ambiguities. The test plan must be reviewed against this at Gate 2.
- **Observation is mistaken for specification.** What the application does is not automatically what
  it should do. → An observed behaviour may fill in an unspecified detail (which field exists), but
  may never override an approved criterion. Any conflict between application behaviour and an
  approved expectation is recorded as a discrepancy, not silently absorbed.
- **The distinguishability requirement is weak.** Two responses could differ trivially and still
  satisfy it. → Accepted deliberately: strengthening it requires answering `AMB-ETA-351-003`, which
  only a human can do.
- **A negative-path test could lock the real account.** ETA-351 places account lockout out of scope,
  but the application still has whatever behaviour it has. → Wrong-credential and missing-field
  paths must use fabricated data; only the success path may use real credentials.
- **The QA host requires VPN** → `PLAYWRIGHT_VALIDATION` and execution halt as an environment
  blocker rather than producing a misleading result.

## Migration Plan

Not applicable. This change introduces a new capability specification and no existing behaviour,
data or interface changes.

## Open Questions

None that are safely deferrable in this document's sense. The six ambiguities are tracked in
[requirements/approved/ETA-351.json](../../../requirements/approved/ETA-351.json) with status
`REVIEW_REQUIRED`, and each one *would* change the specification if answered differently — which is
precisely why they are recorded as constraints on the requirements rather than as open questions
here.
