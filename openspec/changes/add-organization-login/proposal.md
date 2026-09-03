## Why

eCore Command Center supports more than one kind of sign-in on a single login page, and organization
users authenticate against their organization rather than an individual business entity. ETA-351
defines that behaviour, and eight acceptance criteria were approved at Gate 1
(`APR-AC-ETA-351-001`). None of them is currently specified, so there is no agreed statement of what
the login page must do for an organization user.

This change captures that approved behaviour as a specification, so the test plan and automation
that follow are derived from a spec rather than from a prose Jira description.

## What Changes

- Introduce a specification for organization sign-in covering the eight approved acceptance criteria
  `AC-ETA-351-001` through `AC-ETA-351-008`.
- Specify that the login page lets a user declare which kind of sign-in they are using **before**
  entering credential details.
- Specify that both organization sign-in and Business Entity Login are offered and are
  distinguishable, without specifying Business Entity Login behaviour.
- Specify that the details requested depend on the declared sign-in kind.
- Specify that a password is not readable on screen.
- Specify that correct details lead to the Home page.
- Specify that wrong details and missing details each refuse entry, each inform the user, and are
  distinguishable from one another.

No breaking change. This is a new capability with no existing spec to modify.

### Deliberately not specified

The following are **not** in this change, because ETA-351 places them out of scope or leaves them
unresolved. Six ambiguities (`AMB-ETA-351-001` … `AMB-ETA-351-006`) were deferred rather than
answered at Gate 1, and specifying any of them would invent a business rule:

- The exact field set for organization sign-in (`AMB-ETA-351-001`).
- The mechanism by which the sign-in kind is declared (`AMB-ETA-351-002`).
- Any specific error-message wording, which ETA-351 lists as out of scope (`AMB-ETA-351-003`).
- Any secret-handling obligation beyond on-screen concealment (`AMB-ETA-351-004`).
- Which individual details are mandatory (`AMB-ETA-351-005`).
- Any permission-dependent behaviour after arrival on the Home page (`AMB-ETA-351-006`).

Also out of scope per the story: Business Entity Login behaviour, Forgot Password, password reset,
user creation, organization creation, role and permission configuration, MFA and SSO, session
timeout, and account lockout.

## Capabilities

### New Capabilities
- `account-access/organization-login`: Organization sign-in for eCore Command Center — declaring the
  sign-in kind, supplying organization credentials, reaching the Home page on success, and being
  refused and informed on wrong or missing details.

### Modified Capabilities
<!-- None. No existing spec under openspec/specs/ changes. -->

## Impact

- **Traceability**: `traceability/capabilities/account-access.rtm.json` gains `openSpecRefs` linking
  each of the eight acceptance criteria to its specification requirement.
- **Downstream stages**: this spec becomes an input to `TEST_PLAN_GENERATION` (Gate 2) and, after
  approval, to BDD design and automation.
- **Application code**: none. This change is planning only.
- **Unresolved risk**: because six ambiguities are deferred, the specification asserts only what the
  story literally states. Several requirements are therefore deliberately weaker than a reader might
  expect, and `PLAYWRIGHT_VALIDATION` against the real login page is where the observable ones
  (field set, selection mechanism, difference between the two failure responses) are expected to be
  answered. Any answer that the application cannot supply must return to a human before it is
  treated as a business rule.
