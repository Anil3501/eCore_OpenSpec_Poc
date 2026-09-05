import { z } from 'zod';
import { isoTimestampSchema, workflowStageSchema, workflowStatusSchema } from './common.model.ts';

/**
 * One line of workflow/history/<workflowId>.history.jsonl.
 *
 * The history is the append-only evidence trail the approval gates rest on, so
 * a truncated or malformed line has to fail loudly rather than be skipped.
 *
 * `event` is deliberately a pattern rather than an enum. The vocabulary grows
 * (GATE_APPROVED, RECORD_CORRECTED, HISTORY_RESET were all added after the
 * first story) and history is append-only, so an enum would retroactively
 * invalidate events that were correct when they were written.
 */
export const workflowHistoryEventSchema = z
  .object({
    eventId: z
      .string()
      .regex(/^EVT-WF-[A-Z0-9-]+-R\d+\.\d+(\.\d+)?-\d{3}$/, 'eventId must look like "EVT-WF-ABC-123-R1.0-001"'),
    workflowId: z
      .string()
      .regex(/^WF-[A-Z0-9-]+-R\d+\.\d+(\.\d+)?$/, 'workflowId must look like "WF-ABC-123-R1.0"'),
    occurredAt: isoTimestampSchema,
    actor: z.string().min(1).nullable(),
    event: z.string().regex(/^[A-Z][A-Z0-9_]*$/, 'event must be UPPER_SNAKE_CASE'),
    stage: workflowStageSchema,
    notes: z.string(),
    status: workflowStatusSchema.optional(),
    outputs: z.array(z.string().min(1)).optional(),
    delegatedTo: z.string().min(1).optional(),
    errorCode: z.string().min(1).optional(),
    // True when the event was rebuilt from other evidence rather than written
    // as it happened. It must stay distinguishable from a contemporaneous record.
    reconstructed: z.boolean().optional(),
  })
  .strict();

export type WorkflowHistoryEvent = z.infer<typeof workflowHistoryEventSchema>;
