## 1. Inventory Jira and Workflow Entry Points

- [x] 1.1 Inventory every governed workflow-start path and every agent, skill, prompt, MCP tool grant, script, and REST helper capable of comment creation/editing, attachment upload, or Jira issue creation, and verify the inventory names all current write-capable paths.
- [x] 1.2 Read the applicable framework-tooling and governed-artifact instructions before editing utilities, workflow state, schemas, or agents, and verify the planned files follow their path-specific rules.

## 2. Add the Temporary Policy and Guard

- [x] 2.1 Add a version-controlled Jira policy configuration allowing only `ETA` for workflow starts and restricted writes, with no environment override or expiry, and verify its schema or typed parser rejects missing and unknown fields.
- [x] 2.2 Implement typed issue-key and project-key parsing plus fail-closed guards for workflow start, comment create/edit, attachment upload, and bug creation, and verify unit tests cover ETA, EC, another project, malformed, missing, lowercase, and unknown-owner inputs.
- [x] 2.3 Add a policy-specific error type that reports operation and target without Jira credentials, comment bodies, or attachment contents, and verify blocked calls produce no success-shaped result.

## 3. Enforce ETA-Only Workflow Scope

- [x] 3.1 Call the workflow-start guard before initializing or resetting a Jira workflow, and verify an EC/non-ETA request creates or modifies no governed artifact.
- [x] 3.2 Add backward-compatible semantic validation for newly created or revised workflow, requirement, test-plan, and traceability artifacts under the active policy, and verify historical EC evidence continues to validate unchanged.
- [x] 3.3 Surface the active ETA-only policy in preflight and workflow-status output, and verify operators can see the restriction before starting a workflow.

## 4. Guard Jira Writes

- [x] 4.1 Remove restricted direct Jira MCP write grants from governed agents while retaining required read tools, and verify repository validation detects any remaining prohibited grant.
- [x] 4.2 Implement guarded Jira REST helpers for ETA comment creation and editing, and verify transport stubs are invoked only for valid ETA issue keys.
- [x] 4.3 Apply the existing or guarded attachment transport behind the ETA policy check, and verify EC/non-ETA targets open no network connection and copy/upload no attachment.
- [x] 4.4 Implement guarded ETA bug creation while preserving human confirmation, fix-version provenance, assignee requirements, deduplication, attachment controls, and read-back verification, and verify a non-ETA destination blocks before issue creation.
- [x] 4.5 Update bug-analyzer, orchestrator, Jira requirement-analysis, skills, prompts, and project instructions to use the guarded paths and state that non-ETA writes and workflows are unavailable while reads remain allowed.

## 5. Prevent Guard Bypass

- [x] 5.1 Add a semantic or static validation rule for restricted Jira tool grants and framework-owned write paths that bypass the central guard, and verify an intentionally unguarded fixture fails with a precise rule ID and location.
- [x] 5.2 Add tests proving rejected EC, other-project, malformed, and unresolved-target operations invoke neither MCP nor REST and persist no success evidence.
- [x] 5.3 Add tests proving valid ETA operations still require all existing workflow and human approvals rather than treating project membership as authorization.
- [x] 5.4 Make existing Jira issue descriptions immutable across every workflow phase, and verify the ETA policy rejects description-field mutation even for an allowed project.

## 6. Validate and Document Reversal

- [x] 6.1 Update README and relevant framework documentation with the active temporary policy, affected operations, preserved read access, and reviewed removal procedure.
- [x] 6.2 Run `npm run preflight`, `npm run validate:artifacts`, targeted semantic/policy tests, and `npm run typecheck`, and resolve only failures introduced by this change.
- [x] 6.3 Run `npx openspec validate add-temporary-eta-jira-guard --strict` and verify the change remains valid.
- [x] 6.4 Review `git status` and verify no Jira payload, credential, session, attachment, existing approved story artifact, or generated `.features-gen/` file was added or modified.
