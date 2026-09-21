## Why

ETA-411 requires the Home screen of eCore Command Center to be covered by automated tests, but the
navigation behaviour it depends on has never been written down as a specification. Seven acceptance
criteria were approved at Gate 1 on 2026-09-05; this change records the behaviour they assert so the
test plan and automation that follow are traceable to an agreed spec rather than to observation of
the running application.

## What Changes

- Introduce a specification for authenticated navigation from the eCore Command Center Home page.
- Specify that the Home page offers the New Transaction, Workspace and Preferences destinations, and
  that each one opens.
- Specify that the navigation menu offers Home, New Transaction and Workspace, and that each one
  opens.
- Specify that Preferences is offered in the navigation menu with Organization and Vault beneath it,
  and that Organization and Vault each open their own page.
- Specify that the Command Center control returns the user to the Home page from elsewhere in the
  application.
- Specify that an unauthenticated visitor requesting an application page is shown an error and
  remains on the sign-in page.
- No existing behaviour is modified or removed. Nothing here is **BREAKING**.

Three approved-at-Gate-1 items are deliberately **excluded** because they were deferred, not agreed:

- Whether the Home page offers *only* the modules the organization is authorized for. No
  organization-to-module mapping exists, so the claim cannot be specified honestly.
- Whether the user interface and its supporting requests grant access consistently. "Consistent" was
  left undefined by the reviewer.
- Whether a request for an unauthorized module is refused. Scope was narrowed to modules this
  account is authorized for, so no unauthorized module remains to request.

## Capabilities

### New Capabilities

- `home-navigation/home-screen-navigation`: what an authenticated user can reach from the eCore
  Command Center Home page, how they return to it, and what an unauthenticated visitor is shown
  instead.

### Modified Capabilities

None. `account-access/organization-login` already specifies signing in and is unchanged by this
work; this capability begins once the user is authenticated and holds the Home page.

## Impact

- Adds one new specification under `openspec/specs/home-navigation/`.
- Feeds the ETA-411 test plan and the Gherkin scenarios generated from it for release 1.0.
- Depends on an authenticated session; it does not restate how authentication happens.
- No application code, API or dependency is affected. This change specifies behaviour that the
  product is expected to already have, so it should reveal defects rather than require development.
- One criterion, that an unauthenticated visitor is shown an error and stays on the sign-in page, is
  recorded as the reviewer's stated expectation and has not yet been observed. If the application
  behaves differently, that is reported as a mismatch and this specification is not rewritten to
  match it.
