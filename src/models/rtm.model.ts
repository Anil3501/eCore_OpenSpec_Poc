import { z } from 'zod';
import {
  acIdSchema,
  artifactVersionSchema,
  capabilitySchema,
  changeTypeSchema,
  dataClassificationSchema,
  executionResultSchema,
  isoTimestampSchema,
  jiraIdSchema,
  releaseSchema,
  requirementIdSchema,
  scenarioActionSchema,
  SCHEMA_VERSION,
  testPlanIdSchema,
  testScenarioIdSchema,
  traceIdSchema,
} from './common.model.ts';

const artifactRefSchema = z.object({
  path: z.string().min(1),
  version: artifactVersionSchema,
});

export const rtmEntrySchema = z.object({
  traceId: traceIdSchema,
  jiraStoryId: jiraIdSchema,
  requirementId: requirementIdSchema,
  acId: acIdSchema,
  status: z.enum([
    'PENDING_APPROVAL',
    'APPROVED',
    'REJECTED',
    'DEFERRED',
    'REQUEST_CHANGES',
    'REVIEW_REQUIRED',
    'BLOCKED',
  ]),
  changeType: changeTypeSchema,
  requirementArtifact: artifactRefSchema,
  approvalRefs: z.object({
    acceptanceCriteria: z.string().nullable(),
    testPlan: z.string().nullable(),
    automationDesign: z.string().nullable(),
  }),
  openSpecRefs: z.array(z.string()),
  testPlan: z
    .object({
      testPlanId: testPlanIdSchema,
      testScenarioId: testScenarioIdSchema,
      path: z.string().min(1),
      version: artifactVersionSchema,
    })
    .nullable(),
  automation: z
    .object({
      featureFile: z.string().min(1),
      gherkinScenario: z.string().min(1),
      stepDefinitions: z.array(z.string()),
      pageObjects: z.array(z.string()),
      components: z.array(z.string()).optional(),
      fixtures: z.array(z.string()),
      generatedTest: z.string().nullable(),
      automationStatus: z.enum([
        'DESIGNED',
        'IMPLEMENTED',
        'EXECUTABLE',
        'MANUAL_ONLY',
        'BLOCKED',
        'RETIRED',
        'REVIEW_REQUIRED',
      ]),
      scenarioAction: scenarioActionSchema.optional(),
    })
    .nullable(),
  executionRefs: z.array(
    z.object({
      executionId: z.string().min(1),
      result: executionResultSchema,
      recordPath: z.string().min(1),
    }),
  ),
  // Optional so every pre-existing RTM partition stays valid. Populated by the
  // orchestrator when it merges a bug-analyzer proposal.
  defectRefs: z
    .array(
      z.object({
        defectId: z.string().regex(/^DEF-[A-Z0-9-]+-\d{3}$/),
        status: z.enum(['TRIAGED', 'HEALING', 'HEALED', 'REPORTED', 'DUPLICATE', 'BLOCKED', 'REVIEW_REQUIRED']),
        recordPath: z.string().min(1),
        jiraIssueKey: z.string().nullable(),
      }),
    )
    .optional(),
});

export const rtmSchema = z
  .object({
    schemaVersion: z.literal(SCHEMA_VERSION),
    capability: capabilitySchema,
    release: releaseSchema,
    artifactVersion: artifactVersionSchema,
    dataClassification: dataClassificationSchema,
    updatedAt: isoTimestampSchema,
    entries: z.array(rtmEntrySchema),
  })
  .strict()
  .superRefine((rtm, ctx) => {
    const traceIds = new Set<string>();
    for (const entry of rtm.entries) {
      if (traceIds.has(entry.traceId)) {
        ctx.addIssue({
          code: 'custom',
          path: ['entries'],
          message: `Duplicate traceId "${entry.traceId}" in capability "${rtm.capability}".`,
        });
      }
      traceIds.add(entry.traceId);

      // Every active automation mapping must reference an approved AC.
      const isActiveAutomation =
        entry.automation !== null &&
        ['IMPLEMENTED', 'EXECUTABLE'].includes(entry.automation.automationStatus);
      if (isActiveAutomation && entry.status !== 'APPROVED') {
        ctx.addIssue({
          code: 'custom',
          path: ['entries'],
          message: `${entry.traceId}: active automation requires an APPROVED acceptance criterion (found "${entry.status}").`,
        });
      }
      if (isActiveAutomation && entry.approvalRefs.acceptanceCriteria === null) {
        ctx.addIssue({
          code: 'custom',
          path: ['entries'],
          message: `${entry.traceId}: active automation requires recorded acceptance criteria approval evidence.`,
        });
      }

      // No feature scenario without a Test Scenario ID.
      if (entry.automation !== null && entry.testPlan === null) {
        ctx.addIssue({
          code: 'custom',
          path: ['entries'],
          message: `${entry.traceId}: an automation mapping must reference a Test Scenario ID from an approved test plan.`,
        });
      }

      // Success may never be claimed without a real execution record.
      for (const execution of entry.executionRefs) {
        if (execution.result === 'PASSED' && execution.recordPath.trim() === '') {
          ctx.addIssue({
            code: 'custom',
            path: ['entries'],
            message: `${entry.traceId}: a PASSED result requires a real execution record path.`,
          });
        }
      }
    }
  });

export const coverageMatrixSchema = z
  .object({
    schemaVersion: z.literal(SCHEMA_VERSION),
    capability: capabilitySchema,
    release: releaseSchema,
    generatedAt: isoTimestampSchema,
    dataClassification: dataClassificationSchema,
    sourceRtm: artifactRefSchema,
    totals: z.object({
      approvedAcs: z.number().int().min(0),
      approvedAcsLinkedToApprovedScenarios: z.number().int().min(0),
      approvedAcsLinkedToExecutableAutomation: z.number().int().min(0),
      automatedAcsExecuted: z.number().int().min(0),
      executedAcsPassed: z.number().int().min(0),
    }),
    coverage: z.object({
      acDesignCoveragePct: z.number().min(0).max(100).nullable(),
      automationCoveragePct: z.number().min(0).max(100).nullable(),
      executionCoveragePct: z.number().min(0).max(100).nullable(),
      passCoveragePct: z.number().min(0).max(100).nullable(),
    }),
    gaps: z.object({
      uncoveredAcIds: z.array(acIdSchema),
      deferredAcIds: z.array(acIdSchema),
      blockedAcIds: z.array(acIdSchema),
      manualOnlyAcIds: z.array(acIdSchema),
      failedAcIds: z.array(acIdSchema),
      clarificationRequiredAcIds: z.array(acIdSchema),
    }),
    notes: z.array(z.string()).optional(),
  })
  .strict();

const pointerMapSchema = z.record(
  z.string(),
  z
    .array(
      z.object({
        capability: capabilitySchema,
        rtmPath: z.string().min(1),
        traceIds: z.array(z.string()).optional(),
      }),
    )
    .min(1),
);

export const lookupIndexSchema = z
  .object({
    schemaVersion: z.literal(SCHEMA_VERSION),
    release: releaseSchema,
    updatedAt: isoTimestampSchema,
    dataClassification: z.enum(['REAL_JIRA_DATA', 'SAMPLE_DATA', 'MIXED_NOT_ALLOWED']),
    indexes: z.object({
      byJiraStoryId: pointerMapSchema,
      byRequirementId: pointerMapSchema,
      byAcId: pointerMapSchema,
      byTestPlanId: pointerMapSchema,
      byTestScenarioId: pointerMapSchema,
      byFeatureFile: pointerMapSchema,
      byExecutionId: pointerMapSchema,
      byDefectId: pointerMapSchema,
    }),
  })
  .strict();

export type RtmEntry = z.infer<typeof rtmEntrySchema>;
export type Rtm = z.infer<typeof rtmSchema>;
export type CoverageMatrix = z.infer<typeof coverageMatrixSchema>;
export type LookupIndex = z.infer<typeof lookupIndexSchema>;

/**
 * Recomputes the four coverage measures strictly from RTM data.
 * Returns null for any measure whose denominator is unavailable, so that a
 * missing-data situation can never be reported as 100%.
 */
export function computeCoverage(rtm: Rtm): CoverageMatrix['coverage'] & {
  totals: CoverageMatrix['totals'];
} {
  const approved = rtm.entries.filter((entry) => entry.status === 'APPROVED');
  const approvedAcs = new Set(approved.map((entry) => entry.acId));

  const linkedToScenario = new Set(
    approved.filter((entry) => entry.testPlan !== null).map((entry) => entry.acId),
  );

  const linkedToAutomation = new Set(
    approved
      .filter(
        (entry) =>
          entry.automation !== null &&
          ['IMPLEMENTED', 'EXECUTABLE'].includes(entry.automation.automationStatus),
      )
      .map((entry) => entry.acId),
  );

  const executed = new Set(
    approved
      .filter((entry) =>
        entry.executionRefs.some((execution) =>
          ['PASSED', 'FAILED', 'SKIPPED', 'TIMED_OUT'].includes(execution.result),
        ),
      )
      .map((entry) => entry.acId),
  );

  const passed = new Set(
    approved
      .filter((entry) => {
        const latest = entry.executionRefs.at(-1);
        return latest !== undefined && latest.result === 'PASSED';
      })
      .map((entry) => entry.acId),
  );

  const pct = (numerator: number, denominator: number): number | null =>
    denominator === 0 ? null : Math.round((numerator / denominator) * 10000) / 100;

  return {
    totals: {
      approvedAcs: approvedAcs.size,
      approvedAcsLinkedToApprovedScenarios: linkedToScenario.size,
      approvedAcsLinkedToExecutableAutomation: linkedToAutomation.size,
      automatedAcsExecuted: executed.size,
      executedAcsPassed: passed.size,
    },
    acDesignCoveragePct: pct(linkedToScenario.size, approvedAcs.size),
    automationCoveragePct: pct(linkedToAutomation.size, approvedAcs.size),
    executionCoveragePct: pct(executed.size, linkedToAutomation.size),
    passCoveragePct: pct(passed.size, executed.size),
  };
}
