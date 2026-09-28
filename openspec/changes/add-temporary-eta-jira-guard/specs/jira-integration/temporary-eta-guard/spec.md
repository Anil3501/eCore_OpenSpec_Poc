## Purpose

Provides a temporary, fail-closed ETA project boundary for governed workflow starts and Jira side
effects while still allowing cross-project Jira information to be retrieved for analysis.

## ADDED Requirements

### Requirement: Governed workflows accept ETA stories only
The framework SHALL start or resume a governed Jira-to-automation workflow only when its Jira story
key belongs to the ETA project.

#### Scenario: ETA workflow is requested
- **WHEN** a workflow request supplies a valid issue key matching `ETA-<number>`
- **THEN** the framework may continue to its normal prerequisite and approval checks

#### Scenario: EC workflow is requested
- **WHEN** a workflow request supplies an issue key belonging to the EC project
- **THEN** the framework blocks the workflow before creating or updating governed story artifacts

#### Scenario: Other project workflow is requested
- **WHEN** a workflow request supplies a Jira key from any project other than ETA
- **THEN** the framework blocks the workflow and identifies the temporary ETA-only policy

#### Scenario: Workflow key cannot be validated
- **WHEN** a workflow request omits the Jira key or supplies a malformed value
- **THEN** the framework fails closed instead of assuming the request belongs to ETA

### Requirement: Restricted Jira writes target ETA only
The framework SHALL permit comment creation, comment editing, attachment upload, and Jira bug
creation only when the target issue or destination project belongs to ETA.

#### Scenario: Comment is written to ETA
- **WHEN** an authorized operation targets a valid `ETA-<number>` issue
- **THEN** the framework may perform the comment operation after its existing human and workflow checks

#### Scenario: Comment targets non-ETA
- **WHEN** a comment creation or edit targets EC or another non-ETA project
- **THEN** the framework rejects the operation before calling Jira MCP or Jira REST

#### Scenario: Attachment is uploaded to ETA
- **WHEN** an authorized attachment operation targets a valid `ETA-<number>` issue
- **THEN** the framework may upload the validated attachment

#### Scenario: Attachment targets non-ETA
- **WHEN** an attachment operation targets EC or another non-ETA project
- **THEN** the framework rejects the operation before opening a network connection

#### Scenario: Bug is created in ETA
- **WHEN** a reportable defect has passed its existing human confirmation and the destination project is ETA
- **THEN** the framework may create the bug and continue its governed read-back verification

#### Scenario: Bug destination is non-ETA
- **WHEN** the configured or requested bug destination project is not ETA
- **THEN** the framework blocks bug creation before the external side effect

### Requirement: Cross-project Jira reads remain available
The framework SHALL continue to allow Jira retrieval, search, link inspection, metadata lookup, and
read-back operations across ETA, EC, and other projects.

#### Scenario: Non-ETA issue is inspected
- **WHEN** an agent reads a non-ETA issue without requesting a restricted write or workflow start
- **THEN** the framework permits the read operation

#### Scenario: ETA workflow reads linked external evidence
- **WHEN** an ETA workflow needs to inspect an issue linked from another Jira project
- **THEN** the framework permits the read while retaining the non-ETA write restriction

### Requirement: Restricted operations are validated before side effects
The framework SHALL determine the target issue key or destination project and validate it against
the temporary ETA allowlist before invoking any restricted MCP tool or REST endpoint.

#### Scenario: Target ownership is unknown
- **WHEN** a comment edit or attachment operation cannot prove which Jira issue owns the target
- **THEN** the framework blocks the operation rather than inferring ETA ownership

#### Scenario: Direct write path lacks policy validation
- **WHEN** a governed agent or helper exposes a restricted Jira write without the ETA policy check
- **THEN** repository validation fails and identifies the unguarded write path

#### Scenario: Restricted operation is rejected
- **WHEN** the ETA guard blocks an operation
- **THEN** the framework reports a policy-specific error and does not create success-shaped evidence

### Requirement: The temporary guard changes only through version control
The framework SHALL NOT automatically expire or accept a runtime environment override that disables
the ETA-only restriction.

#### Scenario: Time passes after guard activation
- **WHEN** the configured review period has elapsed without a reviewed repository change
- **THEN** the ETA-only restriction remains active

#### Scenario: User is ready to remove the restriction
- **WHEN** the user explicitly requests removal or expansion of the policy
- **THEN** the framework changes the version-controlled policy and associated validation through a reviewed implementation change
