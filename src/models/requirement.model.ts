import { z } from 'zod';
import {
  acIdSchema,
  ambiguityIdSchema,
  artifactVersionSchema,
  capabilitySchema,
  changeTypeSchema,
  dataClassificationSchema,
  isoTimestampSchema,
  jiraIdSchema,
  releaseSchema,
  requirementIdSchema,
  SCHEMA_VERSION,
  sourceTypeSchema,
  statusSchema,
} from './common.model.ts';

export const requirementSchema = z.object({
  requirementId: requirementIdSchema,
  description: z.string().min(1),
  originalText: z.string().nullable(),
  sourceType: sourceTypeSchema,
  status: statusSchema,
  version: artifactVersionSchema,
  changeType: changeTypeSchema.optional(),
});

export const acceptanceCriterionSchema = z
  .object({
    acId: acIdSchema,
    requirementId: requirementIdSchema,
    description: z.string().min(1),
    originalText: z.string().nullable(),
    given: z.string().min(1),
    when: z.string().min(1),
    then: z.string().min(1),
    sourceType: sourceTypeSchema,
    status: statusSchema,
    version: artifactVersionSchema,
    rationale: z.string().nullable(),
    clarificationRefs: z.array(ambiguityIdSchema),
    changeType: changeTypeSchema.optional(),
  })
  .superRefine((ac, ctx) => {
    // Proposed ACs must always justify themselves.
    if (ac.sourceType === 'PROPOSED_BY_REQUIREMENT_ANALYSIS') {
      if (ac.rationale === null || ac.rationale.trim() === '') {
        ctx.addIssue({
          code: 'custom',
          path: ['rationale'],
          message: `${ac.acId}: PROPOSED_BY_REQUIREMENT_ANALYSIS requires a non-empty rationale.`,
        });
      }
    }
    // Extracted ACs must preserve the original Jira wording verbatim.
    if (ac.sourceType === 'EXTRACTED_FROM_JIRA') {
      if (ac.originalText === null || ac.originalText.trim() === '') {
        ctx.addIssue({
          code: 'custom',
          path: ['originalText'],
          message: `${ac.acId}: EXTRACTED_FROM_JIRA must preserve the original Jira wording in originalText.`,
        });
      }
    }
  });

/**
 * An ambiguity has its own lifecycle, separate from the approval status used by
 * requirements and acceptance criteria. It is raised by analysis and closed only
 * by a human answer - never by an agent deciding the question itself.
 */
export const ambiguityStatusSchema = z.enum(['REVIEW_REQUIRED', 'RESOLVED', 'DEFERRED']);

export const ambiguitySchema = z
  .object({
    ambiguityId: ambiguityIdSchema,
    question: z.string().min(1),
    impact: z.string().min(1),
    relatedTo: z.array(z.string()),
    status: ambiguityStatusSchema,
    resolution: z.string().min(1).nullable().optional(),
    resolvedBy: z.string().min(1).nullable().optional(),
    resolvedAt: z.string().datetime().nullable().optional(),
  })
  .superRefine((ambiguity, ctx) => {
    if (ambiguity.status !== 'RESOLVED') return;
    if (!ambiguity.resolution) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['resolution'],
        message: `${ambiguity.ambiguityId}: a RESOLVED ambiguity must record the answer that closed it.`,
      });
    }
    if (!ambiguity.resolvedBy) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['resolvedBy'],
        message: `${ambiguity.ambiguityId}: a RESOLVED ambiguity must record who answered it. An agent is never a valid answer.`,
      });
    }
  });

export const jiraStorySchema = z.object({
  jiraId: jiraIdSchema,
  summary: z.string().min(1),
  description: z.string(),
  issueType: z.string().min(1),
  priority: z.string().nullable(),
  status: z.string().nullable(),
  labels: z.array(z.string()),
  components: z.array(z.string()),
  parent: z
    .object({ jiraId: jiraIdSchema, summary: z.string() })
    .nullable(),
  linkedIssues: z.array(
    z.object({
      jiraId: jiraIdSchema,
      linkType: z.string(),
      summary: z.string(),
    }),
  ),
  sourceRef: z
    .string()
    .regex(/^https:\/\/[a-z0-9.-]+\/browse\/[A-Z][A-Z0-9]+-[0-9]+$/)
    .nullable(),
});

export const requirementSourceSchema = z
  .object({
    system: z.enum(['JIRA', 'SAMPLE_DATA']),
    // ATLASSIAN_MCP is the primary path. JIRA_REST_API is the documented fallback
    // (src/utils/jira-fetch.ts) for sessions where the MCP server exposes no
    // issue-fetch tool. Both describe a genuine retrieval; neither may be claimed
    // without a real snapshot on disk.
    retrievedVia: z.enum(['ATLASSIAN_MCP', 'JIRA_REST_API', 'SAMPLE_DATA']),
    dataClassification: dataClassificationSchema,
    // The governed copy under requirements/raw/, never the ungoverned fetch snapshot in reports/jira/.
    rawSnapshotPath: z
      .string()
      .regex(/^requirements\/raw\/[A-Z][A-Z0-9]+-[0-9]+\.json$/)
      .nullable(),
    retrievedAt: isoTimestampSchema,
  })
  .superRefine((source, ctx) => {
    // Synthetic data must remain clearly separated from real Jira data.
    if (source.dataClassification === 'SAMPLE_DATA') {
      if (source.system !== 'SAMPLE_DATA' || source.retrievedVia !== 'SAMPLE_DATA') {
        ctx.addIssue({
          code: 'custom',
          path: ['dataClassification'],
          message:
            'SAMPLE_DATA artifacts must declare system=SAMPLE_DATA and retrievedVia=SAMPLE_DATA.',
        });
      }
    }
    if (source.dataClassification === 'REAL_JIRA_DATA') {
      const realRetrievalMethods = ['ATLASSIAN_MCP', 'JIRA_REST_API'];
      if (source.system !== 'JIRA' || !realRetrievalMethods.includes(source.retrievedVia)) {
        ctx.addIssue({
          code: 'custom',
          path: ['dataClassification'],
          message:
            'REAL_JIRA_DATA artifacts must declare system=JIRA and retrievedVia=ATLASSIAN_MCP or JIRA_REST_API.',
        });
      }
    }
  });

export const jiraRequirementArtifactSchema = z
  .object({
    schemaVersion: z.literal(SCHEMA_VERSION),
    artifactVersion: artifactVersionSchema,
    release: releaseSchema,
    capability: capabilitySchema,
    supersedes: z.number().int().min(1).nullable().optional(),
    changeType: changeTypeSchema.optional(),
    story: jiraStorySchema,
    requirements: z.array(requirementSchema).min(1),
    acceptanceCriteria: z.array(acceptanceCriterionSchema),
    ambiguities: z.array(ambiguitySchema),
    source: requirementSourceSchema,
    approvalStatus: statusSchema,
    approvalRef: z.string().min(1).nullable().optional(),
    timestamps: z.object({
      createdAt: isoTimestampSchema,
      updatedAt: isoTimestampSchema,
      approvedAt: isoTimestampSchema.nullable().optional(),
    }),
  })
  .strict()
  .superRefine((artifact, ctx) => {
    const requirementIds = new Set<string>();
    for (const requirement of artifact.requirements) {
      if (requirementIds.has(requirement.requirementId)) {
        ctx.addIssue({
          code: 'custom',
          path: ['requirements'],
          message: `Duplicate requirementId "${requirement.requirementId}" within ${artifact.story.jiraId}.`,
        });
      }
      requirementIds.add(requirement.requirementId);
    }

    const acIds = new Set<string>();
    for (const ac of artifact.acceptanceCriteria) {
      if (acIds.has(ac.acId)) {
        ctx.addIssue({
          code: 'custom',
          path: ['acceptanceCriteria'],
          message: `Duplicate acId "${ac.acId}" within ${artifact.story.jiraId}.`,
        });
      }
      acIds.add(ac.acId);

      if (!requirementIds.has(ac.requirementId)) {
        ctx.addIssue({
          code: 'custom',
          path: ['acceptanceCriteria'],
          message: `${ac.acId} references unknown requirementId "${ac.requirementId}".`,
        });
      }
    }

    const ambiguityIds = new Set(artifact.ambiguities.map((item) => item.ambiguityId));
    for (const ac of artifact.acceptanceCriteria) {
      for (const ref of ac.clarificationRefs) {
        if (!ambiguityIds.has(ref)) {
          ctx.addIssue({
            code: 'custom',
            path: ['acceptanceCriteria'],
            message: `${ac.acId} references unknown clarification "${ref}".`,
          });
        }
      }
    }

    // Approved artifacts must carry approval evidence.
    if (artifact.approvalStatus === 'APPROVED') {
      if (!artifact.approvalRef) {
        ctx.addIssue({
          code: 'custom',
          path: ['approvalRef'],
          message:
            'An APPROVED requirement artifact must reference the validated approval artifact via approvalRef.',
        });
      }
    }
  });

export type Requirement = z.infer<typeof requirementSchema>;
export type AcceptanceCriterion = z.infer<typeof acceptanceCriterionSchema>;
export type JiraRequirementArtifact = z.infer<typeof jiraRequirementArtifactSchema>;
