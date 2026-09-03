## Purpose

Home page navigation for eCore Command Center: the icons the Home page presents to a signed-in
organization user, the destination each icon leads to, the header links that duplicate two of those
icons, and the return to the Home page from a destination.

## ADDED Requirements

### Requirement: A signed-in organization user arrives at the Home page
On successful organization sign-in, the system SHALL place the user on the eCore Command Center Home
page.

Traces: `AC-ETA-411-001` (`REQ-ETA-411-001`). The sign-in mechanics themselves belong to
`account-access/organization-login` and are not restated here.

#### Scenario: Successful sign-in lands on the Home page
- **WHEN** an organization user signs in with correct organization details
- **THEN** the eCore Command Center Home page is displayed to them

### Requirement: The Home page presents three activatable icons
The Home page SHALL present three icons, named New Transaction, Workspace and Preferences, and each
SHALL be activatable by the user.

Traces: `AC-ETA-411-002` (`REQ-ETA-411-002`). The wider navigation menu is out of scope — see
`AMB-ETA-411-001`. Gate 1 recorded that this set does not vary by role or configuration
(`AMB-ETA-411-003`), so no permission-dependent variation is specified.

#### Scenario: All three icons are offered and can be activated
- **WHEN** an organization user examines the icons offered on the Home page
- **THEN** icons named New Transaction, Workspace and Preferences are offered
- **AND** each of the three can be activated

### Requirement: The New Transaction icon leads to the New Transaction page
Activating the New Transaction icon on the Home page SHALL take the user to the New Transaction page,
identified by the address `/ssweb/setup/container/ct/newPackage.eo`.

Traces: `AC-ETA-411-003` (`REQ-ETA-411-003`). Gate 1 resolved that the address of the destination is
acceptable evidence that the correct page was reached (`AMB-ETA-411-002`). This destination also
presents a "Create Transaction" heading, which is available as a stronger identifier if one is later
required.

#### Scenario: Activating the New Transaction icon reaches the New Transaction page
- **WHEN** an organization user on the Home page activates the New Transaction icon
- **THEN** they are taken to the New Transaction page

### Requirement: The Workspace icon leads to the Workspace page
Activating the Workspace icon on the Home page SHALL take the user to the Workspace page, identified
by the address `/ssweb/setup/workspace/workspace.eo`.

Traces: `AC-ETA-411-004` (`REQ-ETA-411-003`). The address is the only identifier this destination
offers; it presents no element unique to it (`AMB-ETA-411-002`).

#### Scenario: Activating the Workspace icon reaches the Workspace page
- **WHEN** an organization user on the Home page activates the Workspace icon
- **THEN** they are taken to the Workspace page

### Requirement: The Preferences icon leads to the Preferences page
Activating the Preferences icon on the Home page SHALL take the user to the Preferences page,
identified by the address `/ssweb/setup/prefs/preferences.eo`.

Traces: `AC-ETA-411-005` (`REQ-ETA-411-003`). The address is the only identifier this destination
offers; it presents no element unique to it (`AMB-ETA-411-002`).

#### Scenario: Activating the Preferences icon reaches the Preferences page
- **WHEN** an organization user on the Home page activates the Preferences icon
- **THEN** they are taken to the Preferences page

### Requirement: The Command Center control returns the user to the Home page
From a page reached by activating a Home page icon, activating the Command Center control in the
upper left corner SHALL return the user to the Home page.

Traces: `AC-ETA-411-006` (`REQ-ETA-411-004`). Gate 1 accepted the control as it stands
(`AMB-ETA-411-005`); how the control is labelled or exposed is deliberately unspecified, so this
requirement states the navigation outcome only.

#### Scenario: The Command Center control returns the user Home from a destination page
- **WHEN** an organization user has reached a destination page by activating a Home page icon
- **AND** they activate the Command Center control in the upper left corner
- **THEN** they are returned to the eCore Command Center Home page

### Requirement: The header navigation duplicates two of the Home page icons
The header navigation bar SHALL offer links named New Transaction and Workspace, providing a second
route to two of the three destinations the Home page icons lead to.

Traces: `AC-ETA-411-007` (`REQ-ETA-411-002`). This is deliberately two links, not three. The header
offers no Preferences link, so the Preferences page has one route where the other two destinations
have two. Whether the menu link labelled "Organization", which leads to the same address as the
Preferences icon, constitutes a third route is unresolved (`AMB-ETA-411-006`) and MUST NOT be assumed
either way.

#### Scenario: The header offers New Transaction and Workspace links
- **WHEN** an organization user examines the header navigation bar on the Home page
- **THEN** links named New Transaction and Workspace are offered
- **AND** those links are additional to the Home page icons of the same name

### Requirement: The header New Transaction link leads to the New Transaction page
Activating the New Transaction link in the header navigation bar SHALL take the user to the New
Transaction page, the same destination the Home page icon of that name leads to.

Traces: `AC-ETA-411-008` (`REQ-ETA-411-003`). This destination was approved on the evidence of the
link's address alone; the link was never activated during reconnaissance, and a redirect,
interstitial or permission check could intervene. It MUST be confirmed by navigation during
`PLAYWRIGHT_VALIDATION` before any test asserts it.

#### Scenario: Activating the header New Transaction link reaches the New Transaction page
- **WHEN** an organization user on the Home page activates the New Transaction link in the header
  navigation bar
- **THEN** they are taken to the New Transaction page

### Requirement: The header Workspace link leads to the Workspace page
Activating the Workspace link in the header navigation bar SHALL take the user to the Workspace page,
the same destination the Home page icon of that name leads to.

Traces: `AC-ETA-411-009` (`REQ-ETA-411-003`). As for `AC-ETA-411-008`, this destination rests on the
link's address alone and MUST be confirmed by navigation during `PLAYWRIGHT_VALIDATION` before any
test asserts it.

#### Scenario: Activating the header Workspace link reaches the Workspace page
- **WHEN** an organization user on the Home page activates the Workspace link in the header
  navigation bar
- **THEN** they are taken to the Workspace page
