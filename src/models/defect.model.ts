import { z } from 'zod';
import {
  acIdSchema,
  artifactVersionSchema,
  capabilitySchema,
  dataClassificationSchema,
  defectIdSchema,
  executionIdSchema,
  interfaceTypeSchema,
  isoTimestampSchema,
  jiraIdSchema,
  releaseSchema,
  requirementIdSchema,
  SCHEMA_VERSION,
  testPlanIdSchema,
  testScenarioIdSchema,
} from './common.model.ts';

/**
 * Defect reports are evidence, not claims.
 *
 * A defect may only exist for a failure that a real execution artifact recorded.
 * Locator-suspect failures must survive two governed healing attempts before
 * they are allowed to become a Jira bug, and a healed locator is never a bug.
 */

export const defectClassificationSchema = z.enum([
  'LOCATOR_SUSPECT',
  'APPLICATION_DEFECT',
  'AMBIGUOUS',
  'LOCATOR_UNHEALABLE',
  'ENVIRONMENT_BLOCKER',
  // The API answered, but not as the approved contract says it should. There is
  // no locator to repair, so this never enters LOCATOR_HEALING - either the
  // application changed or the agreed contract is wrong, and both are human
  // decisions rather than something a test may quietly absorb.
  'CONTRACT_MISMATCH',
  'HEALED',
  'REVIEW_REQUIRED',
]);

export const defectStatusSchema = z.enum([
  'TRIAGED',
  'HEALING',
  'HEALED',
  'REPORTED',
  'DUPLICATE',
  'BLOCKED',
  'REVIEW_REQUIRED',
]);

export const healingOutcomeSchema = z.enum(['HEALED', 'NOT_HEALED', 'NOT_ATTEMPTED']);

/**
 * A recorded request/response pair.
 *
 * This is the evidence an API-only failure has instead of a screenshot. Headers
 * and bodies are redacted before they are written - a defect artifact is a
 * governed file, not a place to leak an authorization token.
 */
export const apiExchangeSchema = z
  .object({
    method: z.string().min(1),
    /** Path only. A full URL would re-introduce the host and any query secrets. */
    path: z.string().min(1),
    expectedStatusCodes: z.array(z.number().int().min(100).max(599)).min(1),
    actualStatus: z.number().int().min(100).max(599),
    contractViolations: z.array(z.string()),
    redactedResponseBody: z.string(),
  })
  .strict();

export const healingAttemptSchema = z.object({
  attemptNumber: z.number().int().min(1).max(2),
  attemptedAt: isoTimestampSchema,
  agent: z.string().min(1),
  filesChanged: z.array(z.string().min(1)),
  rerunResult: z.enum(['PASSED', 'FAILED', 'TIMED_OUT']),
  notes: z.string(),
});

export const jiraLinkSchema = z.object({
  issueKey: jiraIdSchema,
  issueUrl: z.string().min(1),
  projectKey: z.string().min(1),
  issueType: z.string().min(1),
  // Copied verbatim from the story under test. An empty list is a hard failure
  // rather than an invitation to invent a version.
  fixVersions: z.array(z.string().min(1)).min(1),
  linkedStory: jiraIdSchema,
  linkType: z.string().min(1),
  assigneeAccountId: z.string().min(1),
  attachmentsUploaded: z.array(z.string().min(1)),
  createdAt: isoTimestampSchema,
  createdVia: z.enum(['ATLASSIAN_MCP', 'JIRA_REST']),
  dedupeOf: z.string().nullable(),
});

export const defectReportSchema = z
  .object({
    schemaVersion: z.literal(SCHEMA_VERSION),
    defectId: defectIdSchema,
    release: releaseSchema,
    capability: capabilitySchema,
    jiraStoryId: jiraIdSchema,
    dataClassification: dataClassificationSchema,
    executionId: executionIdSchema,
    executionRecordPath: z.string().min(1),
    testPlanId: testPlanIdSchema,
    testScenarioId: testScenarioIdSchema,
    acId: acIdSchema,
    requirementId: requirementIdSchema,
    featureFile: z.string().min(1),
    gherkinScenario: z.string().min(1),
    // Optional so a defect written before API support stays valid. Absent is UI.
    interfaceType: interfaceTypeSchema.optional(),
    classification: defectClassificationSchema,
    classificationRationale: z.string().min(1),
    fingerprint: z.string().regex(/^[a-f0-9]{64}$/, 'fingerprint must be a sha256 hex digest'),
    failure: z.object({
      errorMessage: z.string().min(1),
      errorStack: z.string().nullable(),
      durationSeconds: z.number().min(0),
      retryIndex: z.number().int().min(0),
      observedBehaviour: z.string().min(1),
      expectedBehaviour: z.string().min(1),
    }),
    evidence: z.object({
      screenshots: z.array(z.string().min(1)),
      traceFiles: z.array(z.string().min(1)),
      playwrightReport: z.string().nullable(),
      attachmentsWithheld: z.boolean(),
      // An API-only scenario produces no screenshot; this is its evidence.
      apiExchanges: z.array(apiExchangeSchema).optional(),
    }),
    healing: z.object({
      attempts: z.array(healingAttemptSchema).max(2),
      outcome: healingOutcomeSchema,
    }),
    jira: jiraLinkSchema.nullable(),
    status: defectStatusSchema,
    artifactVersion: artifactVersionSchema,
    createdAt: isoTimestampSchema,
    updatedAt: isoTimestampSchema,
    notes: z.array(z.string()),
  })
  .strict()
  .superRefine((defect, ctx) => {
    // The acceptance criterion must belong to the story the defect claims.
    if (!defect.acId.startsWith(`AC-${defect.jiraStoryId}-`)) {
      ctx.addIssue({
        code: 'custom',
        path: ['acId'],
        message: `${defect.acId} does not belong to story ${defect.jiraStoryId}.`,
      });
    }
    if (!defect.requirementId.startsWith(`REQ-${defect.jiraStoryId}-`)) {
      ctx.addIssue({
        code: 'custom',
        path: ['requirementId'],
        message: `${defect.requirementId} does not belong to story ${defect.jiraStoryId}.`,
      });
    }

    // Attempt numbers must be sequential so an attempt can never be skipped.
    defect.healing.attempts.forEach((attempt, index) => {
      if (attempt.attemptNumber !== index + 1) {
        ctx.addIssue({
          code: 'custom',
          path: ['healing', 'attempts', index, 'attemptNumber'],
          message: `Healing attempts must be numbered sequentially; expected ${index + 1}.`,
        });
      }
    });

    const healedAttempt = defect.healing.attempts.some((a) => a.rerunResult === 'PASSED');

    if (defect.healing.outcome === 'HEALED' && !healedAttempt) {
      ctx.addIssue({
        code: 'custom',
        path: ['healing', 'outcome'],
        message: 'HEALED requires a recorded re-run whose result is PASSED. Never declare a heal without one.',
      });
    }

    if (defect.healing.outcome === 'NOT_ATTEMPTED' && defect.healing.attempts.length > 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['healing', 'outcome'],
        message: 'NOT_ATTEMPTED contradicts the recorded healing attempts.',
      });
    }

    // An application defect must never be "healed" - that would hide it.
    if (defect.classification === 'APPLICATION_DEFECT' && defect.healing.attempts.length > 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['healing', 'attempts'],
        message:
          'An APPLICATION_DEFECT must not be sent to the locator healer. Healing it would mask a real failure.',
      });
    }

    // There is no locator to repair when no element was ever involved. Without
    // this rule an API failure classified AMBIGUOUS would be routed to healing,
    // burn both attempts against a DOM the test never touched, and then be
    // filed as a locator bug it never was.
    const exercisesApi = defect.interfaceType === 'API' || defect.interfaceType === 'HYBRID';
    const healingClassifications = ['LOCATOR_SUSPECT', 'LOCATOR_UNHEALABLE'];
    if (defect.interfaceType === 'API' && healingClassifications.includes(defect.classification)) {
      ctx.addIssue({
        code: 'custom',
        path: ['classification'],
        message: `An API scenario cannot be "${defect.classification}". It exercises no locator. Use CONTRACT_MISMATCH, APPLICATION_DEFECT or ENVIRONMENT_BLOCKER.`,
      });
    }

    if (defect.classification === 'CONTRACT_MISMATCH') {
      if (!exercisesApi) {
        ctx.addIssue({
          code: 'custom',
          path: ['classification'],
          message: 'CONTRACT_MISMATCH requires interfaceType API or HYBRID. A UI scenario has no contract to violate.',
        });
      }
      if (defect.healing.attempts.length > 0) {
        ctx.addIssue({
          code: 'custom',
          path: ['healing', 'attempts'],
          message:
            'A CONTRACT_MISMATCH must not enter locator healing. Either the application changed or the agreed contract is wrong; both are human decisions.',
        });
      }
      if ((defect.evidence.apiExchanges ?? []).length === 0) {
        ctx.addIssue({
          code: 'custom',
          path: ['evidence', 'apiExchanges'],
          message:
            'A CONTRACT_MISMATCH must record the request/response exchange that violated the contract. Without it the claim is unevidenced.',
        });
      }
    }

    // The application was never reached, so nothing can be concluded about it.
    if (defect.classification === 'ENVIRONMENT_BLOCKER') {
      if (defect.healing.attempts.length > 0) {
        ctx.addIssue({
          code: 'custom',
          path: ['healing', 'attempts'],
          message: 'An ENVIRONMENT_BLOCKER cannot be healed. The application was never reached.',
        });
      }
      if (defect.status !== 'BLOCKED') {
        ctx.addIssue({
          code: 'custom',
          path: ['status'],
          message:
            'An ENVIRONMENT_BLOCKER must be BLOCKED. Filing an unreachable host as a product bug wastes a developer\'s time.',
        });
      }
      if (defect.jira !== null) {
        ctx.addIssue({
          code: 'custom',
          path: ['jira'],
          message: 'An ENVIRONMENT_BLOCKER must never be filed in Jira. Restore access and re-run instead.',
        });
      }
    }

    // Unhealable means the cap was genuinely exhausted.
    if (defect.classification === 'LOCATOR_UNHEALABLE') {
      if (defect.healing.attempts.length !== 2) {
        ctx.addIssue({
          code: 'custom',
          path: ['healing', 'attempts'],
          message: 'LOCATOR_UNHEALABLE requires exactly two recorded healing attempts.',
        });
      }
      if (healedAttempt) {
        ctx.addIssue({
          code: 'custom',
          path: ['classification'],
          message: 'LOCATOR_UNHEALABLE contradicts a healing attempt that re-ran green.',
        });
      }
    }

    // A healed locator is not a bug and must never reach Jira.
    if (defect.status === 'HEALED' && defect.jira !== null) {
      ctx.addIssue({
        code: 'custom',
        path: ['jira'],
        message: 'A HEALED defect must not carry a Jira issue. A stale locator is not an application bug.',
      });
    }

    if (defect.status === 'REPORTED') {
      if (defect.jira === null) {
        ctx.addIssue({
          code: 'custom',
          path: ['jira'],
          message: 'REPORTED requires a Jira issue record. A chat message is never evidence of reporting.',
        });
      } else if (defect.jira.linkedStory !== defect.jiraStoryId) {
        ctx.addIssue({
          code: 'custom',
          path: ['jira', 'linkedStory'],
          message: `The bug must be linked to ${defect.jiraStoryId}, not ${defect.jira.linkedStory}.`,
        });
      }
    }

    if (defect.status === 'DUPLICATE' && (defect.jira === null || defect.jira.dedupeOf === null)) {
      ctx.addIssue({
        code: 'custom',
        path: ['jira', 'dedupeOf'],
        message: 'DUPLICATE requires dedupeOf to name the pre-existing Jira issue.',
      });
    }
  });

export type DefectReport = z.infer<typeof defectReportSchema>;
export type HealingAttempt = z.infer<typeof healingAttemptSchema>;

/**
 * Returns the attempt number the healer may use next, or null when the
 * two-attempt cap is already exhausted.
 */
export function nextHealingAttempt(defect: DefectReport): number | null {
  const used = defect.healing.attempts.length;
  return used >= 2 ? null : used + 1;
}

/** True when the defect has exhausted healing and is eligible for Jira reporting. */
export function isReportable(defect: DefectReport): boolean {
  if (defect.classification === 'ENVIRONMENT_BLOCKER') return false;
  if (defect.classification === 'APPLICATION_DEFECT') return true;
  return defect.classification === 'LOCATOR_UNHEALABLE' && defect.healing.outcome === 'NOT_HEALED';
}
