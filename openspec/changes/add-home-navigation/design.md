## Context

See proposal.md - Why. The behaviour specified here already exists in the product; nothing is being
built. The design question is therefore not how to implement it but how to state it honestly, given
that the evidence behind the seven approved criteria is uneven: five were observed by walking the
application, one rests on a probe of the page, and one rests only on the reviewer's expectation.

Two observations constrain what the specs can claim. The account used for verification reaches
nineteen navigable destinations while the story names six. And the reviewer narrowed scope at Gate 1
to the six named modules, which removed the only route to producing an unauthorized request.

## Goals / Non-Goals

**Goals:**

- State each approved criterion as a behaviour contract that a test can judge.
- Keep the strength of each claim matched to the strength of its evidence.
- Make the boundary between what was agreed and what was deferred explicit in the spec itself, so a
  later reader cannot mistake silence for coverage.

**Non-Goals:**

- Specifying authentication. `account-access/organization-login` already owns it.
- Specifying authorization. No organization-to-module mapping exists to specify against.
- Describing how any of this is automated. That belongs to the test plan and the automation design.

## Decisions

**The six-module requirement asserts presence only, and says so in its own text.**
The story's wording is about modules the user is authorized for, which is an "only" claim: it is
contradicted by an extra module appearing, not by a named one missing. Nothing available can
establish which modules this organization should see, so the requirement carries an explicit
sentence disclaiming any authorization meaning. The alternative, stating the requirement in
authorization language and testing it as presence, was rejected: it would read as covered while
proving something much weaker.

**Preferences is specified as a grouping, not a destination.**
The reviewer stated Preferences is displayed in the menu; observation found Organization and Vault
beneath a heading and no destination of that name. Both hold if Preferences is a grouping, so that
is what the requirement says. Specifying it as a destination was rejected because it would fail
against the current product, and if the reviewer intended a destination the correct outcome is a
defect report, not a passing test. This is flagged for Gate 2 rather than settled here.

**Organization and Vault must be distinguished by page content.**
Organization resolves to the same location as the Home page's Preferences destination. A requirement
satisfied by arrival at a location alone could therefore be met by the wrong destination, so the
requirement demands each page be identifiable by its own content.

**The unauthenticated requirement is stated as expected behaviour, not observed behaviour.**
It was never exercised. It is specified as the product ought to behave; if the application differs,
the mismatch is reported and this spec stands. Writing the spec from observation was rejected on the
grounds that it would make current behaviour the definition of correct and let a real defect pass
forever.

**Deferred criteria are named in the proposal rather than silently dropped.**
Three were deferred at Gate 1. Omitting them entirely would leave no trace of the gap between what
the story asked for and what this change specifies.

## Risks / Trade-offs

- **The authorization intent of the story is not specified at all.** → Recorded as deferred with its
  reason, and the requirement text disclaims the stronger reading. Reopening needs a source of truth
  for which modules an organization should see.
- **The unauthenticated requirement may not match the product.** → Detected at validation before any
  test is approved; treated as a finding about the product, not a defect in the spec.
- **Preferences may have been intended as a destination.** → Raised for Gate 2 with the consequence
  stated, so the weaker reading is ratified deliberately or corrected.
- **Specifying behaviour the product already has can produce tests that only confirm the status
  quo.** → Each requirement is written from the approved criterion rather than from observation, so
  a divergence surfaces as a failure rather than being absorbed.

## Open Questions

None that can be deferred safely. The open matters - the authorization mapping, the meaning of
"consistent", and whether Preferences should be a destination - all change what the specs claim, so
they are recorded as deferred criteria and Gate 2 questions rather than as open questions here.
