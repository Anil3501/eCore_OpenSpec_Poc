import { z } from 'zod';
import {
  approvalGateSchema,
  capabilitySchema,
  dataClassificationSchema,
  isoTimestampSchema,
  jiraIdSchema,
  releaseSchema,
  SCHEMA_VERSION,
  workflowStageSchema,
  workflowStatusSchema,
} from './common.model.ts';

export const processingLockSchema = z.object({
  lockId: z.string().min(1),
  owner: z.string().min(1),
  acquiredAt: isoTimestampSchema,
  expiresAt: isoTimestampSchema.nullable().optional(),
  scope: z.array(z.string()),
});

export const jiraAmbiguitySyncItemSchema = z
  .object({
    itemId: z.string().regex(/^(AMB|CLR-TP|BLOCKER)-[A-Z][A-Z0-9]+-\d+-\d{3}$/),
    gate: approvalGateSchema,
    question: z.string().min(1),
    impact: z.string().min(1).nullable(),
    status: z.enum(['REVIEW_REQUIRED', 'RESOLVED', 'DEFERRED', 'WITHDRAWN']),
    sourcePath: z.string().min(1),
  })
  .strict();

export const jiraAmbiguitySyncSchema = z
  .object({
    policyVersion: z.literal('1.0'),
    eligible: z.boolean(),
    eligibilityReason: z.enum([
      'PENDING_ISSUE_VERIFICATION',
      'NEW_ETA_TICKET',
      'HISTORICAL_TICKET',
    ]),
    issueCreatedAt: isoTimestampSchema.nullable(),
    managedCommentId: z.string().regex(/^\d+$/).nullable(),
    contentHash: z.string().regex(/^[a-f0-9]{64}$/).nullable(),
    status: z.enum(['NOT_REQUIRED', 'PENDING', 'SYNCED', 'FAILED']),
    lastAttemptAt: isoTimestampSchema.nullable(),
    lastSyncedAt: isoTimestampSchema.nullable(),
    lastErrorCode: z.string().min(1).nullable(),
    items: z.array(jiraAmbiguitySyncItemSchema),
  })
  .strict()
  .superRefine((sync, ctx) => {
    if (sync.eligibilityReason === 'PENDING_ISSUE_VERIFICATION') {
      if (sync.eligible || sync.issueCreatedAt !== null || sync.status !== 'NOT_REQUIRED') {
        ctx.addIssue({
          code: 'custom',
          path: ['eligibilityReason'],
          message: 'PENDING_ISSUE_VERIFICATION must remain ineligible and NOT_REQUIRED until Jira issue creation is verified.',
        });
      }
    }
    if (sync.eligibilityReason === 'NEW_ETA_TICKET' && (!sync.eligible || sync.issueCreatedAt === null)) {
      ctx.addIssue({
        code: 'custom',
        path: ['eligible'],
        message: 'NEW_ETA_TICKET requires eligible=true and issueCreatedAt.',
      });
    }
    if (sync.eligibilityReason === 'HISTORICAL_TICKET' && (sync.eligible || sync.status !== 'NOT_REQUIRED')) {
      ctx.addIssue({
        code: 'custom',
        path: ['eligible'],
        message: 'HISTORICAL_TICKET must remain ineligible with status NOT_REQUIRED.',
      });
    }
    if (sync.status === 'SYNCED') {
      if (
        sync.managedCommentId === null ||
        sync.contentHash === null ||
        sync.lastAttemptAt === null ||
        sync.lastSyncedAt === null ||
        sync.lastErrorCode !== null
      ) {
        ctx.addIssue({
          code: 'custom',
          path: ['status'],
          message: 'SYNCED requires comment identity, content hash, attempt/sync timestamps, and no error code.',
        });
      }
    }
    if (sync.status === 'FAILED' && (sync.lastAttemptAt === null || sync.lastErrorCode === null)) {
      ctx.addIssue({
        code: 'custom',
        path: ['status'],
        message: 'FAILED requires lastAttemptAt and lastErrorCode.',
      });
    }
  });

export const jiraApprovedArtifactRecordSchema = z
  .object({
    artifactType: z.enum(['ACCEPTANCE_CRITERIA', 'TEST_PLAN']),
    artifactId: z.string().min(1),
    artifactVersion: z.number().int().min(1),
    approvalId: z.string().regex(/^APR-(AC|TP)-[A-Z0-9-]+-\d{3}$/),
    sourceArtifactPath: z.string().min(1),
    sourceArtifactVersion: z.number().int().min(1).nullable(),
    contentHash: z.string().regex(/^[a-f0-9]{64}$/),
    fileName: z.string().min(1),
    jiraAttachmentId: z.string().regex(/^\d+$/),
    lifecycle: z.enum(['CURRENT', 'SUPERSEDED', 'STALE']),
    uploadedAt: isoTimestampSchema,
  })
  .strict()
  .superRefine((artifact, ctx) => {
    if (
      artifact.artifactType === 'ACCEPTANCE_CRITERIA' &&
      (!/^ETA-\d+$/.test(artifact.artifactId) ||
        !artifact.approvalId.startsWith('APR-AC-') ||
        artifact.sourceArtifactVersion !== null)
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['artifactId'],
        message:
          'An ACCEPTANCE_CRITERIA Jira attachment requires an ETA artifactId, APR-AC approval, and null sourceArtifactVersion.',
      });
    }
    if (
      artifact.artifactType === 'TEST_PLAN' &&
      (!/^TP-ETA-\d+-\d{3}$/.test(artifact.artifactId) ||
        !artifact.approvalId.startsWith('APR-TP-') ||
        artifact.sourceArtifactVersion === null)
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['artifactId'],
        message:
          'A TEST_PLAN Jira attachment requires a TP-ETA-* artifactId, APR-TP approval, and source requirement version.',
      });
    }
  });

export const jiraApprovedArtifactSyncSchema = z
  .object({
    policyVersion: z.literal('1.0'),
    eligible: z.boolean(),
    eligibilityReason: z.enum([
      'PENDING_ISSUE_VERIFICATION',
      'NEW_ETA_TICKET',
      'HISTORICAL_TICKET',
    ]),
    issueCreatedAt: isoTimestampSchema.nullable(),
    managedCommentId: z.string().regex(/^\d+$/).nullable(),
    contentHash: z.string().regex(/^[a-f0-9]{64}$/).nullable(),
    status: z.enum(['NOT_REQUIRED', 'PENDING', 'SYNCED', 'FAILED']),
    lastAttemptAt: isoTimestampSchema.nullable(),
    lastSyncedAt: isoTimestampSchema.nullable(),
    lastErrorCode: z.string().min(1).nullable(),
    artifacts: z.array(jiraApprovedArtifactRecordSchema),
  })
  .strict()
  .superRefine((sync, ctx) => {
    if (sync.eligibilityReason === 'PENDING_ISSUE_VERIFICATION') {
      if (sync.eligible || sync.issueCreatedAt !== null || sync.status !== 'NOT_REQUIRED') {
        ctx.addIssue({
          code: 'custom',
          path: ['eligibilityReason'],
          message:
            'PENDING_ISSUE_VERIFICATION must remain ineligible and NOT_REQUIRED until Jira issue creation is verified.',
        });
      }
    }
    if (
      sync.eligibilityReason === 'NEW_ETA_TICKET' &&
      (!sync.eligible || sync.issueCreatedAt === null)
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['eligible'],
        message: 'NEW_ETA_TICKET requires eligible=true and issueCreatedAt.',
      });
    }
    if (
      sync.eligibilityReason === 'HISTORICAL_TICKET' &&
      (sync.eligible || sync.status !== 'NOT_REQUIRED')
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['eligible'],
        message: 'HISTORICAL_TICKET must remain ineligible with status NOT_REQUIRED.',
      });
    }
    if (sync.status === 'SYNCED') {
      if (
        sync.managedCommentId === null ||
        sync.contentHash === null ||
        sync.lastAttemptAt === null ||
        sync.lastSyncedAt === null ||
        sync.lastErrorCode !== null ||
        sync.artifacts.length === 0
      ) {
        ctx.addIssue({
          code: 'custom',
          path: ['status'],
          message:
            'SYNCED requires an attachment history, comment identity, content hash, attempt/sync timestamps, and no error code.',
        });
      }
    }
    if (sync.status === 'FAILED' && (sync.lastAttemptAt === null || sync.lastErrorCode === null)) {
      ctx.addIssue({
        code: 'custom',
        path: ['status'],
        message: 'FAILED requires lastAttemptAt and lastErrorCode.',
      });
    }

    for (const artifactType of ['ACCEPTANCE_CRITERIA', 'TEST_PLAN'] as const) {
      const current = sync.artifacts.filter(
        (artifact) => artifact.artifactType === artifactType && artifact.lifecycle === 'CURRENT',
      );
      if (current.length > 1) {
        ctx.addIssue({
          code: 'custom',
          path: ['artifacts'],
          message: `${artifactType} may have at most one CURRENT Jira attachment.`,
        });
      }
    }
  });

export const workflowStateSchema = z
  .object({
    schemaVersion: z.literal(SCHEMA_VERSION),
    // The optional patch segment must stay in step with releaseSchema, or a story on 1.0.1 can have no instance.
    workflowId: z
      .string()
      .regex(/^WF-[A-Z0-9-]+-R\d+\.\d+(\.\d+)?$/, 'workflowId must look like "WF-ABC-123-R1.0"'),
    workflowDefinition: z.string().min(1),
    jiraStoryId: jiraIdSchema,
    release: releaseSchema,
    capability: capabilitySchema,
    dataClassification: dataClassificationSchema.optional(),
    currentStage: workflowStageSchema,
    nextStage: workflowStageSchema.nullable(),
    lastSuccessfulStage: workflowStageSchema.nullable(),
    status: workflowStatusSchema,
    completedStages: z.array(
      z.object({
        stage: workflowStageSchema,
        completedAt: isoTimestampSchema,
        agent: z.string().nullable().optional(),
        outputs: z.array(z.string()),
      }),
    ),
    pendingApproval: z
      .object({
        gate: approvalGateSchema,
        reviewPackagePath: z.string().min(1),
        approvalTemplatePath: z.string().min(1),
        expectedApprovalPath: z.string().min(1).optional(),
        requestedAt: isoTimestampSchema,
      })
      .nullable(),
    inputArtifactVersions: z.record(z.string(), z.number().int().min(1)),
    outputArtifactPaths: z.array(z.string()),
    retryCount: z.number().int().min(0),
    createdAt: isoTimestampSchema,
    updatedAt: isoTimestampSchema,
    startedAt: isoTimestampSchema.nullable(),
    completedAt: isoTimestampSchema.nullable(),
    errorDetails: z
      .object({
        code: z.string().min(1),
        message: z.string().min(1),
        stage: workflowStageSchema.nullable().optional(),
        occurredAt: isoTimestampSchema,
        blocker: z.string().nullable().optional(),
      })
      .nullable(),
    processingLock: processingLockSchema.nullable(),
    assignedAgent: z
      .enum([
        'sdd-workflow-orchestrator',
        'jira-requirement-analysis',
        'OpenSpec',
        'playwright-test-planner',
        'playwright-test-generator',
        'playwright-test-healer',
        'bug-analyzer',
        'governed-locator-healer',
      ])
      .nullable(),
    // Optional so every workflow written before the failure-handling branch
    // existed stays valid. Present only once EXECUTION has recorded a failure.
    defectContext: z
      .object({
        activeDefectIds: z.array(z.string().regex(/^DEF-[A-Z0-9-]+-\d{3}$/)),
        healingAttemptCount: z.number().int().min(0).max(2),
      })
      .nullable()
      .optional(),
    // Absent on historical workflows. New workflows receive this only after Jira issue creation
    // time is read from the raw snapshot, so old tickets can never be updated by backfill.
    jiraAmbiguitySync: jiraAmbiguitySyncSchema.optional(),
    // Absent on historical workflows. Eligible new ETA workflows mirror only schema-valid,
    // approved Gate 1 and Gate 2 artifacts; repository approvals remain authoritative.
    jiraApprovedArtifactSync: jiraApprovedArtifactSyncSchema.optional(),
  })
  .strict()
  .superRefine((state, ctx) => {
    // A gate that is waiting for a human must describe what the human has to review.
    if (state.status === 'WAITING_FOR_HUMAN' && state.pendingApproval === null) {
      ctx.addIssue({
        code: 'custom',
        path: ['pendingApproval'],
        message: 'WAITING_FOR_HUMAN requires a pendingApproval block naming the gate and package.',
      });
    }
    if (state.status !== 'WAITING_FOR_HUMAN' && state.pendingApproval !== null) {
      ctx.addIssue({
        code: 'custom',
        path: ['pendingApproval'],
        message: 'pendingApproval must be null unless the workflow status is WAITING_FOR_HUMAN.',
      });
    }
    if (state.status === 'BLOCKED' && state.errorDetails === null) {
      ctx.addIssue({
        code: 'custom',
        path: ['errorDetails'],
        message: 'A BLOCKED workflow must record the exact blocker in errorDetails.',
      });
    }
    if (state.status === 'COMPLETED' && state.completedAt === null) {
      ctx.addIssue({
        code: 'custom',
        path: ['completedAt'],
        message: 'A COMPLETED workflow must record completedAt.',
      });
    }
    if (state.workflowId !== `WF-${state.jiraStoryId}-R${state.release}`) {
      ctx.addIssue({
        code: 'custom',
        path: ['workflowId'],
        message: `workflowId must be "WF-${state.jiraStoryId}-R${state.release}" (one instance per story and release).`,
      });
    }
    if (
      state.jiraAmbiguitySync !== undefined &&
      state.jiraApprovedArtifactSync !== undefined &&
      (state.jiraAmbiguitySync.eligible !== state.jiraApprovedArtifactSync.eligible ||
        state.jiraAmbiguitySync.eligibilityReason !==
          state.jiraApprovedArtifactSync.eligibilityReason ||
        state.jiraAmbiguitySync.issueCreatedAt !==
          state.jiraApprovedArtifactSync.issueCreatedAt)
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['jiraApprovedArtifactSync'],
        message:
          'jiraApprovedArtifactSync eligibility must exactly match jiraAmbiguitySync for the same Jira ticket.',
      });
    }

    const seenStages = new Set<string>();
    for (const completed of state.completedStages) {
      if (seenStages.has(completed.stage)) {
        ctx.addIssue({
          code: 'custom',
          path: ['completedStages'],
          message: `Stage "${completed.stage}" is recorded more than once. Stage execution must be idempotent.`,
        });
      }
      seenStages.add(completed.stage);
    }

    // The failure-handling branch may only be entered with a triaged defect in
    // hand, so a bug can never be filed without an artifact backing it.
    const failureStages = ['LOCATOR_HEALING', 'BUG_REPORTING'];
    if (failureStages.includes(state.currentStage)) {
      const active = state.defectContext?.activeDefectIds ?? [];
      if (active.length === 0) {
        ctx.addIssue({
          code: 'custom',
          path: ['defectContext'],
          message: `Stage "${state.currentStage}" requires defectContext.activeDefectIds to name at least one triaged defect.`,
        });
      }
    }
  });

export type WorkflowState = z.infer<typeof workflowStateSchema>;

/** Approval gate mapping enforced by the orchestrator. */
export const GATE_STAGES = {
  ACCEPTANCE_CRITERIA: { stage: 'AC_APPROVAL', next: 'OPENSPEC_GENERATION' },
  TEST_PLAN: { stage: 'TEST_PLAN_APPROVAL', next: 'BDD_DESIGN' },
  AUTOMATION_DESIGN: { stage: 'AUTOMATION_APPROVAL', next: 'PLAYWRIGHT_VALIDATION' },
} as const;
