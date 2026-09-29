/**
 * Usage:
 *   node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON src/utils/jira-approved-artifact-sync.ts <workflowId> <SYNC|REOPEN> <ACCEPTANCE_CRITERIA|TEST_PLAN|AUTOMATION_DESIGN>
 *
 * Mirrors approved Gate 1 and Gate 2 artifacts for one eligible ETA workflow into versioned Jira
 * attachments and one managed comment. It writes a result/next-state patch under reports/ only;
 * the orchestrator remains the sole owner of workflow state. Jira failures are recorded and do
 * not block the governed approval flow.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import {
  jiraApprovedArtifactSyncSchema,
  workflowStateSchema,
} from '../models/workflow-state.model.ts';
import { exists, readJson, toAbsolute } from './artifact-io.ts';
import { env } from './env.ts';
import { renderApprovedArtifactComment } from './jira-approved-artifact-format.ts';
import {
  applyApprovedArtifactGateReopen,
  assertApprovedArtifactCandidateSourceIsCurrent,
  assertApprovedArtifactPath,
  assertTestPlanSourceIsCurrent,
  loadApprovedArtifactCandidate,
  planApprovedArtifactSync,
  recordApprovedArtifactUpload,
  shouldSynchronizeReopenedArtifactComment,
  type ApprovedArtifactGate,
  type ApprovedArtifactType,
  type JiraApprovedArtifactSync,
} from './jira-approved-artifact-sync-core.ts';
import {
  createJiraComment,
  editJiraComment,
  uploadJiraAttachmentContent,
} from './jira-write-client.ts';
import { assertJiraIssueAllowed, JiraPolicyError } from './jira-policy.ts';

type SyncAction = 'SYNC' | 'REOPEN';

function workflowPath(workflowId: string): string {
  if (!/^WF-[A-Z0-9-]+-R\d+\.\d+(\.\d+)?$/.test(workflowId)) {
    throw new Error('Workflow id must match WF-PROJECT-123-R1.0.');
  }
  const candidate = `workflow/instances/${workflowId}.json`;
  if (!exists(candidate)) throw new Error(`Workflow state not found: ${candidate}`);
  return candidate;
}

function parseAction(value: string | undefined): SyncAction {
  if (value === 'SYNC' || value === 'REOPEN') return value;
  throw new Error('Action must be SYNC or REOPEN.');
}

function parseGate(value: string | undefined): ApprovedArtifactGate {
  if (
    value === 'ACCEPTANCE_CRITERIA' ||
    value === 'TEST_PLAN' ||
    value === 'AUTOMATION_DESIGN'
  ) {
    return value;
  }
  throw new Error('Gate must be ACCEPTANCE_CRITERIA, TEST_PLAN, or AUTOMATION_DESIGN.');
}

function reportPath(workflowId: string): string {
  return `reports/jira/approved-artifact-sync/${workflowId}.json`;
}

function writeReport(workflowId: string, report: Record<string, unknown>): void {
  const output = toAbsolute(reportPath(workflowId));
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
}

function commentHash(body: string): string {
  return crypto.createHash('sha256').update(body, 'utf8').digest('hex');
}

async function synchronizeComment(
  issueKey: string,
  sync: JiraApprovedArtifactSync,
  body: string,
): Promise<{ commentId: string }> {
  const jira = env.requireJiraConfig();
  return sync.managedCommentId === null
    ? createJiraComment(issueKey, body, jira)
    : editJiraComment(issueKey, sync.managedCommentId, body, jira);
}

async function main(): Promise<void> {
  const workflowId = process.argv[2] ?? '';
  const action = parseAction(process.argv[3]);
  const gate = parseGate(process.argv[4]);
  const state = workflowStateSchema.parse(readJson(workflowPath(workflowId)));
  const attemptedAt = new Date().toISOString();
  const configuredSync = state.jiraApprovedArtifactSync;

  if (!configuredSync || !configuredSync.eligible) {
    writeReport(workflowId, {
      generatedAt: attemptedAt,
      workflowId,
      jiraStoryId: state.jiraStoryId,
      status: 'NOT_REQUIRED',
      reason: configuredSync?.eligibilityReason ?? 'HISTORICAL_WORKFLOW_WITHOUT_SYNC_STATE',
      statePatch: configuredSync ?? null,
    });
    console.log(`Approved artifact synchronization is not required. Report: ${reportPath(workflowId)}`);
    return;
  }

  let nextSync = jiraApprovedArtifactSyncSchema.parse(configuredSync);
  let operation = 'UNCHANGED';

  try {
    assertJiraIssueAllowed(
      state.jiraStoryId,
      action === 'SYNC' ? 'ATTACHMENT_UPLOAD' : nextSync.managedCommentId ? 'COMMENT_EDIT' : 'COMMENT_CREATE',
    );

    if (action === 'REOPEN') {
      const reopened = applyApprovedArtifactGateReopen(nextSync, gate);
      if (!shouldSynchronizeReopenedArtifactComment(nextSync, reopened, gate)) {
        writeReport(workflowId, {
          generatedAt: attemptedAt,
          workflowId,
          jiraStoryId: state.jiraStoryId,
          status: 'UNCHANGED',
          action,
          gate,
          statePatch: nextSync,
        });
        console.log(`No approved artifact lifecycle changed. Report: ${reportPath(workflowId)}`);
        return;
      }
      nextSync = reopened;
      operation = nextSync.managedCommentId === null ? 'COMMENT_CREATE' : 'COMMENT_EDIT';
    } else {
      if (gate === 'AUTOMATION_DESIGN') {
        writeReport(workflowId, {
          generatedAt: attemptedAt,
          workflowId,
          jiraStoryId: state.jiraStoryId,
          status: 'UNCHANGED',
          action,
          gate,
          reason: 'GATE_3_DOES_NOT_UPLOAD_AC_OR_TEST_PLAN',
          statePatch: nextSync,
        });
        console.log(`Gate 3 does not synchronize AC or test-plan attachments. Report: ${reportPath(workflowId)}`);
        return;
      }
      const candidate = loadApprovedArtifactCandidate(state, gate as ApprovedArtifactType);
      assertApprovedArtifactPath(candidate.sourceArtifactPath);
      assertApprovedArtifactCandidateSourceIsCurrent(nextSync, candidate);
      const plan = planApprovedArtifactSync(nextSync, candidate);
      let attachment: { id: string; filename: string } | null = null;
      if (plan.needsUpload) {
        const jira = env.requireJiraConfig();
        attachment = await uploadJiraAttachmentContent(
          state.jiraStoryId,
          candidate.fileName,
          candidate.content,
          jira,
        );
        operation = 'ATTACHMENT_UPLOAD';
      }
      nextSync = recordApprovedArtifactUpload(plan, attachment, attemptedAt);
      if (gate === 'TEST_PLAN') assertTestPlanSourceIsCurrent(nextSync);
    }

    const body = renderApprovedArtifactComment(state, nextSync.artifacts);
    const contentHash = commentHash(body);
    const commentAlreadyCurrent =
      nextSync.managedCommentId !== null &&
      configuredSync.status === 'SYNCED' &&
      configuredSync.contentHash === contentHash;
    if (!commentAlreadyCurrent) {
      const creatingComment = nextSync.managedCommentId === null;
      const result = await synchronizeComment(state.jiraStoryId, nextSync, body);
      nextSync = { ...nextSync, managedCommentId: result.commentId };
      operation =
        operation === 'ATTACHMENT_UPLOAD'
          ? 'ATTACHMENT_UPLOAD_AND_COMMENT'
          : creatingComment
            ? 'COMMENT_CREATE'
            : 'COMMENT_EDIT';
    }
    nextSync = jiraApprovedArtifactSyncSchema.parse({
      ...nextSync,
      contentHash,
      status: 'SYNCED',
      lastAttemptAt: attemptedAt,
      lastSyncedAt: attemptedAt,
      lastErrorCode: null,
    });
    writeReport(workflowId, {
      generatedAt: attemptedAt,
      workflowId,
      jiraStoryId: state.jiraStoryId,
      status: 'SYNCED',
      action,
      gate,
      operation,
      statePatch: nextSync,
    });
    console.log(`Approved Jira artifact state synchronized. Report: ${reportPath(workflowId)}`);
  } catch (error) {
    const code =
      error instanceof JiraPolicyError ? error.code : 'JIRA_APPROVED_ARTIFACT_SYNC_FAILED';
    nextSync = jiraApprovedArtifactSyncSchema.parse({
      ...nextSync,
      status: 'FAILED',
      lastAttemptAt: attemptedAt,
      lastErrorCode: code,
    });
    writeReport(workflowId, {
      generatedAt: attemptedAt,
      workflowId,
      jiraStoryId: state.jiraStoryId,
      status: 'FAILED',
      action,
      gate,
      operation,
      code,
      message: error instanceof Error ? error.message : String(error),
      statePatch: nextSync,
    });
    console.error(`${code}: approved Jira artifact synchronization failed without blocking the workflow.`);
    console.error(`Report: ${reportPath(workflowId)}`);
  }
}

main().catch((error: unknown) => {
  console.error(`jira approved artifact synchronization failed to run: ${(error as Error).message}`);
  process.exitCode = 1;
});
