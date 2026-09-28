import { z } from 'zod';

import {
  jiraAmbiguitySyncItemSchema,
  type WorkflowState,
} from '../models/workflow-state.model.ts';

export type JiraAmbiguitySyncItem = z.infer<typeof jiraAmbiguitySyncItemSchema>;

export const JIRA_AMBIGUITY_GATE_ORDER: Record<JiraAmbiguitySyncItem['gate'], number> = {
  ACCEPTANCE_CRITERIA: 1,
  TEST_PLAN: 2,
  AUTOMATION_DESIGN: 3,
};

export function renderAmbiguityComment(
  state: WorkflowState,
  items: JiraAmbiguitySyncItem[],
): string {
  const lines = [
    `Managed ambiguity summary for ${state.jiraStoryId}`,
    '',
    'This comment mirrors governed framework artifacts. The repository artifacts and recorded approval files remain authoritative.',
  ];
  if (items.length === 0) {
    lines.push('', 'No recorded ambiguities or clarification questions.');
  } else {
    let previousGate: JiraAmbiguitySyncItem['gate'] | null = null;
    for (const item of items) {
      if (item.gate !== previousGate) {
        lines.push('', `${item.gate}:`);
        previousGate = item.gate;
      }
      lines.push(`- ${item.itemId} [${item.status}] ${item.question}`);
      if (item.impact) lines.push(`  Impact: ${item.impact}`);
    }
  }
  lines.push(
    '',
    'Do not treat a reply to this comment as approval. The applicable schema-valid approval artifact is still required.',
  );
  return lines.join('\n');
}
