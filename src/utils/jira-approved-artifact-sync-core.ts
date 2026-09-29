import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import {
  approvalArtifactSchema,
  type ApprovalArtifact,
} from '../models/approval.model.ts';
import { jiraRequirementArtifactSchema } from '../models/requirement.model.ts';
import { testPlanSchema } from '../models/test-plan.model.ts';
import {
  jiraApprovedArtifactSyncSchema,
  type WorkflowState,
} from '../models/workflow-state.model.ts';
import { exists, readJson, toAbsolute, toRelative } from './artifact-io.ts';
import type { JiraApprovedArtifactRecord } from './jira-approved-artifact-format.ts';

export type ApprovedArtifactType = JiraApprovedArtifactRecord['artifactType'];
export type ApprovedArtifactGate = ApprovedArtifactType | 'AUTOMATION_DESIGN';
export type JiraApprovedArtifactSync = NonNullable<WorkflowState['jiraApprovedArtifactSync']>;

export interface ApprovedArtifactCandidate {
  artifactType: ApprovedArtifactType;
  artifactId: string;
  artifactVersion: number;
  approvalId: string;
  sourceArtifactPath: string;
  sourceArtifactVersion: number | null;
  contentHash: string;
  fileName: string;
  content: Uint8Array;
}

export interface PlannedApprovedArtifactSync {
  sync: JiraApprovedArtifactSync;
  candidate: ApprovedArtifactCandidate;
  existing: JiraApprovedArtifactRecord | null;
  needsUpload: boolean;
}

function sha256(content: Uint8Array): string {
  return crypto.createHash('sha256').update(content).digest('hex');
}

function readApprovedContent(relativePath: string): { content: Uint8Array; hash: string } {
  const absolute = toAbsolute(relativePath);
  const content = fs.readFileSync(absolute);
  return { content, hash: sha256(content) };
}

function parseApproval(
  approvalPath: string | null | undefined,
  expectedGate: 'ACCEPTANCE_CRITERIA' | 'TEST_PLAN',
  artifactId: string,
  artifactVersion: number,
  expectedRelease: string,
  expectedCapability: string,
  expectedSourceArtifactPath: string,
): ReturnType<typeof approvalArtifactSchema.parse> {
  if (!approvalPath || !exists(approvalPath)) {
    throw new Error(`Approved artifact has no existing approvalRef: ${approvalPath ?? 'null'}`);
  }
  const approval = approvalArtifactSchema.parse(readJson(approvalPath));
  assertApprovedArtifactApprovalBinding(approval, {
    expectedGate,
    artifactId,
    artifactVersion,
    expectedRelease,
    expectedCapability,
    expectedSourceArtifactPath,
  });
  if (!exists(approval.sourceArtifactPath)) {
    throw new Error(`Approval source artifact does not exist: ${approval.sourceArtifactPath}`);
  }
  return approval;
}

export function assertApprovedArtifactApprovalBinding(
  approval: ApprovalArtifact,
  expected: {
    expectedGate: 'ACCEPTANCE_CRITERIA' | 'TEST_PLAN';
    artifactId: string;
    artifactVersion: number;
    expectedRelease: string;
    expectedCapability: string;
    expectedSourceArtifactPath: string;
  },
): void {
  if (
    approval.gate !== expected.expectedGate ||
    approval.decision !== 'APPROVE' ||
    approval.artifactId !== expected.artifactId ||
    approval.artifactVersion !== expected.artifactVersion ||
    approval.release !== expected.expectedRelease ||
    approval.capability !== expected.expectedCapability ||
    approval.sourceArtifactPath !== expected.expectedSourceArtifactPath
  ) {
    throw new Error(
      `${approval.approvalId} does not bind ${expected.expectedGate} approval to ${expected.artifactId} artifactVersion ${expected.artifactVersion}, release ${expected.expectedRelease}, capability ${expected.expectedCapability}, and source ${expected.expectedSourceArtifactPath}.`,
    );
  }
}

function requirementCandidate(state: WorkflowState): ApprovedArtifactCandidate {
  const sourceArtifactPath = `requirements/approved/${state.jiraStoryId}.json`;
  if (!exists(sourceArtifactPath)) {
    throw new Error(`Approved requirements not found: ${sourceArtifactPath}`);
  }
  const artifact = jiraRequirementArtifactSchema.parse(readJson(sourceArtifactPath));
  if (
    artifact.story.jiraId !== state.jiraStoryId ||
    artifact.release !== state.release ||
    artifact.capability !== state.capability ||
    artifact.approvalStatus !== 'APPROVED'
  ) {
    throw new Error(`${sourceArtifactPath} does not match the workflow or is not APPROVED.`);
  }
  const approval = parseApproval(
    artifact.approvalRef,
    'ACCEPTANCE_CRITERIA',
    artifact.story.jiraId,
    artifact.artifactVersion,
    state.release,
    state.capability,
    `requirements/normalized/${state.jiraStoryId}.json`,
  );
  const { content, hash } = readApprovedContent(sourceArtifactPath);
  return {
    artifactType: 'ACCEPTANCE_CRITERIA',
    artifactId: artifact.story.jiraId,
    artifactVersion: artifact.artifactVersion,
    approvalId: approval.approvalId,
    sourceArtifactPath,
    sourceArtifactVersion: null,
    contentHash: hash,
    fileName: `${artifact.story.jiraId}-approved-requirements-v${artifact.artifactVersion}.json`,
    content,
  };
}

function selectedApprovedTestPlanPath(state: WorkflowState): string {
  const candidates = state.outputArtifactPaths
    .filter(
      (file) =>
        /^test-plans\/approved\/TP-[A-Z0-9-]+-\d{3}(?:-v\d+)?\.json$/.test(file) &&
        !file.includes('-approval'),
    )
    .filter(exists)
    .map((file) => ({ file, plan: testPlanSchema.parse(readJson(file)) }))
    .filter(({ plan }) => plan.jiraStoryIds.includes(state.jiraStoryId))
    .sort((left, right) => right.plan.artifactVersion - left.plan.artifactVersion);

  if (candidates.length === 0) {
    throw new Error(
      'Workflow outputArtifactPaths does not identify an approved test plan for this Jira story.',
    );
  }
  if (
    candidates.length > 1 &&
    candidates[0].plan.artifactVersion === candidates[1].plan.artifactVersion
  ) {
    throw new Error(
      `Workflow outputArtifactPaths identifies multiple approved test plans at version ${candidates[0].plan.artifactVersion}.`,
    );
  }
  return candidates[0].file;
}

function testPlanCandidate(state: WorkflowState): ApprovedArtifactCandidate {
  const sourceArtifactPath = selectedApprovedTestPlanPath(state);
  const artifact = testPlanSchema.parse(readJson(sourceArtifactPath));
  if (
    artifact.release !== state.release ||
    artifact.capability !== state.capability ||
    artifact.approvalStatus !== 'APPROVED'
  ) {
    throw new Error(`${sourceArtifactPath} does not match the workflow or is not APPROVED.`);
  }
  const approval = parseApproval(
    artifact.approvalRef,
    'TEST_PLAN',
    artifact.testPlanId,
    artifact.artifactVersion,
    state.release,
    state.capability,
    sourceArtifactPath.replace('test-plans/approved/', 'test-plans/generated/'),
  );
  const requirementsPath = `requirements/approved/${state.jiraStoryId}.json`;
  const requirements = jiraRequirementArtifactSchema.parse(readJson(requirementsPath));
  const { content, hash } = readApprovedContent(sourceArtifactPath);
  return {
    artifactType: 'TEST_PLAN',
    artifactId: artifact.testPlanId,
    artifactVersion: artifact.artifactVersion,
    approvalId: approval.approvalId,
    sourceArtifactPath,
    sourceArtifactVersion: requirements.artifactVersion,
    contentHash: hash,
    fileName: `${artifact.testPlanId}-approved-v${artifact.artifactVersion}.json`,
    content,
  };
}

export function loadApprovedArtifactCandidate(
  state: WorkflowState,
  artifactType: ApprovedArtifactType,
): ApprovedArtifactCandidate {
  return artifactType === 'ACCEPTANCE_CRITERIA'
    ? requirementCandidate(state)
    : testPlanCandidate(state);
}

function withLifecycleForCandidate(
  sync: JiraApprovedArtifactSync,
  candidate: ApprovedArtifactCandidate,
): JiraApprovedArtifactSync {
  const artifacts = sync.artifacts.map((artifact) => {
    if (
      candidate.artifactType === 'ACCEPTANCE_CRITERIA' &&
      artifact.artifactType === 'TEST_PLAN' &&
      artifact.lifecycle === 'CURRENT' &&
      artifact.sourceArtifactVersion !== candidate.artifactVersion
    ) {
      return { ...artifact, lifecycle: 'STALE' as const };
    }
    if (
      artifact.artifactType === candidate.artifactType &&
      artifact.lifecycle === 'CURRENT' &&
      (artifact.artifactVersion !== candidate.artifactVersion ||
        artifact.contentHash !== candidate.contentHash)
    ) {
      return { ...artifact, lifecycle: 'SUPERSEDED' as const };
    }
    return artifact;
  });
  return jiraApprovedArtifactSyncSchema.parse({
    ...sync,
    artifacts,
    status: 'PENDING',
    contentHash: null,
    lastErrorCode: null,
  });
}

export function planApprovedArtifactSync(
  syncValue: JiraApprovedArtifactSync,
  candidate: ApprovedArtifactCandidate,
): PlannedApprovedArtifactSync {
  const sync = withLifecycleForCandidate(
    jiraApprovedArtifactSyncSchema.parse(syncValue),
    candidate,
  );
  const sameVersion = sync.artifacts.find(
    (artifact) =>
      artifact.artifactType === candidate.artifactType &&
      artifact.artifactId === candidate.artifactId &&
      artifact.artifactVersion === candidate.artifactVersion,
  );
  if (sameVersion && sameVersion.contentHash !== candidate.contentHash) {
    throw new Error(
      `${candidate.artifactId} version ${candidate.artifactVersion} changed content after synchronization. Increment artifactVersion before approval.`,
    );
  }
  return {
    sync,
    candidate,
    existing: sameVersion ?? null,
    needsUpload: sameVersion === undefined,
  };
}

export function recordApprovedArtifactUpload(
  plan: PlannedApprovedArtifactSync,
  attachment: { id: string; filename: string } | null,
  uploadedAt: string,
): JiraApprovedArtifactSync {
  if (plan.needsUpload && attachment === null) {
    throw new Error('A new approved artifact requires a Jira attachment result.');
  }
  if (!plan.needsUpload && plan.existing === null) {
    throw new Error('An unchanged approved artifact requires an existing synchronization record.');
  }

  const record: JiraApprovedArtifactRecord = {
    artifactType: plan.candidate.artifactType,
    artifactId: plan.candidate.artifactId,
    artifactVersion: plan.candidate.artifactVersion,
    approvalId: plan.candidate.approvalId,
    sourceArtifactPath: plan.candidate.sourceArtifactPath,
    sourceArtifactVersion: plan.candidate.sourceArtifactVersion,
    contentHash: plan.candidate.contentHash,
    fileName: attachment?.filename ?? plan.existing!.fileName,
    jiraAttachmentId: attachment?.id ?? plan.existing!.jiraAttachmentId,
    lifecycle: 'CURRENT',
    uploadedAt: attachment === null ? plan.existing!.uploadedAt : uploadedAt,
  };
  const artifacts = plan.sync.artifacts.filter(
    (artifact) =>
      !(
        artifact.artifactType === record.artifactType &&
        artifact.artifactId === record.artifactId &&
        artifact.artifactVersion === record.artifactVersion
      ),
  );
  artifacts.push(record);
  return jiraApprovedArtifactSyncSchema.parse({ ...plan.sync, artifacts });
}

export function assertTestPlanSourceIsCurrent(syncValue: JiraApprovedArtifactSync): void {
  const sync = jiraApprovedArtifactSyncSchema.parse(syncValue);
  const currentPlan = sync.artifacts.find(
    (artifact) => artifact.artifactType === 'TEST_PLAN' && artifact.lifecycle === 'CURRENT',
  );
  if (!currentPlan) return;
  const currentRequirements = sync.artifacts.find(
    (artifact) =>
      artifact.artifactType === 'ACCEPTANCE_CRITERIA' &&
      artifact.lifecycle === 'CURRENT' &&
      artifact.artifactVersion === currentPlan.sourceArtifactVersion,
  );
  if (!currentRequirements) {
    throw new Error(
      `Current test plan ${currentPlan.artifactId} is not backed by a CURRENT synchronized AC version.`,
    );
  }
}

export function assertApprovedArtifactCandidateSourceIsCurrent(
  syncValue: JiraApprovedArtifactSync,
  candidate: ApprovedArtifactCandidate,
): void {
  if (candidate.artifactType !== 'TEST_PLAN') return;
  const sync = jiraApprovedArtifactSyncSchema.parse(syncValue);
  const currentRequirements = sync.artifacts.find(
    (artifact) =>
      artifact.artifactType === 'ACCEPTANCE_CRITERIA' &&
      artifact.lifecycle === 'CURRENT' &&
      artifact.artifactVersion === candidate.sourceArtifactVersion,
  );
  if (!currentRequirements) {
    throw new Error(
      `${candidate.artifactId} cannot be uploaded until AC version ${candidate.sourceArtifactVersion} is CURRENT in Jira synchronization state.`,
    );
  }
}

export function applyApprovedArtifactGateReopen(
  syncValue: JiraApprovedArtifactSync,
  gate: ApprovedArtifactGate,
): JiraApprovedArtifactSync {
  const sync = jiraApprovedArtifactSyncSchema.parse(syncValue);
  if (gate === 'AUTOMATION_DESIGN') return sync;
  let changed = false;
  const artifacts = sync.artifacts.map((artifact) => {
    if (
      gate === 'ACCEPTANCE_CRITERIA' &&
      artifact.artifactType === 'ACCEPTANCE_CRITERIA' &&
      artifact.lifecycle === 'CURRENT'
    ) {
      changed = true;
      return { ...artifact, lifecycle: 'SUPERSEDED' as const };
    }
    if (
      gate === 'ACCEPTANCE_CRITERIA' &&
      artifact.artifactType === 'TEST_PLAN' &&
      artifact.lifecycle === 'CURRENT'
    ) {
      changed = true;
      return { ...artifact, lifecycle: 'STALE' as const };
    }
    if (
      gate === 'TEST_PLAN' &&
      artifact.artifactType === 'TEST_PLAN' &&
      artifact.lifecycle === 'CURRENT'
    ) {
      changed = true;
      return { ...artifact, lifecycle: 'SUPERSEDED' as const };
    }
    return artifact;
  });
  if (!changed) return sync;
  return jiraApprovedArtifactSyncSchema.parse({
    ...sync,
    artifacts,
    status: 'PENDING',
    contentHash: null,
    lastErrorCode: null,
  });
}

export function shouldSynchronizeReopenedArtifactComment(
  before: JiraApprovedArtifactSync,
  after: JiraApprovedArtifactSync,
  gate: ApprovedArtifactGate,
): boolean {
  if (gate === 'AUTOMATION_DESIGN' || after.artifacts.length === 0) return false;
  const lifecycleChanged = JSON.stringify(before.artifacts) !== JSON.stringify(after.artifacts);
  return lifecycleChanged || after.status !== 'SYNCED';
}

export function assertApprovedArtifactPath(relativePath: string): string {
  const normalized = relativePath.split(path.sep).join('/');
  const allowed =
    /^requirements\/approved\/ETA-\d+\.json$/.test(normalized) ||
    /^test-plans\/approved\/TP-ETA-\d+-\d{3}(?:-v\d+)?\.json$/.test(normalized);
  if (!allowed || normalized.includes('-approval')) {
    throw new Error(`Jira approved artifact path is not allowlisted: ${relativePath}`);
  }
  const absolute = toAbsolute(normalized);
  const inside = path.relative(toAbsolute('.'), absolute);
  if (inside.startsWith('..') || path.isAbsolute(inside) || !exists(normalized)) {
    throw new Error(`Jira approved artifact path is unsafe or missing: ${relativePath}`);
  }
  return toRelative(absolute);
}
