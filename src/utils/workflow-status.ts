/**
 * Safe demonstration workflow (read-only).
 *
 * Prints, for every durable workflow instance, the stage the orchestrator would
 * resume from and the prerequisites it must satisfy first. It never writes to
 * workflow state, never mutates artifacts and never opens a browser, so it can
 * be run at any time without affecting an in-flight approval gate.
 *
 * Usage: node src/utils/workflow-status.ts [<workflowId>]
 */
import { listFiles, readJson, exists } from './artifact-io.ts';
import { workflowStateSchema, type WorkflowState } from '../models/workflow-state.model.ts';
import { approvalArtifactSchema } from '../models/approval.model.ts';

const INSTANCES_DIR = 'workflow/instances';

function describeGate(state: WorkflowState): string[] {
  if (state.pendingApproval === null) return [];
  const gate = state.pendingApproval;
  const lines = [
    `  Gate            : ${gate.gate}`,
    `  Review package  : ${gate.reviewPackagePath}`,
    `  Approval template: ${gate.approvalTemplatePath}`,
  ];
  const expected = gate.expectedApprovalPath;
  if (expected) {
    const recorded = exists(expected);
    lines.push(`  Approval recorded: ${recorded ? 'YES' : 'NO'} (${expected})`);
    if (recorded) {
      const parsed = approvalArtifactSchema.safeParse(readJson(expected));
      lines.push(
        parsed.success
          ? `  Approval decision: ${parsed.data.decision} by ${parsed.data.reviewer.role}`
          : '  Approval decision: INVALID APPROVAL ARTIFACT - the gate stays closed',
      );
    }
  }
  return lines;
}

function main(): void {
  const requestedId = process.argv[2];
  const files = listFiles(INSTANCES_DIR, '.json');

  if (files.length === 0) {
    console.log(`No workflow instances found in ${INSTANCES_DIR}/.`);
    return;
  }

  for (const file of files) {
    const parsed = workflowStateSchema.safeParse(readJson(file));
    if (!parsed.success) {
      console.log(`${file}: INVALID workflow state - run "npm run validate:workflow" for details.`);
      continue;
    }
    const state = parsed.data;
    if (requestedId && state.workflowId !== requestedId) continue;

    console.log(`\n${state.workflowId}  (${file})`);
    console.log(`  Story           : ${state.jiraStoryId}`);
    console.log(`  Release         : ${state.release}`);
    console.log(`  Capability      : ${state.capability}`);
    console.log(`  Classification  : ${state.dataClassification ?? 'UNSPECIFIED'}`);
    console.log(`  Status          : ${state.status}`);
    console.log(`  Current stage   : ${state.currentStage}`);
    console.log(`  Next stage      : ${state.nextStage ?? '(none)'}`);
    console.log(`  Last successful : ${state.lastSuccessfulStage ?? '(none)'}`);
    console.log(`  Assigned agent  : ${state.assignedAgent ?? '(none)'}`);
    console.log(`  Processing lock : ${state.processingLock ? state.processingLock.lockId : '(none)'}`);
    for (const line of describeGate(state)) console.log(line);

    if (state.status === 'WAITING_FOR_HUMAN') {
      console.log('  Orchestrator action: STOP. Record a validated approval artifact to continue.');
    } else if (state.status === 'BLOCKED') {
      console.log(`  Orchestrator action: BLOCKED - ${state.errorDetails?.blocker ?? state.errorDetails?.message ?? 'see errorDetails'}`);
    } else if (state.status === 'COMPLETED') {
      console.log('  Orchestrator action: none, workflow is complete.');
    } else {
      console.log(`  Orchestrator action: resume at ${state.currentStage}.`);
    }
  }
}

main();
