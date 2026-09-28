/**
 * Usage:
 *   node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON src/utils/jira-ambiguity-sync.ts <workflowId>
 *
 * Mirrors recorded ambiguities from one eligible ETA workflow into its single managed Jira
 * comment. It writes a result/next-state patch under reports/ only; the orchestrator remains the
 * sole owner of workflow state.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import { jiraRequirementArtifactSchema } from '../models/requirement.model.ts';
import { testPlanSchema } from '../models/test-plan.model.ts';
import {
  jiraAmbiguitySyncItemSchema,
  workflowStateSchema,
  type WorkflowState,
} from '../models/workflow-state.model.ts';
import {
  exists,
  listFiles,
  listFilesRecursive,
  readJson,
  readText,
  toAbsolute,
} from './artifact-io.ts';
import { env } from './env.ts';
import {
  JIRA_AMBIGUITY_GATE_ORDER,
  renderAmbiguityComment,
  type JiraAmbiguitySyncItem,
} from './jira-ambiguity-format.ts';
import { createJiraComment, editJiraComment } from './jira-write-client.ts';
import { JiraPolicyError, assertJiraIssueAllowed } from './jira-policy.ts';

type SyncItem = JiraAmbiguitySyncItem;

function workflowPath(workflowId: string): string {
  if (!/^WF-[A-Z0-9-]+-R\d+\.\d+(\.\d+)?$/.test(workflowId)) {
    throw new Error('Workflow id must match WF-PROJECT-123-R1.0.');
  }
  const candidate = `workflow/instances/${workflowId}.json`;
  if (!exists(candidate)) throw new Error(`Workflow state not found: ${candidate}`);
  return candidate;
}

function add(items: Map<string, SyncItem>, item: SyncItem): void {
  const existing = items.get(item.itemId);
  if (
    !existing ||
    JIRA_AMBIGUITY_GATE_ORDER[item.gate] >= JIRA_AMBIGUITY_GATE_ORDER[existing.gate]
  ) {
    items.set(item.itemId, jiraAmbiguitySyncItemSchema.parse(item));
  }
}

function collectGate1(state: WorkflowState, items: Map<string, SyncItem>): void {
  const candidates = [
    `requirements/normalized/${state.jiraStoryId}.json`,
    `requirements/approved/${state.jiraStoryId}.json`,
  ].filter(exists);
  if (candidates.length === 0) return;

  const sources = candidates
    .map((file) => ({ file, artifact: jiraRequirementArtifactSchema.parse(readJson(file)) }))
    .sort(
      (left, right) =>
        right.artifact.artifactVersion - left.artifact.artifactVersion ||
        Number(right.file.includes('/approved/')) - Number(left.file.includes('/approved/')),
    );
  const sourcePath = sources[0].file;
  const artifact = sources[0].artifact;
  for (const ambiguity of artifact.ambiguities) {
    add(items, {
      itemId: ambiguity.ambiguityId,
      gate: 'ACCEPTANCE_CRITERIA',
      question: ambiguity.question,
      impact: ambiguity.impact,
      status: ambiguity.status,
      sourcePath,
    });
  }
}

function collectGate2(state: WorkflowState, items: Map<string, SyncItem>): void {
  const candidates = [
    ...listFiles('test-plans/generated', '.json'),
    ...listFiles('test-plans/approved', '.json'),
  ];
  const plans = candidates
    .map((file) => {
      const parsed = testPlanSchema.safeParse(readJson(file));
      return parsed.success && parsed.data.jiraStoryIds.includes(state.jiraStoryId)
        ? { file, plan: parsed.data }
        : null;
    })
    .filter((value): value is NonNullable<typeof value> => value !== null)
    .sort(
      (left, right) =>
        right.plan.artifactVersion - left.plan.artifactVersion ||
        Number(right.file.includes('/approved/')) - Number(left.file.includes('/approved/')),
    );
  if (plans.length === 0) return;

  const { file, plan } = plans[0];
  for (const clarification of plan.clarifications) {
    add(items, {
      itemId: clarification.clarificationId,
      gate: 'TEST_PLAN',
      question: clarification.question,
      impact: null,
      status: clarification.status,
      sourcePath: file,
    });
  }
}

function collectGate3(state: WorkflowState, items: Map<string, SyncItem>): void {
  const designFiles = listFilesRecursive('features/generated', '-automation-design.md');
  const id = state.jiraStoryId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const linePattern = new RegExp(
    `^\\*\\*((?:AMB|CLR-TP|BLOCKER)-${id}-\\d{3})\\*\\*\\s+\\[(REVIEW_REQUIRED|RESOLVED|DEFERRED|WITHDRAWN)\\]\\s+[—-]\\s+(.+)$`,
  );

  for (const file of designFiles) {
    for (const line of readText(file).split(/\r?\n/)) {
      const match = line.trim().match(linePattern);
      if (!match) continue;
      add(items, {
        itemId: match[1],
        gate: 'AUTOMATION_DESIGN',
        question: match[3].trim(),
        impact: null,
        status: match[2] as SyncItem['status'],
        sourcePath: file,
      });
    }
  }
}

export function collectAmbiguitySyncItems(state: WorkflowState): SyncItem[] {
  const items = new Map<string, SyncItem>();
  collectGate1(state, items);
  collectGate2(state, items);
  collectGate3(state, items);
  return [...items.values()].sort(
    (left, right) =>
      JIRA_AMBIGUITY_GATE_ORDER[left.gate] -
        JIRA_AMBIGUITY_GATE_ORDER[right.gate] ||
      left.itemId.localeCompare(right.itemId),
  );
}

function reportPath(workflowId: string): string {
  return `reports/jira/ambiguity-sync/${workflowId}.json`;
}

function writeReport(workflowId: string, report: Record<string, unknown>): void {
  const output = toAbsolute(reportPath(workflowId));
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
}

async function main(): Promise<void> {
  const workflowId = process.argv[2] ?? '';
  const sourcePath = workflowPath(workflowId);
  const state = workflowStateSchema.parse(readJson(sourcePath));
  const sync = state.jiraAmbiguitySync;
  const attemptedAt = new Date().toISOString();

  if (!sync || !sync.eligible) {
    writeReport(workflowId, {
      generatedAt: attemptedAt,
      workflowId,
      jiraStoryId: state.jiraStoryId,
      status: 'NOT_REQUIRED',
      reason: sync?.eligibilityReason ?? 'HISTORICAL_WORKFLOW_WITHOUT_SYNC_STATE',
      statePatch: sync ?? null,
    });
    console.log(`Ambiguity synchronization is not required. Report: ${reportPath(workflowId)}`);
    return;
  }

  assertJiraIssueAllowed(state.jiraStoryId, sync.managedCommentId ? 'COMMENT_EDIT' : 'COMMENT_CREATE');
  const items = collectAmbiguitySyncItems(state);

  if (items.length === 0 && sync.managedCommentId === null) {
    writeReport(workflowId, {
      generatedAt: attemptedAt,
      workflowId,
      jiraStoryId: state.jiraStoryId,
      status: 'SKIPPED',
      reason: 'NO_AMBIGUITIES_TO_SYNC',
      itemCount: 0,
      statePatch: {
        ...sync,
        items: [],
        lastAttemptAt: attemptedAt,
      },
    });
    console.log(
      `No ambiguities or clarification questions exist; initial managed comment suppressed. Report: ${reportPath(workflowId)}`,
    );
    return;
  }

  const body = renderAmbiguityComment(state, items);
  const contentHash = crypto.createHash('sha256').update(body, 'utf8').digest('hex');
  if (sync.status === 'SYNCED' && sync.contentHash === contentHash) {
    writeReport(workflowId, {
      generatedAt: attemptedAt,
      workflowId,
      jiraStoryId: state.jiraStoryId,
      status: 'UNCHANGED',
      itemCount: items.length,
      statePatch: { ...sync, items },
    });
    console.log(`Managed Jira comment is already current. Report: ${reportPath(workflowId)}`);
    return;
  }

  try {
    const jira = env.requireJiraConfig();
    const result =
      sync.managedCommentId === null
        ? await createJiraComment(state.jiraStoryId, body, jira)
        : await editJiraComment(state.jiraStoryId, sync.managedCommentId, body, jira);
    const nextSync = {
      ...sync,
      managedCommentId: result.commentId,
      contentHash,
      status: 'SYNCED' as const,
      lastAttemptAt: attemptedAt,
      lastSyncedAt: attemptedAt,
      lastErrorCode: null,
      items,
    };
    writeReport(workflowId, {
      generatedAt: attemptedAt,
      workflowId,
      jiraStoryId: state.jiraStoryId,
      status: 'SYNCED',
      operation: sync.managedCommentId === null ? 'COMMENT_CREATE' : 'COMMENT_EDIT',
      itemCount: items.length,
      statePatch: nextSync,
    });
    console.log(`Managed Jira ambiguity comment synchronized. Report: ${reportPath(workflowId)}`);
  } catch (error) {
    const code = error instanceof JiraPolicyError ? error.code : 'JIRA_AMBIGUITY_SYNC_FAILED';
    const nextSync = {
      ...sync,
      contentHash,
      status: 'FAILED' as const,
      lastAttemptAt: attemptedAt,
      lastErrorCode: code,
      items,
    };
    writeReport(workflowId, {
      generatedAt: attemptedAt,
      workflowId,
      jiraStoryId: state.jiraStoryId,
      status: 'FAILED',
      code,
      message: error instanceof Error ? error.message : String(error),
      itemCount: items.length,
      statePatch: nextSync,
    });
    console.error(`${code}: Jira ambiguity synchronization failed without blocking the approval gate.`);
    console.error(`Report: ${reportPath(workflowId)}`);
  }
}

main().catch((error: unknown) => {
  console.error(`jira ambiguity synchronization failed to run: ${(error as Error).message}`);
  process.exitCode = 1;
});
