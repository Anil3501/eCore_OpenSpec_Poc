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
