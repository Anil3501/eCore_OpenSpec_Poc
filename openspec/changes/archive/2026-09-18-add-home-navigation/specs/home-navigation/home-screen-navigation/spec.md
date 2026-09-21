## Purpose

Defines what an authenticated Organization user can reach from the eCore Command Center Home page,
how they return to it from elsewhere in the application, and what a visitor who is not signed in is
shown when they request a module directly.

## ADDED Requirements

### Requirement: Home page and navigation menu offer the expected modules

The application SHALL offer an authenticated Organization user each of Home, New Transaction,
Workspace, Preferences, Organization and Vault, across the Home page and the top-right navigation
menu, and each SHALL be openable.

This requirement covers only the presence of these six modules. It makes no claim about whether
other modules are also offered, and it is not a statement about authorization.

#### Scenario: The six expected modules are offered and can be opened

- **WHEN** an Organization user is signed in to eCore and views the modules offered on the Home page and in the top-right navigation menu
- **THEN** each of Home, New Transaction, Workspace, Preferences, Organization and Vault is present and can be opened

### Requirement: Home page offers its primary destinations

The Home page SHALL offer New Transaction, Workspace and Preferences as destinations, and selecting
any of them SHALL open the corresponding module.

#### Scenario: A destination selected from the Home page opens

- **WHEN** an Organization user who is signed in and on the Home page selects New Transaction, Workspace or Preferences from the Dashboard icons
- **THEN** the corresponding module opens

### Requirement: Navigation menu offers its primary destinations

The top-right navigation menu SHALL offer Home, New Transaction and Workspace, and selecting any of
them SHALL open the corresponding module.

#### Scenario: A destination selected from the navigation menu opens

- **WHEN** an Organization user who is signed in opens the top-right navigation menu and selects Home, New Transaction or Workspace
- **THEN** the corresponding module opens

### Requirement: Navigation menu groups Organization and Vault under Preferences

The navigation menu SHALL offer Preferences, with Organization and Vault grouped beneath it.

This requirement is satisfied by Preferences being offered as a grouping. It does not require
Preferences itself to be a destination that opens a page.

#### Scenario: Preferences is offered with its grouped entries

- **WHEN** an Organization user who is signed in opens the navigation menu
- **THEN** Preferences is offered, with Organization and Vault grouped beneath it

### Requirement: Organization and Vault open their own pages

Selecting Organization or Vault beneath Preferences SHALL open the corresponding page. Each page
SHALL be identifiable by its own content, so that the two destinations remain distinguishable from
one another and from any other destination that resolves to the same location.

#### Scenario: A destination selected under Preferences opens

- **WHEN** an Organization user who is signed in opens the top-right navigation menu and selects Organization or Vault under Preferences
- **THEN** the corresponding page opens

### Requirement: Command Center returns the user to the Home page

The application SHALL offer an authenticated user a Command Center control that returns them to the
Home page from anywhere they have navigated to.

#### Scenario: Command Center returns the user Home

- **WHEN** an Organization user who is signed in and has navigated away from the Home page selects Command Center
- **THEN** the Home page is displayed again

### Requirement: An unauthenticated visitor is refused and told why

A visitor who is not signed in SHALL NOT reach a module by requesting it directly. The application
SHALL show an error message and leave the visitor on the sign-in page, so that the refusal is
visible rather than silent.

#### Scenario: A direct request without a session is refused

- **WHEN** a visitor who is not signed in, in a fresh browser session, requests a module directly
- **THEN** an error message is shown and the visitor remains on the sign-in page
