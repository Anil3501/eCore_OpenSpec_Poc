import { z } from 'zod';
import {
  acIdSchema,
  artifactVersionSchema,
  capabilitySchema,
  dataClassificationSchema,
  isoTimestampSchema,
  jiraIdSchema,
  releaseSchema,
  requirementIdSchema,
  scenarioActionSchema,
  SCHEMA_VERSION,
  testPlanIdSchema,
  testScenarioIdSchema,
} from './common.model.ts';

export const testScenarioSchema = z.object({
  testScenarioId: testScenarioIdSchema,
  title: z.string().min(1),
  type: z.enum(['POSITIVE', 'NEGATIVE', 'BOUNDARY']),
  acIds: z.array(acIdSchema).min(1),
  preconditions: z.array(z.string()),
  steps: z.array(z.string()).min(1),
  expectedResult: z.string().min(1),
  testDataRequirements: z.array(z.string()),
  automationCandidate: z.boolean(),
  automationDecision: z
    .enum(['AUTOMATE', 'MANUAL_ONLY', 'DEFERRED', 'REVIEW_REQUIRED'])
    .optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH']),
  riskTag: z.string().nullable().optional(),
  suiteTag: z.string().nullable().optional(),
  scenarioAction: scenarioActionSchema.optional(),
});

export const testPlanSchema = z
  .object({
    schemaVersion: z.literal(SCHEMA_VERSION),
    testPlanId: testPlanIdSchema,
    artifactVersion: artifactVersionSchema,
    release: releaseSchema,
    capability: capabilitySchema,
    jiraStoryIds: z.array(jiraIdSchema).min(1),
    requirementIds: z.array(requirementIdSchema).min(1),
    acIds: z.array(acIdSchema).min(1),
    openSpecRefs: z.array(z.string()).optional(),
    objective: z.string().min(1),
    scope: z.object({
      inScope: z.array(z.string()),
      outOfScope: z.array(z.string()),
    }),
    assumptions: z.array(z.string()),
    dependencies: z.array(z.string()),
    risks: z.array(
      z.object({
        riskId: z.string().min(1),
        description: z.string().min(1),
        level: z.enum(['LOW', 'MEDIUM', 'HIGH']),
        mitigation: z.string().nullable().optional(),
      }),
    ),
    scenarios: z.array(testScenarioSchema).min(1),
    environmentRequirements: z.object({
      environment: z.enum(['local', 'dev', 'qa', 'uat', 'staging']),
      notes: z.array(z.string()),
    }),
    entryCriteria: z.array(z.string()).min(1),
    exitCriteria: z.array(z.string()).min(1),
    coverageMappings: z.array(
      z.object({
        acId: acIdSchema,
        testScenarioIds: z.array(testScenarioIdSchema),
      }),
    ),
    clarifications: z.array(
      z.object({
        clarificationId: z.string().min(1),
        question: z.string().min(1),
        status: z.enum(['REVIEW_REQUIRED', 'RESOLVED', 'DEFERRED']),
      }),
    ),
    approvalStatus: z.enum([
      'PENDING_TEST_PLAN_APPROVAL',
      'APPROVED',
      'REJECTED',
      'DEFERRED',
      'REQUEST_CHANGES',
      'REVIEW_REQUIRED',
    ]),
    approvalRef: z.string().nullable().optional(),
    dataClassification: dataClassificationSchema,
    timestamps: z.object({
      createdAt: isoTimestampSchema,
      updatedAt: isoTimestampSchema,
      approvedAt: isoTimestampSchema.nullable().optional(),
    }),
  })
  .strict()
  .superRefine((plan, ctx) => {
    const scenarioIds = new Set<string>();
    for (const scenario of plan.scenarios) {
      if (scenarioIds.has(scenario.testScenarioId)) {
        ctx.addIssue({
          code: 'custom',
          path: ['scenarios'],
          message: `Duplicate testScenarioId "${scenario.testScenarioId}".`,
        });
      }
      scenarioIds.add(scenario.testScenarioId);

      // No orphan scenarios: every scenario must trace back to a declared AC.
      for (const acId of scenario.acIds) {
        if (!plan.acIds.includes(acId)) {
          ctx.addIssue({
            code: 'custom',
            path: ['scenarios'],
            message: `${scenario.testScenarioId} references "${acId}", which is not listed in the plan acIds.`,
          });
        }
      }
    }

    for (const mapping of plan.coverageMappings) {
      if (!plan.acIds.includes(mapping.acId)) {
        ctx.addIssue({
          code: 'custom',
          path: ['coverageMappings'],
          message: `coverageMappings references unknown acId "${mapping.acId}".`,
        });
      }
      for (const scenarioId of mapping.testScenarioIds) {
        if (!scenarioIds.has(scenarioId)) {
          ctx.addIssue({
            code: 'custom',
            path: ['coverageMappings'],
            message: `coverageMappings references unknown testScenarioId "${scenarioId}".`,
          });
        }
      }
    }

    if (plan.approvalStatus === 'APPROVED' && !plan.approvalRef) {
      ctx.addIssue({
        code: 'custom',
        path: ['approvalRef'],
        message: 'An APPROVED test plan must reference its validated approval artifact.',
      });
    }
  });

export type TestPlan = z.infer<typeof testPlanSchema>;
export type TestScenario = z.infer<typeof testScenarioSchema>;
