@release-26.3 @capability-document-activity-history @EC-11358 @tp-TP-EC-11358-001
Feature: Control History in the Document Activity History Report

  @req-REQ-EC-11358-001 @ac-AC-EC-11358-001 @ts-TS-EC-11358-001 @risk-high @suite-smoke
  Scenario: A transferred financial asset shows a consolidated Control History table in its Document Activity History Report
    Given a financial asset document that has undergone a confirmed transfer of control
    When I open its Document Activity History Report
    Then a Control History table consolidating the document's transfers is shown

  @req-REQ-EC-11358-002 @ac-AC-EC-11358-002 @ts-TS-EC-11358-002 @risk-medium @suite-regression
  Scenario: Each Control History row shows the transfer date and both organizations
    Given a Document Activity History Report that shows a Control History table
    When I read each row of the Control History table
    Then each row shows the transfer date
    And each row shows the organization control was transferred from
    And each row shows the organization control was transferred to

  @req-REQ-EC-11358-003 @ac-AC-EC-11358-003 @ts-TS-EC-11358-003 @risk-medium @suite-regression
  Scenario: A document with no confirmed transfer shows no Control History table
    Given a document that has no confirmed transfer of control
    When I open its Document Activity History Report
    Then no Control History table is shown

  @req-REQ-EC-11358-004 @ac-AC-EC-11358-004 @ts-TS-EC-11358-004 @risk-high @suite-regression
  Scenario: Multiple transfers are ordered newest to oldest
    Given a document that has undergone more than one confirmed transfer of control
    When I open its Document Activity History Report
    Then the Control History entries run from newest to oldest
    And the oldest entry's transferred-from organization is the original controller

  @req-REQ-EC-11358-005 @ac-AC-EC-11358-005 @ts-TS-EC-11358-005 @risk-medium @suite-smoke
  Scenario: The Control History table appears in the Document Activity History Report UI view
    Given a document whose Document Activity History Report contains a Control History table
    When I view the Document Activity History Report on screen
    Then the Control History table appears in the on-screen output

  @req-REQ-EC-11358-006 @ac-AC-EC-11358-006 @ts-TS-EC-11358-008 @risk-medium @suite-regression
  Scenario Outline: Document type determines whether the Control History table is produced
    Given a "<document type>" that has undergone transfers
    When I open its Document Activity History Report
    Then the Control History table is "<presence>"

    Examples:
      | document type            | presence  |
      | Financial Asset          | shown     |
      | Financial Asset Addendum | shown     |
      | Supplemental Doc         | not shown |
