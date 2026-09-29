import type {
  jiraApprovedArtifactRecordSchema,
  WorkflowState,
} from '../models/workflow-state.model.ts';
import type { z } from 'zod';

export type JiraApprovedArtifactRecord = z.infer<typeof jiraApprovedArtifactRecordSchema>;

const ARTIFACT_ORDER: Record<JiraApprovedArtifactRecord['artifactType'], number> = {
  ACCEPTANCE_CRITERIA: 1,
  TEST_PLAN: 2,
};

export function renderApprovedArtifactComment(
  state: WorkflowState,
  artifacts: JiraApprovedArtifactRecord[],
): string {
  const lines = [
    `Framework-approved artifacts for ${state.jiraStoryId}`,
    '',
    'This comment mirrors approved repository artifacts. Repository artifacts and schema-valid approval files remain authoritative; Jira comments and attachments are not approvals.',
  ];

  const sorted = [...artifacts].sort(
    (left, right) =>
      ARTIFACT_ORDER[left.artifactType] - ARTIFACT_ORDER[right.artifactType] ||
      right.artifactVersion - left.artifactVersion ||
      left.fileName.localeCompare(right.fileName),
  );

  let previousType: JiraApprovedArtifactRecord['artifactType'] | null = null;
  for (const artifact of sorted) {
    if (artifact.artifactType !== previousType) {
      lines.push(
        '',
        artifact.artifactType === 'ACCEPTANCE_CRITERIA'
          ? 'Acceptance Criteria:'
          : 'Test Plans:',
      );
      previousType = artifact.artifactType;
    }
    const source =
      artifact.sourceArtifactVersion === null
        ? ''
        : `; based on AC v${artifact.sourceArtifactVersion}`;
    lines.push(
      `- v${artifact.artifactVersion} [${artifact.lifecycle}] ${artifact.fileName} ` +
        `(approval ${artifact.approvalId}; Jira attachment ${artifact.jiraAttachmentId}${source})`,
    );
  }

  lines.push(
    '',
    'Only CURRENT entries are active. SUPERSEDED and STALE attachments are retained as immutable approval history.',
  );
  return lines.join('\n');
}
