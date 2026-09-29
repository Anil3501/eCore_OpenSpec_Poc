import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import { approvalArtifactSchema } from '../../src/models/approval.model.ts';
import {
  jiraApprovedArtifactSyncSchema,
  workflowStateSchema,
} from '../../src/models/workflow-state.model.ts';
import { renderApprovedArtifactComment } from '../../src/utils/jira-approved-artifact-format.ts';
import {
  applyApprovedArtifactGateReopen,
  assertApprovedArtifactApprovalBinding,
  assertApprovedArtifactCandidateSourceIsCurrent,
  assertTestPlanSourceIsCurrent,
  planApprovedArtifactSync,
  recordApprovedArtifactUpload,
  shouldSynchronizeReopenedArtifactComment,
  type ApprovedArtifactCandidate,
  type JiraApprovedArtifactSync,
} from '../../src/utils/jira-approved-artifact-sync-core.ts';

const baseWorkflow = workflowStateSchema.parse({
  schemaVersion: '1.0.0',
  workflowId: 'WF-ETA-999-R1.0',
  workflowDefinition: 'workflow/definitions/sdd-jira-to-automation.workflow.json',
  jiraStoryId: 'ETA-999',
  release: '1.0',
  capability: 'sample-capability',
  dataClassification: 'REAL_JIRA_DATA',
  currentStage: 'AC_APPROVAL',
  nextStage: 'OPENSPEC_GENERATION',
  lastSuccessfulStage: 'AC_REVIEW_PACKAGE',
  status: 'WAITING_FOR_HUMAN',
  completedStages: [],
  pendingApproval: {
    gate: 'ACCEPTANCE_CRITERIA',
    reviewPackagePath: 'requirements/reviews/ETA-999-ac-review.md',
    approvalTemplatePath: 'requirements/reviews/ETA-999-ac-approval.template.json',
    expectedApprovalPath: 'requirements/approved/ETA-999-ac-approval.json',
    requestedAt: '2026-09-28T14:00:00.000Z',
  },
  inputArtifactVersions: {},
  outputArtifactPaths: [],
  retryCount: 0,
  createdAt: '2026-09-28T13:45:00.000Z',
  updatedAt: '2026-09-28T14:00:00.000Z',
  startedAt: '2026-09-28T13:45:00.000Z',
  completedAt: null,
  errorDetails: null,
  processingLock: null,
  assignedAgent: 'sdd-workflow-orchestrator',
});

function emptySync(): JiraApprovedArtifactSync {
  return jiraApprovedArtifactSyncSchema.parse({
    policyVersion: '1.0',
    eligible: true,
    eligibilityReason: 'NEW_ETA_TICKET',
    issueCreatedAt: '2026-09-28T13:44:00.000Z',
    managedCommentId: null,
    contentHash: null,
    status: 'PENDING',
    lastAttemptAt: null,
    lastSyncedAt: null,
    lastErrorCode: null,
    artifacts: [],
  });
}

function candidate(
  artifactType: 'ACCEPTANCE_CRITERIA' | 'TEST_PLAN',
  artifactVersion: number,
  hashCharacter: string,
): ApprovedArtifactCandidate {
  const isRequirements = artifactType === 'ACCEPTANCE_CRITERIA';
  return {
    artifactType,
    artifactId: isRequirements ? 'ETA-999' : 'TP-ETA-999-001',
    artifactVersion,
    approvalId: isRequirements ? 'APR-AC-ETA-999-001' : 'APR-TP-ETA-999-001',
    sourceArtifactPath: isRequirements
      ? 'requirements/approved/ETA-999.json'
      : 'test-plans/approved/TP-ETA-999-001.json',
    sourceArtifactVersion: isRequirements ? null : 1,
    contentHash: hashCharacter.repeat(64),
    fileName: isRequirements
      ? `ETA-999-approved-requirements-v${artifactVersion}.json`
      : `TP-ETA-999-001-approved-v${artifactVersion}.json`,
    content: new TextEncoder().encode('{}'),
  };
}

function upload(
  sync: JiraApprovedArtifactSync,
  artifact: ApprovedArtifactCandidate,
  attachmentId: string,
): JiraApprovedArtifactSync {
  const plan = planApprovedArtifactSync(sync, artifact);
  return recordApprovedArtifactUpload(
    plan,
    { id: attachmentId, filename: artifact.fileName },
    '2026-09-28T14:05:00.000Z',
  );
}

test('historical workflows remain valid without approved artifact sync state', () => {
  assert.equal(workflowStateSchema.safeParse(baseWorkflow).success, true);
});

test('pending issue verification remains ineligible and backward compatible', () => {
  const parsed = workflowStateSchema.safeParse({
    ...baseWorkflow,
    jiraApprovedArtifactSync: {
      policyVersion: '1.0',
      eligible: false,
      eligibilityReason: 'PENDING_ISSUE_VERIFICATION',
      issueCreatedAt: null,
      managedCommentId: null,
      contentHash: null,
      status: 'NOT_REQUIRED',
      lastAttemptAt: null,
      lastSyncedAt: null,
      lastErrorCode: null,
      artifacts: [],
    },
  });
  assert.equal(parsed.success, true);
});

test('workflow state rejects mismatched Jira synchronization eligibility', () => {
  const parsed = workflowStateSchema.safeParse({
    ...baseWorkflow,
    jiraAmbiguitySync: {
      policyVersion: '1.0',
      eligible: true,
      eligibilityReason: 'NEW_ETA_TICKET',
      issueCreatedAt: '2026-09-28T13:44:00.000Z',
      managedCommentId: null,
      contentHash: null,
      status: 'PENDING',
      lastAttemptAt: null,
      lastSyncedAt: null,
      lastErrorCode: null,
      items: [],
    },
    jiraApprovedArtifactSync: {
      policyVersion: '1.0',
      eligible: false,
      eligibilityReason: 'HISTORICAL_TICKET',
      issueCreatedAt: '2026-09-28T13:44:00.000Z',
      managedCommentId: null,
      contentHash: null,
      status: 'NOT_REQUIRED',
      lastAttemptAt: null,
      lastSyncedAt: null,
      lastErrorCode: null,
      artifacts: [],
    },
  });
  assert.equal(parsed.success, false);
});

test('first approved AC upload becomes current and is idempotent', () => {
  const ac = candidate('ACCEPTANCE_CRITERIA', 1, 'a');
  const synced = upload(emptySync(), ac, '501');
  assert.equal(synced.artifacts.length, 1);
  assert.equal(synced.artifacts[0].lifecycle, 'CURRENT');

  const repeat = planApprovedArtifactSync(synced, ac);
  assert.equal(repeat.needsUpload, false);
  const unchanged = recordApprovedArtifactUpload(
    repeat,
    null,
    '2026-09-28T14:06:00.000Z',
  );
  assert.equal(unchanged.artifacts.length, 1);
  assert.equal(unchanged.artifacts[0].jiraAttachmentId, '501');
});

test('same approved version with different content is rejected', () => {
  const synced = upload(emptySync(), candidate('ACCEPTANCE_CRITERIA', 1, 'a'), '501');
  assert.throws(
    () => planApprovedArtifactSync(synced, candidate('ACCEPTANCE_CRITERIA', 1, 'b')),
    /changed content after synchronization/,
  );
});

test('a newly approved AC supersedes the old AC and stales the dependent plan', () => {
  let sync = upload(emptySync(), candidate('ACCEPTANCE_CRITERIA', 1, 'a'), '501');
  sync = upload(sync, candidate('TEST_PLAN', 1, 'b'), '601');
  assertTestPlanSourceIsCurrent(sync);

  sync = upload(sync, candidate('ACCEPTANCE_CRITERIA', 2, 'c'), '502');
  assert.deepEqual(
    sync.artifacts.map((artifact) => [
      artifact.artifactType,
      artifact.artifactVersion,
      artifact.lifecycle,
    ]),
    [
      ['ACCEPTANCE_CRITERIA', 1, 'SUPERSEDED'],
      ['TEST_PLAN', 1, 'STALE'],
      ['ACCEPTANCE_CRITERIA', 2, 'CURRENT'],
    ],
  );
});

test('Gate 1 reopening supersedes current AC and stales current test plan', () => {
  let sync = upload(emptySync(), candidate('ACCEPTANCE_CRITERIA', 1, 'a'), '501');
  sync = upload(sync, candidate('TEST_PLAN', 1, 'b'), '601');
  const reopened = applyApprovedArtifactGateReopen(sync, 'ACCEPTANCE_CRITERIA');
  assert.equal(reopened.artifacts[0].lifecycle, 'SUPERSEDED');
  assert.equal(reopened.artifacts[1].lifecycle, 'STALE');
});

test('failed reopen retries its managed-comment update without changing lifecycle twice', () => {
  const current = upload(emptySync(), candidate('ACCEPTANCE_CRITERIA', 1, 'a'), '501');
  const reopened = applyApprovedArtifactGateReopen(current, 'ACCEPTANCE_CRITERIA');
  const failed = jiraApprovedArtifactSyncSchema.parse({
    ...reopened,
    status: 'FAILED',
    lastAttemptAt: '2026-09-28T14:06:00.000Z',
    lastErrorCode: 'JIRA_APPROVED_ARTIFACT_SYNC_FAILED',
  });
  const retry = applyApprovedArtifactGateReopen(failed, 'ACCEPTANCE_CRITERIA');

  assert.deepEqual(retry.artifacts, failed.artifacts);
  assert.equal(
    shouldSynchronizeReopenedArtifactComment(failed, retry, 'ACCEPTANCE_CRITERIA'),
    true,
  );
});

test('Gate 2 reopening leaves AC current and supersedes only the test plan', () => {
  let sync = upload(emptySync(), candidate('ACCEPTANCE_CRITERIA', 1, 'a'), '501');
  sync = upload(sync, candidate('TEST_PLAN', 1, 'b'), '601');
  const reopened = applyApprovedArtifactGateReopen(sync, 'TEST_PLAN');
  assert.equal(reopened.artifacts[0].lifecycle, 'CURRENT');
  assert.equal(reopened.artifacts[1].lifecycle, 'SUPERSEDED');
});

test('Gate 3 reopening does not change AC or test-plan lifecycle', () => {
  let sync = upload(emptySync(), candidate('ACCEPTANCE_CRITERIA', 1, 'a'), '501');
  sync = upload(sync, candidate('TEST_PLAN', 1, 'b'), '601');
  const reopened = applyApprovedArtifactGateReopen(sync, 'AUTOMATION_DESIGN');
  assert.deepEqual(reopened.artifacts, sync.artifacts);
});

test('test plan requires a current synchronized source AC version', () => {
  const planCandidate = candidate('TEST_PLAN', 1, 'b');
  assert.throws(
    () => assertApprovedArtifactCandidateSourceIsCurrent(emptySync(), planCandidate),
    /cannot be uploaded until AC version 1 is CURRENT/,
  );
  const planOnly = upload(emptySync(), planCandidate, '601');
  assert.throws(() => assertTestPlanSourceIsCurrent(planOnly), /not backed by a CURRENT/);
});

test('approval binding rejects a different release, capability, or source artifact', () => {
  const approval = approvalArtifactSchema.parse({
    schemaVersion: '1.0.0',
    approvalId: 'APR-AC-ETA-999-001',
    gate: 'ACCEPTANCE_CRITERIA',
    artifactId: 'ETA-999',
    artifactVersion: 1,
    release: '1.0',
    capability: 'sample-capability',
    sourceArtifactPath: 'requirements/normalized/ETA-999.json',
    decision: 'APPROVE',
    reviewer: { name: 'Reviewer', role: 'Product Owner', reference: null },
    reviewedAt: '2026-09-28T14:00:00.000Z',
    comments: 'Approved.',
    itemDecisions: [{ itemId: 'AC-ETA-999-001', decision: 'APPROVE', comment: 'Approved.' }],
  });
  assert.doesNotThrow(() =>
    assertApprovedArtifactApprovalBinding(approval, {
      expectedGate: 'ACCEPTANCE_CRITERIA',
      artifactId: 'ETA-999',
      artifactVersion: 1,
      expectedRelease: '1.0',
      expectedCapability: 'sample-capability',
      expectedSourceArtifactPath: 'requirements/normalized/ETA-999.json',
    }),
  );
  assert.throws(
    () =>
      assertApprovedArtifactApprovalBinding(approval, {
        expectedGate: 'ACCEPTANCE_CRITERIA',
        artifactId: 'ETA-999',
        artifactVersion: 1,
        expectedRelease: '2.0',
        expectedCapability: 'sample-capability',
        expectedSourceArtifactPath: 'requirements/normalized/ETA-999.json',
      }),
    /does not bind/,
  );
});

test('managed comment identifies current and historical versions without granting approval', () => {
  let sync = upload(emptySync(), candidate('ACCEPTANCE_CRITERIA', 1, 'a'), '501');
  sync = upload(sync, candidate('TEST_PLAN', 1, 'b'), '601');
  sync = upload(sync, candidate('ACCEPTANCE_CRITERIA', 2, 'c'), '502');
  const comment = renderApprovedArtifactComment(baseWorkflow, sync.artifacts);

  assert.match(comment, /v2 \[CURRENT\] ETA-999-approved-requirements-v2\.json/);
  assert.match(comment, /v1 \[SUPERSEDED\] ETA-999-approved-requirements-v1\.json/);
  assert.match(comment, /v1 \[STALE\] TP-ETA-999-001-approved-v1\.json/);
  assert.match(comment, /Jira comments and attachments are not approvals/);
});

test('workflow state rejects two current attachments of one artifact type', () => {
  const first = upload(emptySync(), candidate('ACCEPTANCE_CRITERIA', 1, 'a'), '501');
  const duplicateCurrent = {
    ...first,
    artifacts: [
      ...first.artifacts,
      {
        ...first.artifacts[0],
        artifactVersion: 2,
        contentHash: 'b'.repeat(64),
        fileName: 'ETA-999-approved-requirements-v2.json',
        jiraAttachmentId: '502',
      },
    ],
  };
  assert.equal(jiraApprovedArtifactSyncSchema.safeParse(duplicateCurrent).success, false);
});

test('approved artifact synchronization does not change workflow stages or gates', () => {
  const definition = JSON.parse(
    fs.readFileSync('workflow/definitions/sdd-jira-to-automation.workflow.json', 'utf8'),
  ) as {
    stages: Array<{ stage: string; gate?: string }>;
  };
  const gateStages = definition.stages
    .filter((stage) => stage.gate !== undefined)
    .map((stage) => [stage.stage, stage.gate]);
  const primaryStages = definition.stages.filter(
    (stage) =>
      !['FAILURE_TRIAGE', 'LOCATOR_HEALING', 'BUG_REPORTING', 'COMPLETED'].includes(stage.stage),
  );

  assert.equal(primaryStages.length, 17);
  assert.deepEqual(gateStages, [
    ['AC_APPROVAL', 'ACCEPTANCE_CRITERIA'],
    ['TEST_PLAN_APPROVAL', 'TEST_PLAN'],
    ['AUTOMATION_APPROVAL', 'AUTOMATION_DESIGN'],
  ]);
});
