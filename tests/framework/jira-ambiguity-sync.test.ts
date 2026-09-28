import assert from 'node:assert/strict';
import test from 'node:test';

import { workflowStateSchema } from '../../src/models/workflow-state.model.ts';
import { renderAmbiguityComment } from '../../src/utils/jira-ambiguity-format.ts';

const baseWorkflow = {
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
};

test('historical workflow states remain valid without synchronization metadata', () => {
  assert.equal(workflowStateSchema.safeParse(baseWorkflow).success, true);
});

test('synchronized state requires a managed comment identity', () => {
  const parsed = workflowStateSchema.safeParse({
    ...baseWorkflow,
    jiraAmbiguitySync: {
      policyVersion: '1.0',
      eligible: true,
      eligibilityReason: 'NEW_ETA_TICKET',
      issueCreatedAt: '2026-09-28T13:44:00.000Z',
      managedCommentId: null,
      contentHash: 'a'.repeat(64),
      status: 'SYNCED',
      lastAttemptAt: '2026-09-28T14:00:00.000Z',
      lastSyncedAt: '2026-09-28T14:00:00.000Z',
      lastErrorCode: null,
      items: [],
    },
  });

  assert.equal(parsed.success, false);
});

test('failed synchronization does not close or block the approval gate', () => {
  const parsed = workflowStateSchema.safeParse({
    ...baseWorkflow,
    jiraAmbiguitySync: {
      policyVersion: '1.0',
      eligible: true,
      eligibilityReason: 'NEW_ETA_TICKET',
      issueCreatedAt: '2026-09-28T13:44:00.000Z',
      managedCommentId: null,
      contentHash: 'a'.repeat(64),
      status: 'FAILED',
      lastAttemptAt: '2026-09-28T14:00:00.000Z',
      lastSyncedAt: null,
      lastErrorCode: 'JIRA_AMBIGUITY_SYNC_FAILED',
      items: [],
    },
  });
  assert.equal(parsed.success, true);
  if (parsed.success) {
    assert.equal(parsed.data.status, 'WAITING_FOR_HUMAN');
    assert.equal(parsed.data.jiraAmbiguitySync?.status, 'FAILED');
  }
});

test('managed comment preserves authority and item lifecycle', () => {
  const state = workflowStateSchema.parse(baseWorkflow);
  const comment = renderAmbiguityComment(state, [
    {
      itemId: 'AMB-ETA-999-001',
      gate: 'ACCEPTANCE_CRITERIA',
      question: 'Which role may perform this action?',
      impact: 'The affected scenario cannot be approved.',
      status: 'REVIEW_REQUIRED',
      sourcePath: 'requirements/normalized/ETA-999.json',
    },
    {
      itemId: 'CLR-TP-ETA-999-001',
      gate: 'TEST_PLAN',
      question: 'Which reversible cleanup should the test use?',
      impact: null,
      status: 'RESOLVED',
      sourcePath: 'test-plans/generated/TP-ETA-999-001.json',
    },
  ]);

  assert.match(comment, /AMB-ETA-999-001 \[REVIEW_REQUIRED\]/);
  assert.match(comment, /CLR-TP-ETA-999-001 \[RESOLVED\]/);
  assert.match(comment, /approval artifact is still required/);
});

test('pending state allows eligible workflow without initial comment when no ambiguities exist', () => {
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
      lastAttemptAt: '2026-09-28T14:00:00.000Z',
      lastSyncedAt: null,
      lastErrorCode: null,
      items: [],
    },
  });

  assert.equal(parsed.success, true);
  if (parsed.success) {
    assert.equal(parsed.data.jiraAmbiguitySync?.managedCommentId, null);
    assert.equal(parsed.data.jiraAmbiguitySync?.status, 'PENDING');
  }
});

