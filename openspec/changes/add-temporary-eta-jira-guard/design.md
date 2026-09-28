## Context

See `proposal.md` for motivation. Jira reads currently use Atlassian MCP, while Jira writes may use
direct MCP tools or REST fallbacks. A policy check implemented only in agent prose is not
machine-enforced because an agent retaining a direct write tool can accidentally bypass a helper.

Workflow instances and governed artifacts also need protection: blocking only Jira writes would
still allow an EC story to create requirements, plans, features, and RTM changes in this repository.

## Goals / Non-Goals

**Goals:**

- Fail closed for non-ETA workflow starts and restricted Jira writes.
- Preserve cross-project read access.
- Place the temporary policy under version control with no environment-variable bypass or automatic
  expiry.
- Prevent governed agents from retaining an accidental direct route around the policy.
- Make later removal a small reviewed change.

**Non-Goals:**

- Restrict Jira reads.
- Change application-under-test behavior or existing ETA/EC artifacts.
- Permit one-off non-ETA bypasses while this policy is active.
- Automatically migrate or delete existing EC workflow evidence.
- Replace existing human approval requirements for bug reporting or attachment handling.

## Decisions

### 1. Use a version-controlled allowlist policy

A committed configuration file will declare the active policy mode, allowed project keys, and
restricted operation names. The initial and only allowed key is `ETA`.

There will be no environment-variable override and no expiry timestamp. Those alternatives were
rejected because a local configuration mistake or clock transition could silently re-enable
non-ETA writes.

### 2. Centralize project-key validation

A typed utility will normalize and validate Jira keys, derive the project key, and expose guards for
workflow starts and restricted writes. Missing, malformed, lowercase, or unresolvable targets fail
closed with a policy-specific error.

Callers will pass the concrete target issue key whenever one exists. Bug creation will validate the
destination project key as well as the originating story.

### 3. Enforce workflow scope structurally and operationally

The orchestrator will call the guard before initializing or resetting a workflow. Semantic
validation will also reject newly created or revised workflow states and governed story artifacts
whose Jira key violates the active policy.

The semantic check is defense in depth rather than the first line of protection: the operational
guard should prevent invalid files from being written at all.

### 4. Remove direct Jira write tools from governed agents

Governed agents will retain Atlassian MCP read tools but will not receive unrestricted tools for
comment writes, attachment writes, or issue creation while the temporary policy is active.
Framework-owned writes will instead use guarded repository helpers.

This is required for genuine enforcement. Keeping direct MCP write grants and merely instructing
agents to call a guard first was rejected because the guard could still be skipped.

### 5. Use guarded REST helpers for restricted writes

Repository helpers will perform ETA-approved comment creation/editing, attachment upload, and bug
creation through Jira REST after running the central guard. They will use the existing typed
environment loader, redact secrets, validate responses, and expose test seams so policy tests make
no external call.

If REST credentials are unavailable, the write is blocked explicitly. Read-only MCP behavior is
unaffected.

### 6. Validate every known restricted path

Targeted tests will prove that ETA operations reach a stubbed transport and that EC, other-project,
malformed, and unknown targets never invoke it. A repository semantic/static check will inventory
agent tool grants and framework write helpers so a new unguarded path fails validation.

### 7. Preserve existing side-effect approvals

The ETA allowlist is an additional prerequisite, not authorization by itself. Bug creation still
requires reportable evidence and explicit human confirmation. Attachment handling still follows
redaction and trace-withholding rules.

## Risks / Trade-offs

- **Jira REST credentials may not be configured because reads use OAuth MCP** → Fail explicitly and
  document the required write configuration; never fall back to an unguarded MCP write.
- **Removing direct MCP creation tools changes the bug analyzer path** → Update its procedure and
  test the guarded REST create/read-back sequence before enabling it.
- **Historical EC workflow files remain in the repository** → Apply policy checks only to new or
  revised artifacts so existing evidence continues to validate unchanged.
- **Static scanning cannot prove behavior of arbitrary future tools** → Combine tool-grant
  restrictions, central helpers, and tests; treat new Jira write integration as a governed policy
  update.
- **Temporary policy may be forgotten** → Make the active mode visible in preflight/workflow status
  output and require a reviewed code/config change to remove it.

## Migration Plan

1. Add the policy configuration and typed guard with isolated tests.
2. Add workflow-start and semantic enforcement without rewriting historical artifacts.
3. Inventory Jira write-capable agents and replace direct write grants with guarded helpers.
4. Migrate bug creation, comments, comment edits, and attachment uploads to the guarded transport.
5. Update instructions and status/preflight output to make the active restriction visible.
6. Run targeted tests, typecheck, artifact validation, and strict OpenSpec validation.
7. To remove the temporary restriction later, submit a reviewed change that updates or removes the
   policy and adjusts the matching tests and tool grants; do not bypass it at runtime.
