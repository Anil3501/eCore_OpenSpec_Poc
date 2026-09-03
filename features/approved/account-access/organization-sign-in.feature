@release-1.0 @capability-account-access @ETA-351 @tp-TP-ETA-351-001
Feature: Organization sign-in to eCore Command Center

  As an organization user of eCore Command Center
  I want to sign in using my organization credentials
  So that I can access the application

  # Every scenario below traces to an acceptance criterion approved at Gate 1 and
  # to a scenario approved at Gate 2 in TP-ETA-351-001.
  #
  # Several expectations are deliberately abstract. The story states what must
  # happen but not what it looks like, and exact error-message wording is out of
  # scope. Those gaps are recorded as AMB-ETA-351-001 through AMB-ETA-351-006 and
  # must not be closed by guessing. Observing the real page may reveal how a
  # criterion is met; it may never change what the criterion requires.

  Background:
    Given the eCore Command Center login page is open

  @req-REQ-ETA-351-001 @ac-AC-ETA-351-001 @ts-TS-ETA-351-001 @risk-medium @suite-smoke
  Scenario: The login page offers a way to declare the kind of sign-in before any details are entered
    When I look at the page before entering any details
    Then the page offers a way to declare which kind of sign-in I am using

  @req-REQ-ETA-351-002 @ac-AC-ETA-351-002 @ts-TS-ETA-351-002 @risk-medium @suite-smoke
  Scenario: Both supported sign-in kinds are offered and can be told apart
    When I examine the sign-in kinds the page offers
    Then organization sign-in and Business Entity Login are both offered
    And I can tell the two kinds apart

  @req-REQ-ETA-351-003 @ac-AC-ETA-351-003 @ts-TS-ETA-351-003 @risk-high @suite-regression
  Scenario: Choosing organization sign-in makes the page ask for the organization details rather than every possible field
    When I choose to sign in on behalf of my organization
    Then the page asks me for the details that belong to organization sign-in
    And the page does not present every possible field at once

  @req-REQ-ETA-351-006 @ac-AC-ETA-351-004 @ts-TS-ETA-351-004 @risk-high @suite-critical
  Scenario: The password is not readable on screen as it is typed
    Given I have chosen to sign in on behalf of my organization
    When I type the secret that proves who I am
    Then the secret is not readable on screen

  @req-REQ-ETA-351-005 @ac-AC-ETA-351-005 @ts-TS-ETA-351-005 @risk-high @suite-critical
  Scenario: Correct organization details admit the user to the eCore Command Center Home page
    Given I have chosen to sign in on behalf of my organization
    When I sign in with correct organization details
    Then I arrive at the eCore Command Center Home page

  @req-REQ-ETA-351-007 @ac-AC-ETA-351-006 @ts-TS-ETA-351-006 @risk-high @suite-regression
  Scenario: Wrong details do not admit the user and the user is told what happened
    Given I have chosen to sign in on behalf of my organization
    When I sign in with organization details that are wrong
    Then I am not admitted to the application
    And I am told that the sign-in attempt failed

  @req-REQ-ETA-351-007 @ac-AC-ETA-351-007 @ts-TS-ETA-351-007 @risk-high @suite-regression
  Scenario: Required details left out do not admit the user and the user is told what happened
    Given I have chosen to sign in on behalf of my organization
    When I sign in leaving required organization details out
    Then I am not admitted to the application
    And I am told that the sign-in attempt failed

  @req-REQ-ETA-351-008 @ac-AC-ETA-351-008 @ts-TS-ETA-351-008 @risk-high @suite-regression
  Scenario: The response to wrong details differs from the response to missing details
    Given I have chosen to sign in on behalf of my organization
    When I sign in with organization details that are wrong
    And I remember how the application responded
    And I return to the login page and choose to sign in on behalf of my organization
    And I sign in leaving required organization details out
    Then the response differs from the one I remembered
