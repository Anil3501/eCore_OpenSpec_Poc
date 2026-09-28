/**
 * Usage:
 *   node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON src/utils/jira-write.ts <request.json>
 *
 * Executes one ETA-guarded Jira write request. Request files contain no credentials and must live
 * inside the repository. The result is written under reports/jira/write-results/.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';

import { PROJECT_ROOT, readJson, toAbsolute, toRelative } from './artifact-io.ts';
import { env } from './env.ts';
import {
  createJiraBug,
  createJiraComment,
  editJiraComment,
  uploadJiraAttachments,
} from './jira-write-client.ts';
import {
  assertJiraIssueAllowed,
  assertJiraProjectAllowed,
  JiraPolicyError,
} from './jira-policy.ts';

const fixVersionSchema = z
  .object({
    id: z.string().min(1).optional(),
    name: z.string().min(1).optional(),
  })
  .strict()
  .refine((version) => version.id !== undefined || version.name !== undefined, {
    message: 'A fix version requires id or name.',
  });

const requestSchema = z.discriminatedUnion('operation', [
  z
    .object({
      operation: z.literal('COMMENT_CREATE'),
      issueKey: z.string(),
      body: z.string().min(1),
    })
    .strict(),
  z
    .object({
      operation: z.literal('COMMENT_EDIT'),
      issueKey: z.string(),
      commentId: z.string().min(1),
      body: z.string().min(1),
    })
    .strict(),
  z
    .object({
      operation: z.literal('ATTACHMENT_UPLOAD'),
      issueKey: z.string(),
      attachmentPaths: z.array(z.string().min(1)).min(1),
    })
    .strict(),
  z
    .object({
      operation: z.literal('BUG_CREATE'),
      summary: z.string().min(1),
      description: z.string().min(1),
      fixVersions: z.array(fixVersionSchema),
      humanConfirmation: z.string().min(1),
      attachmentPaths: z.array(z.string().min(1)).optional(),
    })
    .strict(),
]);

function requestPathFromArgument(value: string | undefined): string {
  if (!value) throw new Error('Pass the path to one Jira write request JSON file.');
  const absolute = toAbsolute(value);
  const relative = path.relative(PROJECT_ROOT, absolute);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error('Jira write request path must resolve inside the repository.');
  }
  if (!fs.existsSync(absolute) || !fs.statSync(absolute).isFile()) {
    throw new Error(`Jira write request does not exist: ${value}`);
  }
  return toRelative(absolute);
}

function writeResult(result: Record<string, unknown>): string {
  const outputDir = toAbsolute('reports/jira/write-results');
  fs.mkdirSync(outputDir, { recursive: true });
  const output = path.join(
    outputDir,
    `jira-write-${new Date().toISOString().replace(/[:.]/g, '-')}-${crypto.randomUUID()}.json`,
  );
  fs.writeFileSync(output, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
  return toRelative(output);
}

async function main(): Promise<void> {
  const requestPath = requestPathFromArgument(process.argv[2]);
  const parsed = requestSchema.safeParse(readJson(requestPath));
  if (!parsed.success) {
    throw new Error(
      `${requestPath} is not a valid Jira write request: ${parsed.error.issues
        .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
        .join('; ')}`,
    );
  }

  const request = parsed.data;
  let result: Record<string, unknown>;

  if (request.operation === 'COMMENT_CREATE') {
    assertJiraIssueAllowed(request.issueKey, 'COMMENT_CREATE');
    const jira = env.requireJiraConfig();
    result = {
      operation: request.operation,
      issueKey: request.issueKey,
      ...(await createJiraComment(request.issueKey, request.body, jira)),
    };
  } else if (request.operation === 'COMMENT_EDIT') {
    assertJiraIssueAllowed(request.issueKey, 'COMMENT_EDIT');
    const jira = env.requireJiraConfig();
    result = {
      operation: request.operation,
      issueKey: request.issueKey,
      ...(await editJiraComment(request.issueKey, request.commentId, request.body, jira)),
    };
  } else if (request.operation === 'ATTACHMENT_UPLOAD') {
    assertJiraIssueAllowed(request.issueKey, 'ATTACHMENT_UPLOAD');
    const jira = env.requireJiraConfig();
    result = {
      operation: request.operation,
      issueKey: request.issueKey,
      ...(await uploadJiraAttachments(request.issueKey, request.attachmentPaths, jira)),
    };
  } else {
    const bug = env.requireJiraBugConfig();
    assertJiraProjectAllowed(bug.projectKey, 'BUG_CREATE');
    const jira = env.requireJiraConfig();
    const created = await createJiraBug(
      {
        projectKey: bug.projectKey,
        issueType: bug.issueType,
        summary: request.summary,
        description: request.description,
        assigneeAccountId: bug.assigneeAccountId,
        fixVersions: request.fixVersions,
        humanConfirmation: request.humanConfirmation,
      },
      jira,
    );
    const attachments =
      request.attachmentPaths && request.attachmentPaths.length > 0
        ? await uploadJiraAttachments(created.issueKey, request.attachmentPaths, jira)
        : { uploaded: [] };
    result = {
      operation: request.operation,
      issueKey: created.issueKey,
      attachmentsUploaded: attachments.uploaded,
      createdVia: 'JIRA_REST',
    };
  }

  const output = writeResult({
    generatedAt: new Date().toISOString(),
    requestPath,
    status: 'SUCCESS',
    ...result,
  });
  console.log(`Jira write completed. Result: ${output}`);
}

main().catch((error: unknown) => {
  const policy = error instanceof JiraPolicyError ? error : null;
  const failure = {
    generatedAt: new Date().toISOString(),
    status: 'FAILED',
    code: policy?.code ?? 'JIRA_WRITE_FAILED',
    operation: policy?.operation ?? null,
    target: policy?.target ?? null,
    message: error instanceof Error ? error.message : String(error),
  };
  const output = writeResult(failure);
  console.error(`${failure.code}: ${failure.message}`);
  console.error(`Failure report: ${output}`);
  process.exitCode = 1;
});
