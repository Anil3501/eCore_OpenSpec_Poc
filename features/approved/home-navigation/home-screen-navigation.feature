@release-1.0 @capability-home-navigation @ETA-411 @tp-TP-ETA-411-001
Feature: Home screen navigation

  An Organization user signs in to eCore and is offered the modules their organization
  is authorized for. They can open those modules from the Dashboard icons on the Home
  page and from the navigation menu, reach Organization and Vault grouped beneath
  Preferences, and return to the Home page using Command Center. A visitor who is not
  signed in is refused and kept on the sign-in page.

  # No Background: TS-ETA-411-007 must start from a session that was never signed in.

  @req-REQ-ETA-411-001 @ac-AC-ETA-411-001 @ts-TS-ETA-411-001 @risk-medium @suite-smoke
  Scenario: The six named modules are offered to a signed-in Organization user
    Given I am signed in to eCore as an Organization user
    When I view the modules offered on the Home page and in the navigation menu
    Then the following modules are offered to me
      | Home            |
      | New Transaction |
      | Workspace       |
      | Preferences     |
      | Organization    |
      | Vault           |

  @req-REQ-ETA-411-002 @ac-AC-ETA-411-003 @ts-TS-ETA-411-002 @risk-high @suite-critical
  Scenario: The Dashboard icons open New Transaction, Workspace and Preferences
    Given I am signed in to eCore as an Organization user
    And the Home page is displayed
    When I select each of the following Dashboard icons in turn, returning to the Home page after each
      | New Transaction |
      | Workspace       |
      | Preferences     |
    Then each icon opens its own module

  @req-REQ-ETA-411-003 @ac-AC-ETA-411-004 @ts-TS-ETA-411-003 @risk-high @suite-critical
  Scenario: The navigation menu opens Home, New Transaction and Workspace
    Given I am signed in to eCore as an Organization user
    When I select each of the following entries from the navigation menu in turn
      | New Transaction |
      | Workspace       |
      | Home            |
    Then each entry opens its own module

  @req-REQ-ETA-411-003 @ac-AC-ETA-411-005 @ts-TS-ETA-411-004 @risk-medium @suite-regression
  Scenario: Preferences is offered in the navigation menu with Organization and Vault grouped beneath it
    Given I am signed in to eCore as an Organization user
    When I open the navigation menu
    Then Preferences is offered to me
    And the following entries are grouped beneath Preferences
      | Organization |
      | Vault        |

  @req-REQ-ETA-411-004 @ac-AC-ETA-411-006 @ts-TS-ETA-411-005 @risk-high @suite-regression
  Scenario: Organization and Vault open their own pages from beneath Preferences
    Given I am signed in to eCore as an Organization user
    When I select each of the following entries from beneath Preferences in turn, returning to the Home page after each
      | Organization |
      | Vault        |
    Then each entry opens its own page

  @req-REQ-ETA-411-005 @ac-AC-ETA-411-007 @ts-TS-ETA-411-006 @risk-high @suite-regression
  Scenario: Command Center returns the user to the Home page from each module
    Given I am signed in to eCore as an Organization user
    When I open each of the following modules and then select Command Center
      | New Transaction |
      | Workspace       |
      | Preferences     |
      | Organization    |
      | Vault           |
    Then the Home page is displayed again after each module

  @req-REQ-ETA-411-007 @ac-AC-ETA-411-009 @ts-TS-ETA-411-007 @risk-high @suite-critical
  Scenario: An unauthenticated visitor is refused a module and kept on the sign-in page
    Given I am not signed in to eCore
    When I request the Workspace module directly
    Then an error message is shown to me
    And the sign-in page is still displayed
