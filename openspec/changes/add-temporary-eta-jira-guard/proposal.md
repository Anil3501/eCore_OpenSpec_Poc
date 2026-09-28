## Why

The framework needs a temporary, machine-enforced safety boundary while ETA workflow outputs are
being reviewed so an agent cannot accidentally start governed work for, comment on, attach files
to, or file a bug in EC or another Jira project.

## What Changes

- Add a version-controlled temporary Jira policy whose only allowed project key is `ETA`.
- **BREAKING**: Reject workflow starts for non-ETA Jira story keys.
- **BREAKING**: Reject Jira comment creation, comment editing, attachment upload, and bug creation
  when the target or destination project is not ETA.
- Keep Jira retrieval, search, and other read-only analysis available across projects.
- Route all framework-owned restricted writes through a centralized fail-closed policy check before
  any Atlassian MCP or Jira REST side effect.
- Remove or avoid unrestricted direct write paths in governed agents so the repository guard cannot
  be bypassed accidentally.
- Make the temporary restriction reversible through a later reviewed configuration/code change;
  it will not expire automatically.

## Capabilities

### New Capabilities

- `jira-integration/temporary-eta-guard`: Defines the temporary ETA-only workflow and Jira write
  boundary, its fail-closed behavior, and its controlled removal.

### Modified Capabilities

None.

## Impact

- Workflow-start validation and the SDD orchestrator.
- Jira-capable agents, skills, prompts, MCP tool grants, and REST helpers.
- Bug-report creation and attachment upload paths.
- New version-controlled policy configuration, guard utility, tests, and validation rules.
- Cross-project Jira reads remain unchanged, and this planning change performs no Jira write.
