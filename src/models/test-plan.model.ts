import { z } from 'zod';
import {
  acIdSchema,
  artifactVersionSchema,
  AUTHORITATIVE_CONTRACT_SOURCES,
  capabilitySchema,
  contractSourceSchema,
  dataClassificationSchema,
  httpMethodSchema,
  interfaceTypeSchema,
  isoTimestampSchema,
  jiraIdSchema,
  releaseSchema,
  requirementIdSchema,
  scenarioActionSchema,
  SCHEMA_VERSION,
  testPlanIdSchema,
  testScenarioIdSchema,
} from './common.model.ts';

/**
 * The API surface a scenario exercises, agreed at Gate 2.
 *
 * `contractProvenance` is what makes `contractSource` auditable: an OpenAPI URL,
 * the `APR-TP-*` approval that agreed it, or the validation report the traffic
 * was observed in. A source without a provenance is an unsourced claim.
 */
export const apiContractSchema = z
  .object({
    method: httpMethodSchema,
    path: z.string().min(1),
    expectedStatusCodes: z.array(z.number().int().min(100).max(599)).min(1),
    contractSource: contractSourceSchema,
    contractProvenance: z.string().min(1),
    /** Path to the Zod response contract, once one exists. */
    responseContractRef: z.string().min(1).nullable().optional(),
    /**
     * True when the call only reaches a state the scenario then asserts
     * elsewhere. Scaffolding proves nothing and never counts as AC coverage.
     */
    scaffoldingOnly: z.boolean().optional(),
  })
  .strict();

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
  // Optional so plans approved before API support remain valid unedited.
  interfaceType: interfaceTypeSchema.optional(),
  apiContract: apiContractSchema.optional(),
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

      const interfaceType = scenario.interfaceType ?? 'UI';
      const exercisesApi = interfaceType === 'API' || interfaceType === 'HYBRID';

      if (exercisesApi && scenario.apiContract === undefined) {
        ctx.addIssue({
          code: 'custom',
          path: ['scenarios'],
          message: `${scenario.testScenarioId} declares interfaceType "${interfaceType}" but no apiContract. An API scenario without a contract is a guessed endpoint.`,
        });
      }
      if (!exercisesApi && scenario.apiContract !== undefined) {
        ctx.addIssue({
          code: 'custom',
          path: ['scenarios'],
          message: `${scenario.testScenarioId} declares an apiContract but interfaceType is "${interfaceType}". Set interfaceType to API or HYBRID.`,
        });
      }

      // Gate 2 is where an OBSERVED contract becomes HUMAN_APPROVED. Approving a
      // plan that still asserts against observed traffic would bless whatever
      // the application currently does as the expected result.
      const contract = scenario.apiContract;
      if (
        plan.approvalStatus === 'APPROVED' &&
        contract !== undefined &&
        contract.scaffoldingOnly !== true &&
        !AUTHORITATIVE_CONTRACT_SOURCES.includes(contract.contractSource)
      ) {
        ctx.addIssue({
          code: 'custom',
          path: ['scenarios'],
          message: `${scenario.testScenarioId} asserts an acceptance criterion against a "${contract.contractSource}" contract. An approved plan requires OPENAPI or HUMAN_APPROVED, or the contract must be marked scaffoldingOnly.`,
        });
      }

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
