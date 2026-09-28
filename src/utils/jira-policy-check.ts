/**
 * Usage:
 *   node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON src/utils/jira-policy-check.ts <operation> <target>
 *
 * Performs a fail-closed ETA policy check before an agent starts a workflow or prepares a
 * restricted Jira write. Writes reports/validation/jira-policy-check.json.
 */
import fs from 'node:fs';
import path from 'node:path';

import { toAbsolute } from './artifact-io.ts';
import {
  assertJiraIssueAllowed,
  assertJiraProjectAllowed,
  JiraPolicyError,
  jiraRestrictedOperationSchema,
  readJiraWritePolicy,
} from './jira-policy.ts';

function writeReport(report: Record<string, unknown>): void {
  const output = toAbsolute('reports/validation/jira-policy-check.json');
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
}

function main(): void {
  const operation = jiraRestrictedOperationSchema.parse(process.argv[2]);
  const target = process.argv[3];
  const policy = readJiraWritePolicy();
  const validatedTarget =
    operation === 'BUG_CREATE'
      ? assertJiraProjectAllowed(target, operation, policy)
      : assertJiraIssueAllowed(target, operation, policy);
  const report = {
    generatedAt: new Date().toISOString(),
    status: 'ALLOWED',
    operation,
    target: validatedTarget,
    policyVersion: policy.schemaVersion,
    mode: policy.mode,
  };
  writeReport(report);
  console.log(`${operation} is allowed for ${validatedTarget} by Jira policy ${policy.schemaVersion}.`);
}

try {
  main();
} catch (error) {
  const policy = error instanceof JiraPolicyError ? error : null;
  const report = {
    generatedAt: new Date().toISOString(),
    status: 'BLOCKED',
    code: policy?.code ?? 'JIRA_POLICY_CHECK_FAILED',
    operation: policy?.operation ?? process.argv[2] ?? null,
    target: policy?.target ?? null,
    message: error instanceof Error ? error.message : String(error),
  };
  writeReport(report);
  console.error(`${report.code}: ${report.message}`);
  process.exitCode = 1;
}
