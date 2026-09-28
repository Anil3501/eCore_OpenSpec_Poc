import { z } from 'zod';

import { readJson } from './artifact-io.ts';

export const jiraRestrictedOperationSchema = z.enum([
  'WORKFLOW_START',
  'COMMENT_CREATE',
  'COMMENT_EDIT',
  'ATTACHMENT_UPLOAD',
  'BUG_CREATE',
]);

const projectKeySchema = z.string().regex(/^[A-Z][A-Z0-9]*$/);
const issueKeySchema = z.string().regex(/^[A-Z][A-Z0-9]*-[1-9][0-9]*$/);

export const jiraWritePolicySchema = z
  .object({
    schemaVersion: z.literal('1.0'),
    mode: z.literal('TEMPORARY_ALLOWLIST'),
    activatedAt: z.string().datetime(),
    allowedProjectKeys: z.array(projectKeySchema).min(1),
    immutableIssueFields: z.array(z.enum(['description'])).min(1),
    restrictedOperations: z.array(jiraRestrictedOperationSchema).min(1),
  })
  .strict()
  .superRefine((policy, ctx) => {
    if (new Set(policy.allowedProjectKeys).size !== policy.allowedProjectKeys.length) {
      ctx.addIssue({
        code: 'custom',
        path: ['allowedProjectKeys'],
        message: 'allowedProjectKeys must not contain duplicates.',
      });
    }
    if (new Set(policy.restrictedOperations).size !== policy.restrictedOperations.length) {
      ctx.addIssue({
        code: 'custom',
        path: ['restrictedOperations'],
        message: 'restrictedOperations must not contain duplicates.',
      });
    }
  });

export type JiraRestrictedOperation = z.infer<typeof jiraRestrictedOperationSchema>;
export type JiraWritePolicy = z.infer<typeof jiraWritePolicySchema>;

const POLICY_PATH = 'config/jira-write-policy.json';
export const PROHIBITED_DIRECT_JIRA_WRITE_GRANTS = [
  'atlassian/createJiraIssue',
  'atlassian/addCommentToJiraIssue',
  'atlassian/editJiraIssue',
] as const;

export class JiraPolicyError extends Error {
  readonly code: string;
  readonly operation: JiraRestrictedOperation;
  readonly target: string;

  constructor(code: string, operation: JiraRestrictedOperation, target: string, message: string) {
    super(message);
    this.name = 'JiraPolicyError';
    this.code = code;
    this.operation = operation;
    this.target = target;
  }
}

export class JiraImmutableFieldError extends Error {
  readonly code = 'JIRA_POLICY_IMMUTABLE_FIELD';
  readonly field: string;

  constructor(field: string) {
    super(`Jira policy forbids changing the "${field}" field on an existing issue.`);
    this.name = 'JiraImmutableFieldError';
    this.field = field;
  }
}

export function parseJiraWritePolicy(raw: unknown): JiraWritePolicy {
  const parsed = jiraWritePolicySchema.safeParse(raw);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('; ');
    throw new Error(`${POLICY_PATH} is invalid: ${details}`);
  }
  return parsed.data;
}

export function readJiraWritePolicy(): JiraWritePolicy {
  return parseJiraWritePolicy(readJson(POLICY_PATH));
}

export function parseJiraIssueKey(value: unknown): { issueKey: string; projectKey: string } {
  const parsed = issueKeySchema.safeParse(value);
  if (!parsed.success) {
    throw new Error('Jira issue key must match uppercase PROJECT-123 form.');
  }
  const issueKey = parsed.data;
  return { issueKey, projectKey: issueKey.slice(0, issueKey.indexOf('-')) };
}

export function parseJiraProjectKey(value: unknown): string {
  const parsed = projectKeySchema.safeParse(value);
  if (!parsed.success) {
    throw new Error('Jira project key must contain uppercase letters or digits and start with a letter.');
  }
  return parsed.data;
}

function ensureOperationIsRestricted(
  policy: JiraWritePolicy,
  operation: JiraRestrictedOperation,
  target: string,
): void {
  if (!policy.restrictedOperations.includes(operation)) {
    throw new JiraPolicyError(
      'JIRA_POLICY_UNKNOWN_OPERATION',
      operation,
      target,
      `Jira policy blocks ${operation} because the operation is not declared in the version-controlled policy.`,
    );
  }
}

export function assertJiraProjectAllowed(
  projectKeyValue: unknown,
  operation: JiraRestrictedOperation,
  policy: JiraWritePolicy = readJiraWritePolicy(),
): string {
  let projectKey: string;
  try {
    projectKey = parseJiraProjectKey(projectKeyValue);
  } catch {
    throw new JiraPolicyError(
      'JIRA_POLICY_INVALID_TARGET',
      operation,
      '<invalid-project-key>',
      `Jira policy blocked ${operation}: the destination project key is missing or malformed.`,
    );
  }
  ensureOperationIsRestricted(policy, operation, projectKey);
  if (!policy.allowedProjectKeys.includes(projectKey)) {
    throw new JiraPolicyError(
      'JIRA_POLICY_PROJECT_BLOCKED',
      operation,
      projectKey,
      `Jira policy blocked ${operation} for project ${projectKey}. Allowed projects: ${policy.allowedProjectKeys.join(', ')}.`,
    );
  }
  return projectKey;
}

export function assertJiraIssueAllowed(
  issueKeyValue: unknown,
  operation: JiraRestrictedOperation,
  policy: JiraWritePolicy = readJiraWritePolicy(),
): string {
  let parsed: { issueKey: string; projectKey: string };
  try {
    parsed = parseJiraIssueKey(issueKeyValue);
  } catch {
    throw new JiraPolicyError(
      'JIRA_POLICY_INVALID_TARGET',
      operation,
      '<invalid-issue-key>',
      `Jira policy blocked ${operation}: the target issue key is missing or malformed.`,
    );
  }
  assertJiraProjectAllowed(parsed.projectKey, operation, policy);
  return parsed.issueKey;
}

export function isAtOrAfterPolicyActivation(
  timestamp: string,
  policy: JiraWritePolicy = readJiraWritePolicy(),
): boolean {
  const value = Date.parse(timestamp);
  const activation = Date.parse(policy.activatedAt);
  return Number.isFinite(value) && value >= activation;
}

export function describeJiraWritePolicy(policy: JiraWritePolicy = readJiraWritePolicy()): string {
  return (
    `${policy.mode}: ${policy.allowedProjectKeys.join(', ')} only; active since ${policy.activatedAt}; ` +
    `immutable existing-issue fields: ${policy.immutableIssueFields.join(', ')}`
  );
}

export function findProhibitedJiraWriteGrants(content: string): string[] {
  return PROHIBITED_DIRECT_JIRA_WRITE_GRANTS.filter((grant) => content.includes(grant));
}

export function isJiraAmbiguityWritebackEligible(
  issueKey: unknown,
  workflowCreatedAt: string,
  issueCreatedAt: string,
  policy: JiraWritePolicy = readJiraWritePolicy(),
): boolean {
  assertJiraIssueAllowed(issueKey, 'WORKFLOW_START', policy);
  return (
    isAtOrAfterPolicyActivation(workflowCreatedAt, policy) &&
    isAtOrAfterPolicyActivation(issueCreatedAt, policy)
  );
}

export function assertExistingJiraIssueFieldMutable(
  field: string,
  policy: JiraWritePolicy = readJiraWritePolicy(),
): void {
  if (policy.immutableIssueFields.includes(field as 'description')) {
    throw new JiraImmutableFieldError(field);
  }
}
