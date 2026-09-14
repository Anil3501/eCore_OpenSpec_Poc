@release-26.3 @capability-paper-out-export @EC-12000 @tp-TP-EC-12000-001
Feature: Paper Out media type determination and acknowledgement flow

  As an eCore Command Center user
  I want the Paper Out/Export flow to capture and enforce a Media Type
  So that paper vs. electronic delivery is recorded accurately, gated correctly,
  and audited without being altered after the fact

  # Every scenario below traces to an acceptance criterion approved at Gate 1
  # (requirements/approved/EC-12000-ac-approval.json) and to a scenario approved
  # at Gate 2 (test-plans/approved/TP-EC-12000-001-approval.json).
  #
  # AC-EC-12000-005 and -006 (the eoRequestExport mediaType element itself) are
  # DEFERRED at Gate 2 - no scenario exists for them here until the contract is
  # captured via Playwright MCP at PLAYWRIGHT_VALIDATION (AMB-EC-12000-002).
  #
  # Scenarios tagged @interface-hybrid call eoRequestExport to set state but can
  # only confirm the recorded outcome through the UI audit trail (AC-EC-12000-016),
  # so they exercise both interfaces. Their API step is scaffolding only - it
  # reaches a state, it never proves one - until a human promotes an observed
  # eoRequestExport contract to HUMAN_APPROVED.
  #
  # AMB-EC-12000-001 resolution: a Paper Out initiated from Collections uses the
  # Collections accordion's Batch option, then the same Paper Out Request modal
  # used everywhere else.
  # AMB-EC-12000-003 resolution: the modal's required fields are "Name of
  # Request:" (fabricated test value) and "Approver:" (the logged-in user).

  @req-REQ-EC-12000-001 @ac-AC-EC-12000-001 @ts-TS-EC-12000-001 @risk-low @suite-smoke
  Scenario: The Paper Out Request modal shows the Media Type section with Print to Paper selected by default
    Given a user opens the Paper Out Request modal
    Then a Media Type for Paper Out Package section is shown
    And "Print to Paper" is selected by default

  @req-REQ-EC-12000-002 @ac-AC-EC-12000-002 @ts-TS-EC-12000-002 @risk-medium @suite-critical
  Scenario: Selecting Save as Electronic File and completing required fields opens a checkbox-gated acknowledgement modal
    Given the Paper Out Request modal is open
    When I select "Save as Electronic File"
    And I complete the required Name of Request and Approver fields
    And I click OK
    Then an acknowledgement modal opens with its checkbox unchecked
    And the acknowledgement modal's OK button stays disabled until the checkbox is checked

  @req-REQ-EC-12000-002 @ac-AC-EC-12000-003 @ts-TS-EC-12000-003 @risk-medium @suite-critical
  Scenario: Confirming the acknowledgement modal closes both modals and creates the Work Queue approval item
    Given the acknowledgement modal is open
    When I check the acknowledgement checkbox
    And I click the acknowledgement modal's OK button
    Then the acknowledgement modal closes
    And the Paper Out Request modal closes
    And a Work Queue item is created for approval

  @req-REQ-EC-12000-002 @ac-AC-EC-12000-004 @ts-TS-EC-12000-004 @risk-low @suite-regression
  Scenario: Cancelling the acknowledgement modal leaves the Paper Out Request modal open with no Work Queue item created
    Given the acknowledgement modal is open
    When I click Cancel on the acknowledgement modal
    Then only the acknowledgement modal closes
    And the Paper Out Request modal remains open
    And no Work Queue item is created

  @req-REQ-EC-12000-004 @ac-AC-EC-12000-007 @ts-TS-EC-12000-007 @risk-medium @suite-regression
  Scenario: UI Print to Paper at transaction level determines Media Type Paper
    Given a transaction eligible for Paper Out
    When I submit a transaction-level Paper Out via the UI with "Print to Paper" selected
    Then the Media Type is recorded as "Paper"

  @req-REQ-EC-12000-004 @ac-AC-EC-12000-008 @ts-TS-EC-12000-008 @risk-medium @suite-regression
  Scenario: UI Print to Paper at document level determines Media Type Paper
    Given a document eligible for Paper Out
    When I submit a document-level Paper Out via the UI with "Print to Paper" selected
    Then the Media Type is recorded as "Paper"

  @req-REQ-EC-12000-004 @ac-AC-EC-12000-009 @ts-TS-EC-12000-009 @risk-medium @suite-regression
  Scenario: UI Save as Electronic File at transaction level determines Media Type Electronic
    Given a transaction eligible for Paper Out
    When I submit a transaction-level Paper Out via the UI with "Save as Electronic File" selected, completing the acknowledgement flow
    Then the Media Type is recorded as "Electronic"

  @req-REQ-EC-12000-004 @ac-AC-EC-12000-010 @ts-TS-EC-12000-010 @risk-medium @suite-regression
  Scenario: UI Save as Electronic File at document level determines Media Type Electronic
    Given a document eligible for Paper Out
    When I submit a document-level Paper Out via the UI with "Save as Electronic File" selected, completing the acknowledgement flow
    Then the Media Type is recorded as "Electronic"

  @req-REQ-EC-12000-004 @ac-AC-EC-12000-011 @ts-TS-EC-12000-011 @risk-high @suite-regression @interface-hybrid
  Scenario: API mediaType=PrintToPaper at transaction level determines Media Type Paper
    Given eoRequestExport is available at the transaction level
    When I call eoRequestExport at the transaction level with mediaType "PrintToPaper"
    And I open the transaction's Submitted Paper Out audit trail entry
    Then the API call succeeds
    And the Media Type is recorded as "Paper" in the audit trail's Additional Information

  @req-REQ-EC-12000-004 @ac-AC-EC-12000-012 @ts-TS-EC-12000-012 @risk-high @suite-regression @interface-hybrid
  Scenario: API mediaType=PrintToPaper at document level determines Media Type Paper
    Given eoRequestExport is available at the document level
    When I call eoRequestExport at the document level with mediaType "PrintToPaper"
    And I open the document's Submitted Paper Out audit trail entry
    Then the API call succeeds
    And the Media Type is recorded as "Paper" in the audit trail's Additional Information

  @req-REQ-EC-12000-004 @ac-AC-EC-12000-013 @ts-TS-EC-12000-013 @risk-high @suite-regression @interface-hybrid
  Scenario: API mediaType=SaveAsElectronicFile at transaction level determines Media Type Electronic
    Given eoRequestExport is available at the transaction level
    When I call eoRequestExport at the transaction level with mediaType "SaveAsElectronicFile"
    And I open the transaction's Submitted Paper Out audit trail entry
    Then the API call succeeds
    And the Media Type is recorded as "Electronic" in the audit trail's Additional Information

  @req-REQ-EC-12000-004 @ac-AC-EC-12000-014 @ts-TS-EC-12000-014 @risk-high @suite-regression @interface-hybrid
  Scenario: API mediaType=SaveAsElectronicFile at document level determines Media Type Electronic
    Given eoRequestExport is available at the document level
    When I call eoRequestExport at the document level with mediaType "SaveAsElectronicFile"
    And I open the document's Submitted Paper Out audit trail entry
    Then the API call succeeds
    And the Media Type is recorded as "Electronic" in the audit trail's Additional Information

  @req-REQ-EC-12000-004 @ac-AC-EC-12000-015 @ts-TS-EC-12000-015 @risk-high @suite-regression @interface-hybrid
  Scenario: API call omitting mediaType entirely determines Media Type Electronic
    Given eoRequestExport is available at both transaction and document level
    When I call eoRequestExport without a mediaType element at transaction level
    And I call eoRequestExport without a mediaType element at document level
    And I open the Submitted Paper Out audit trail entry for both
    Then both API calls succeed
    And the Media Type is recorded as "Electronic" in both audit trail entries

  @req-REQ-EC-12000-005 @ac-AC-EC-12000-016 @ts-TS-EC-12000-016 @risk-medium @suite-regression
  Scenario: Media Type is recorded on the Submitted Paper Out event, not the Authorized one, and appears in the downloaded activity history report
    Given a Paper Out is submitted, at transaction or document level, after this change has shipped
    When I inspect the Submitted Paper Out event's Additional Information
    And I inspect the Authorized Paper Out event's Additional Information
    And I download the document activity history report and inspect it
    Then Media Type appears as Additional Information on the Submitted Paper Out event
    And Media Type is absent from the Authorized Paper Out event's Additional Information
    And Media Type is present in the downloaded document activity history report

  @req-REQ-EC-12000-005 @ac-AC-EC-12000-017 @ts-TS-EC-12000-017 @risk-low @suite-regression
  Scenario: Historical Paper Out records are not retroactively updated with Media Type
    Given a transaction or document had Paper Out/Export performed before this change was deployed
    When I inspect its Additional Information and audit trail after deployment
    Then the existing record is not retroactively updated with Media Type information

  @req-REQ-EC-12000-006 @ac-AC-EC-12000-018 @ts-TS-EC-12000-018 @risk-low @suite-regression
  Scenario: Verify Paper Out modal's last checkbox reads the updated verbiage
    Given the Verify Paper Out modal is displayed
    When I read the last checkbox's label
    Then the label reads "Verify the downloaded package has been successfully printed to paper or saved to a secure location"

  @req-REQ-EC-12000-007 @ac-AC-EC-12000-019 @ts-TS-EC-12000-019 @risk-low @suite-regression
  Scenario: Paper Out Request modal's right-side section borders are visually aligned
    Given the redesigned Paper Out Request modal, including the new Media Type section, is rendered
    When I observe the right side of the modal
    Then the section borders are visually aligned

  # Split out of TS-EC-12000-016 at Gate 2 v2 (CLR-TP-EC-12000-002): the cover
  # page is a printed/downloaded package artifact, not an audit-trail or
  # history-report surface, and confirming it needs a human to open the real
  # downloaded file - not a locator this framework can validate.
  @req-REQ-EC-12000-005 @ac-AC-EC-12000-016 @ts-TS-EC-12000-020 @risk-medium @suite-regression
  Scenario: Media Type is visible on the Paper Out package cover page
    Given a Paper Out batch is Authorized and its package is downloadable
    When I choose Print for the batch in the Work Queue
    And I download the Paper Out package from the Verify Paper Out modal
    Then Media Type is visible on the downloaded package's cover page
