@release-1.0 @capability-home-navigation @ETA-411 @tp-TP-ETA-411-001
Feature: Home page icon navigation in eCore Command Center

  As a signed-in organization user of eCore Command Center
  I want the Home page icons and the header links to take me where they say
  So that I can reach the parts of the application I need and get back Home again

  # Every scenario below traces to an acceptance criterion approved at Gate 1 and to a
  # scenario approved at Gate 2 in TP-ETA-411-001. Nine criteria, nine scenarios, one
  # each - no criterion is covered twice and none is left uncovered.
  #
  # Two things a reader should know before trusting this file.
  #
  # First, the Home page dashboard and the header navigation bar both offer items named
  # "New Transaction" and "Workspace". They are different elements reaching the same
  # destinations. Every scenario names which of the two it uses, because a locator chosen
  # for convenience could silently exercise the header link while claiming to test the
  # dashboard icon - which would make two scenarios one test wearing two identifiers.
  # See RISK-TP-ETA-411-003.
  #
  # Second, the header links have never been activated. Their expected destinations come
  # from a link address, not from navigation. PLAYWRIGHT_VALIDATION must walk both before
  # they are implemented, and a difference is recorded as a discrepancy rather than
  # absorbed by editing the expectation. See RISK-TP-ETA-411-001.
  #
  # There are no negative scenarios here, and their absence is deliberate. ETA-411
  # describes only successful navigation, so no approved criterion says what should happen
  # when a destination is unavailable or a session has expired. This suite proves that
  # navigation works and proves nothing about how it fails. See RISK-TP-ETA-411-008.
  #
  # No scenario reaches the Preferences page other than through the Home page icon. No
  # header Preferences link exists, and AMB-ETA-411-006 - whether the menu link labelled
  # "Organization" is a second route to that page - is unresolved. It must not be settled
  # by adding a scenario here.

  # Amended 2026-09-01 (artifactVersion 2). The middle step was missing when this file was
  # approved at Gate 3, and EXECUTION found it: "sign in with correct organization details" fills
  # the Organization Name field, which the login page only renders once the organization kind has
  # been chosen. The step reused here already exists and is used seven times in ETA-351. Nothing
  # about the approved behaviour changed - the scenario always meant to sign in as an organization
  # user - so AC-ETA-411-001 is untouched and Gate 1 stays shut.
  @req-REQ-ETA-411-001 @ac-AC-ETA-411-001 @ts-TS-ETA-411-001 @risk-high @suite-critical
  Scenario: A successful organization sign-in places the user on the Home page
    Given the eCore Command Center login page is open
    And I have chosen to sign in on behalf of my organization
    When I sign in with correct organization details
    Then I arrive at the eCore Command Center Home page

  @req-REQ-ETA-411-002 @ac-AC-ETA-411-002 @ts-TS-ETA-411-002 @risk-medium @suite-smoke
  Scenario: The Home page presents three activatable icons
    Given I am signed in as an organization user on the eCore Command Center Home page
    When I look at the icons offered on the Home page dashboard
    Then three icons are offered, named New Transaction, Workspace and Preferences
    And each of the three icons can be activated

  # The only destination that offers an element unique to it, so this scenario asserts
  # more than arrival. The other two icon scenarios cannot.
  @req-REQ-ETA-411-003 @ac-AC-ETA-411-003 @ts-TS-ETA-411-003 @risk-high @suite-critical
  Scenario: The New Transaction icon reaches the New Transaction page
    Given I am signed in as an organization user on the eCore Command Center Home page
    When I activate the New Transaction icon on the Home page dashboard
    Then I arrive at the New Transaction page
    And the page offers to create a transaction

  # Arrival only. The Workspace page exposes nothing unique to it, and every page in the
  # application returns the same browser title, so this will pass on a page that reached
  # the right place and then failed to render. Knowingly accepted as AMB-ETA-411-002.
  @req-REQ-ETA-411-003 @ac-AC-ETA-411-004 @ts-TS-ETA-411-004 @risk-high @suite-critical
  Scenario: The Workspace icon reaches the Workspace page
    Given I am signed in as an organization user on the eCore Command Center Home page
    When I activate the Workspace icon on the Home page dashboard
    Then I arrive at the Workspace page

  # Arrival only, as above. This is the single approved route to the Preferences page.
  @req-REQ-ETA-411-003 @ac-AC-ETA-411-005 @ts-TS-ETA-411-005 @risk-high @suite-critical
  Scenario: The Preferences icon reaches the Preferences page
    Given I am signed in as an organization user on the eCore Command Center Home page
    When I activate the Preferences icon on the Home page dashboard
    Then I arrive at the Preferences page

  # The criterion says "any Home page icon", so all three return legs are walked rather
  # than one being walked and the other two inferred. Nothing is asserted about how the
  # control is labelled - it exposes no accessible name, accepted as AMB-ETA-411-005.
  @req-REQ-ETA-411-004 @ac-AC-ETA-411-006 @ts-TS-ETA-411-006 @risk-high @suite-critical
  Scenario Outline: The Command Center control returns the user Home from <destination>
    Given I am signed in as an organization user on the eCore Command Center Home page
    And I have reached the <destination> by activating the <icon> icon on the Home page dashboard
    When I activate the Command Center control in the upper left corner
    Then I arrive at the eCore Command Center Home page

    Examples:
      | icon            | destination          |
      | New Transaction | New Transaction page |
      | Workspace       | Workspace page       |
      | Preferences     | Preferences page     |

  # Exactly two duplicates, not three. There is no header Preferences link and this
  # scenario must never be extended to claim one.
  @req-REQ-ETA-411-002 @ac-AC-ETA-411-007 @ts-TS-ETA-411-007 @risk-medium @suite-smoke
  Scenario: The header navigation offers New Transaction and Workspace links
    Given I am signed in as an organization user on the eCore Command Center Home page
    When I look at the links offered in the header navigation bar
    Then links named New Transaction and Workspace are offered in the header navigation bar
    And those links are distinct from the Home page dashboard icons of the same name

  # UNCONFIRMED DESTINATION. Expected page taken from the link address, never navigated.
  # Must exercise the header link; exercising the icon would duplicate TS-ETA-411-003.
  @req-REQ-ETA-411-003 @ac-AC-ETA-411-008 @ts-TS-ETA-411-008 @risk-high @suite-regression
  Scenario: The header New Transaction link reaches the New Transaction page
    Given I am signed in as an organization user on the eCore Command Center Home page
    When I activate the New Transaction link in the header navigation bar
    Then I arrive at the New Transaction page

  # UNCONFIRMED DESTINATION, as above. Must exercise the header link, not the icon.
  @req-REQ-ETA-411-003 @ac-AC-ETA-411-009 @ts-TS-ETA-411-009 @risk-high @suite-regression
  Scenario: The header Workspace link reaches the Workspace page
    Given I am signed in as an organization user on the eCore Command Center Home page
    When I activate the Workspace link in the header navigation bar
    Then I arrive at the Workspace page
