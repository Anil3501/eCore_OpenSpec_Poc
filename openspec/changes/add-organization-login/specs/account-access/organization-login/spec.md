## Purpose

Organization sign-in for eCore Command Center: how a user declares that they are signing in on
behalf of their organization, supplies their organization credentials, reaches the Home page when
those details are correct, and is refused and informed when they are wrong or incomplete.

## ADDED Requirements

### Requirement: Sign-in kind is declared before credentials are entered
The login page SHALL offer a way for the user to declare which kind of sign-in they are using, and
that choice SHALL be available before any credential detail is entered.

Traces: `AC-ETA-351-001` (`REQ-ETA-351-001`). The mechanism of declaration is intentionally
unspecified — see `AMB-ETA-351-002`.

#### Scenario: The choice is available before any details are entered
- **WHEN** the eCore Command Center login page is open and no details have been entered
- **THEN** the page offers a way to declare which kind of sign-in is being used

### Requirement: Both sign-in kinds are offered and distinguishable
The login page SHALL offer both organization sign-in and Business Entity Login, and the user SHALL
be able to tell the two apart and choose between them. The behaviour of Business Entity Login itself
is out of scope for this capability.

Traces: `AC-ETA-351-002` (`REQ-ETA-351-002`).

#### Scenario: Both kinds are present and can be told apart
- **WHEN** the user examines the sign-in kinds offered on the login page
- **THEN** organization sign-in and Business Entity Login are both offered
- **AND** the user can tell the two apart from each other

### Requirement: Requested details depend on the declared sign-in kind
The login page SHALL request the details that belong to the declared sign-in kind, and SHALL NOT
present every possible field at once.

Traces: `AC-ETA-351-003` (`REQ-ETA-351-003`). The concrete field set is intentionally unspecified —
see `AMB-ETA-351-001`.

#### Scenario: Declaring organization sign-in determines which details are requested
- **WHEN** the user indicates they are signing in on behalf of their organization
- **THEN** the page requests the details that belong to organization sign-in
- **AND** the page does not present every possible field at once

### Requirement: A password is not readable on screen
The login page SHALL conceal the secret the user supplies so that it is not readable on screen.

Traces: `AC-ETA-351-004` (`REQ-ETA-351-006`). Obligations beyond on-screen concealment are
intentionally unspecified — see `AMB-ETA-351-004`.

#### Scenario: The typed secret is concealed
- **WHEN** the user types the secret that proves who they are
- **THEN** the secret is not readable on screen

### Requirement: Correct details admit the user to the Home page
When a user signing in on behalf of their organization supplies correct details and submits, the
system SHALL take them to the eCore Command Center Home page.

Traces: `AC-ETA-351-005` (`REQ-ETA-351-005`). This requirement ends at arrival on the Home page;
permission-dependent behaviour is intentionally unspecified — see `AMB-ETA-351-006`.

#### Scenario: Successful organization sign-in
- **WHEN** the user has declared organization sign-in, supplies correct details and submits
- **THEN** the user arrives at the eCore Command Center Home page

### Requirement: Wrong details are refused and reported
When the details supplied are wrong, the system SHALL NOT admit the user to the application, and
SHALL inform the user that the attempt failed.

Traces: `AC-ETA-351-006` (`REQ-ETA-351-007`). No specific message wording is required or permitted
to be asserted — ETA-351 places exact error-message wording out of scope; see `AMB-ETA-351-003`.

#### Scenario: Wrong details do not admit the user
- **WHEN** the user has declared organization sign-in, supplies wrong details and submits
- **THEN** the user is not admitted to the application
- **AND** the user is informed that the attempt failed

### Requirement: Missing details are refused and reported
When required details are left out, the system SHALL NOT admit the user to the application, and
SHALL inform the user that the attempt failed.

Traces: `AC-ETA-351-007` (`REQ-ETA-351-007`). Which individual details are mandatory is intentionally
unspecified — see `AMB-ETA-351-005`.

#### Scenario: Missing details do not admit the user
- **WHEN** the user has declared organization sign-in, leaves required details out and submits
- **THEN** the user is not admitted to the application
- **AND** the user is informed that the attempt failed

### Requirement: The two failure responses are distinguishable
The response to wrong details SHALL differ from the response to missing details, so that the user
can tell which of the two problems they have hit.

Traces: `AC-ETA-351-008` (`REQ-ETA-351-008`). This requirement constrains only that the two responses
differ; it does not constrain what either response says — see `AMB-ETA-351-003`.

#### Scenario: Wrong details and missing details produce different responses
- **WHEN** the user submits wrong details on one attempt and leaves required details out on another
- **THEN** the two responses differ from each other
- **AND** the user can tell which of the two problems they have hit
