import { z } from 'zod';
import {
  approvalGateSchema,
  artifactVersionSchema,
  capabilitySchema,
  decisionSchema,
  isoTimestampSchema,
  releaseSchema,
  SCHEMA_VERSION,
} from './common.model.ts';

export const itemDecisionSchema = z.object({
  itemId: z.string().min(1),
  decision: decisionSchema,
  comment: z.string().optional(),
});

export const approvalArtifactSchema = z
  .object({
    schemaVersion: z.literal(SCHEMA_VERSION),
    approvalId: z
      .string()
      .regex(/^APR-(AC|TP|AD)-[A-Z0-9-]+-\d{3}$/, 'approvalId must look like "APR-AC-ABC-123-001"'),
    gate: approvalGateSchema,
    artifactId: z.string().min(1),
    artifactVersion: artifactVersionSchema,
    release: releaseSchema,
    capability: capabilitySchema,
    sourceArtifactPath: z.string().min(1),
    decision: decisionSchema,
    reviewer: z.object({
      name: z.string().min(1),
      role: z.string().min(1),
      reference: z.string().nullable().optional(),
    }),
    reviewedAt: isoTimestampSchema,
    comments: z.string(),
    itemDecisions: z.array(itemDecisionSchema),
  })
  .strict()
  .superRefine((approval, ctx) => {
    const prefixByGate: Record<string, string> = {
      ACCEPTANCE_CRITERIA: 'APR-AC-',
      TEST_PLAN: 'APR-TP-',
      AUTOMATION_DESIGN: 'APR-AD-',
    };
    const expectedPrefix = prefixByGate[approval.gate];
    if (expectedPrefix && !approval.approvalId.startsWith(expectedPrefix)) {
      ctx.addIssue({
        code: 'custom',
        path: ['approvalId'],
        message: `Gate ${approval.gate} requires an approvalId starting with "${expectedPrefix}".`,
      });
    }

    const seen = new Set<string>();
    for (const item of approval.itemDecisions) {
      if (seen.has(item.itemId)) {
        ctx.addIssue({
          code: 'custom',
          path: ['itemDecisions'],
          message: `Duplicate item-level decision for "${item.itemId}".`,
        });
      }
      seen.add(item.itemId);
    }

    // Gate 1 approvals are item-level by contract.
    if (approval.gate === 'ACCEPTANCE_CRITERIA' && approval.itemDecisions.length === 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['itemDecisions'],
        message:
          'Acceptance Criteria approval requires an individual decision for every acceptance criterion.',
      });
    }
  });

export type ApprovalArtifact = z.infer<typeof approvalArtifactSchema>;

/** Item ids that a gate actually unlocked. */
export function approvedItemIds(approval: ApprovalArtifact): string[] {
  return approval.itemDecisions
    .filter((item) => item.decision === 'APPROVE')
    .map((item) => item.itemId);
}

/** A gate is only open when the overall decision AND the artifact are APPROVE. */
export function isGateOpen(approval: ApprovalArtifact): boolean {
  return approval.decision === 'APPROVE';
}
