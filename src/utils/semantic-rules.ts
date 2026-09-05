/**
 * Semantic validation rules that go beyond single-artifact structure.
 *
 * These rules are the machine-checkable form of the framework's governance
 * requirements: unique identifiers, existing references, approval evidence,
 * gate ordering, execution honesty and sample-data isolation.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';

import {
  approvalArtifactSchema,
  approvedItemIds,
  isGateOpen,
  type ApprovalArtifact,
} from '../models/approval.model.ts';
import {
  jiraRequirementArtifactSchema,
  type JiraRequirementArtifact,
} from '../models/requirement.model.ts';
import { testPlanSchema, type TestPlan } from '../models/test-plan.model.ts';
import { defectReportSchema, type DefectReport } from '../models/defect.model.ts';
import {
  computeCoverage,
  coverageMatrixSchema,
  lookupIndexSchema,
  rtmSchema,
  type CoverageMatrix,
  type LookupIndex,
  type Rtm,
} from '../models/rtm.model.ts';
import { workflowStateSchema, type WorkflowState } from '../models/workflow-state.model.ts';
import { workflowHistoryEventSchema } from '../models/workflow-history.model.ts';
import { exists, listFiles, listFilesRecursive, readJson, readText, PROJECT_ROOT, toAbsolute } from './artifact-io.ts';
import { resolveBinEntry } from './node-bin.ts';
import { checkSchemaParity } from './schema-parity.ts';

export type CheckStatus = 'PASS' | 'FAIL' | 'SKIPPED';

export interface CheckResult {
  id: string;
  title: string;
  status: CheckStatus;
  messages: string[];
}

export const PATHS = {
  requirementSchema: 'requirements/schemas/jira-requirement.schema.json',
  approvalSchema: 'requirements/schemas/approval.schema.json',
  workflowStateSchema: 'workflow/definitions/workflow-state.schema.json',
  workflowHistorySchema: 'workflow/definitions/workflow-history.schema.json',
  testPlanSchema: 'test-plans/test-plan.schema.json',
  rtmSchema: 'traceability/schemas/rtm.schema.json',
  coverageSchema: 'traceability/schemas/coverage-matrix.schema.json',
  lookupIndexSchema: 'traceability/schemas/lookup-index.schema.json',
  defectSchema: 'defects/schemas/defect-report.schema.json',
  requirementExamples: 'requirements/examples',
  requirementNormalized: 'requirements/normalized',
  requirementApproved: 'requirements/approved',
  workflowInstances: 'workflow/instances',
  workflowHistory: 'workflow/history',
  testPlansGenerated: 'test-plans/generated',
  testPlansApproved: 'test-plans/approved',
  featuresApproved: 'features/approved',
  featuresGenerated: 'features/generated',
  rtmCapabilities: 'traceability/capabilities',
  traceabilityIndex: 'traceability/index',
  defects: 'defects',
  tests: 'tests',
  pages: 'src/pages',
  components: 'src/components',
  services: 'src/services',
  fixtures: 'src/fixtures',
  api: 'src/api',
  apiContracts: 'src/models/api',
  openSpecChanges: 'openspec/changes',
  templatesManifest: 'templates/manifest.json',
  steps: 'steps',
} as const;

interface TemplateManifest {
  placeholderPrefix: string;
  artifacts: { id: string; template: string; schema: string }[];
  reviews: { id: string; gate: string; template: string; requiredSections: string[] }[];
}

interface LoadedArtifacts {
  requirements: Map<string, JiraRequirementArtifact>;
  approvals: ApprovalArtifact[];
  testPlans: Map<string, TestPlan>;
  workflows: Map<string, WorkflowState>;
  rtms: Map<string, Rtm>;
  coverage: Map<string, CoverageMatrix>;
  indexes: Map<string, LookupIndex>;
  defects: Map<string, DefectReport>;
}

function pass(id: string, title: string, messages: string[] = []): CheckResult {
  return { id, title, status: 'PASS', messages };
}

function fail(id: string, title: string, messages: string[]): CheckResult {
  return { id, title, status: 'FAIL', messages };
}

function skip(id: string, title: string, reason: string): CheckResult {
  return { id, title, status: 'SKIPPED', messages: [reason] };
}

function formatZodIssues(prefix: string, error: unknown): string[] {
  const issues = (error as { issues?: Array<{ path: Array<string | number>; message: string }> })
    .issues;
  if (!issues) return [`${prefix}: ${String(error)}`];
  return issues.map((issue) => `${prefix} -> ${issue.path.join('.') || '(root)'}: ${issue.message}`);
}

function collectJsonFiles(dir: string): string[] {
  return listFiles(dir, '.json');
}

/** Values of every tag carrying `prefix`, from anywhere in a feature file. */
function featureTagsWithPrefix(file: string, prefix: string): string[] {
  return readText(file)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.startsWith('@'))
    .flatMap((line) => line.split(/\s+/))
    .filter((tag) => tag.startsWith(prefix))
    .map((tag) => tag.slice(prefix.length));
}

/**
 * The append-only history is the evidence a gate decision rests on, so a
 * truncated or malformed line must fail loudly rather than be silently skipped.
 */
function checkWorkflowHistory(): CheckResult {
  const id = 'WF-HISTORY-STRUCTURE';
  const title = 'Workflow history events validate against schema';

  const files = listFiles(PATHS.workflowHistory, '.jsonl');
  if (files.length === 0) return skip(id, title, 'No workflow history files found.');

  const messages: string[] = [];
  let eventCount = 0;

  for (const file of files) {
    const expectedWorkflowId = file.split('/').pop()?.replace('.history.jsonl', '') ?? '';
    const seenEventIds = new Set<string>();

    const lines = readText(file).split(/\r?\n/);
    for (const [index, line] of lines.entries()) {
      if (line.trim() === '') continue;
      const lineNumber = index + 1;

      let raw: unknown;
      try {
        raw = JSON.parse(line);
      } catch {
        messages.push(`${file}:${lineNumber}: not valid JSON. The history trail is unreadable here.`);
        continue;
      }

      const parsed = workflowHistoryEventSchema.safeParse(raw);
      if (!parsed.success) {
        messages.push(...formatZodIssues(`${file}:${lineNumber}`, parsed.error));
        continue;
      }
      for (const issue of checkSchemaParity(PATHS.workflowHistorySchema, raw)) {
        messages.push(`${file}:${lineNumber} -> schema parity ${issue.path}: ${issue.message}`);
      }

      const event = parsed.data;
      eventCount += 1;

      if (event.workflowId !== expectedWorkflowId) {
        messages.push(
          `${file}:${lineNumber}: workflowId "${event.workflowId}" does not match the file it lives in ("${expectedWorkflowId}").`,
        );
      }
      if (!event.eventId.startsWith(`EVT-${event.workflowId}-`)) {
        messages.push(
          `${file}:${lineNumber}: eventId "${event.eventId}" does not belong to ${event.workflowId}.`,
        );
      }
      if (seenEventIds.has(event.eventId)) {
        messages.push(`${file}:${lineNumber}: duplicate eventId "${event.eventId}".`);
      }
      seenEventIds.add(event.eventId);
    }
  }

  return messages.length === 0
    ? pass(id, title, [`${eventCount} history event(s) across ${files.length} file(s) validated.`])
    : fail(id, title, messages);
}

/** Loads and structurally validates every structured artifact in the workspace. */
function loadArtifacts(results: CheckResult[]): LoadedArtifacts {
  const loaded: LoadedArtifacts = {
    requirements: new Map(),
    approvals: [],
    testPlans: new Map(),
    workflows: new Map(),
    rtms: new Map(),
    coverage: new Map(),
    indexes: new Map(),
    defects: new Map(),
  };

  const requirementFiles = [
    ...collectJsonFiles(PATHS.requirementExamples),
    ...collectJsonFiles(PATHS.requirementNormalized),
    ...collectJsonFiles(PATHS.requirementApproved),
  ];

  const requirementMessages: string[] = [];
  for (const file of requirementFiles) {
    const raw = readJson(file);
    if (file.includes('-approval')) continue;
    const parsed = jiraRequirementArtifactSchema.safeParse(raw);
    if (!parsed.success) {
      requirementMessages.push(...formatZodIssues(file, parsed.error));
      continue;
    }
    for (const issue of checkSchemaParity(PATHS.requirementSchema, raw)) {
      requirementMessages.push(`${file} -> schema parity ${issue.path}: ${issue.message}`);
    }
    loaded.requirements.set(file, parsed.data);
  }
  results.push(
    requirementFiles.length === 0
      ? skip('REQ-STRUCTURE', 'Requirement artifacts validate against schema', 'No requirement artifacts found.')
      : requirementMessages.length === 0
        ? pass('REQ-STRUCTURE', 'Requirement artifacts validate against schema', [
            `${loaded.requirements.size} artifact(s) validated.`,
          ])
        : fail('REQ-STRUCTURE', 'Requirement artifacts validate against schema', requirementMessages),
  );

  const approvalFiles = [
    ...collectJsonFiles(PATHS.requirementExamples),
    ...collectJsonFiles(PATHS.requirementApproved),
    ...collectJsonFiles(PATHS.testPlansApproved),
    ...listFilesRecursive(PATHS.featuresApproved, '.json'),
  ].filter((file) => file.includes('-approval'));

  const approvalMessages: string[] = [];
  for (const file of approvalFiles) {
    const raw = readJson(file);
    const parsed = approvalArtifactSchema.safeParse(raw);
    if (!parsed.success) {
      approvalMessages.push(...formatZodIssues(file, parsed.error));
      continue;
    }
    for (const issue of checkSchemaParity(PATHS.approvalSchema, raw)) {
      approvalMessages.push(`${file} -> schema parity ${issue.path}: ${issue.message}`);
    }
    loaded.approvals.push(parsed.data);
  }
  results.push(
    approvalFiles.length === 0
      ? skip('APR-STRUCTURE', 'Approval artifacts validate against schema', 'No approval artifacts found.')
      : approvalMessages.length === 0
        ? pass('APR-STRUCTURE', 'Approval artifacts validate against schema', [
            `${loaded.approvals.length} approval artifact(s) validated.`,
          ])
        : fail('APR-STRUCTURE', 'Approval artifacts validate against schema', approvalMessages),
  );

  const testPlanFiles = [
    ...collectJsonFiles(PATHS.testPlansGenerated),
    ...collectJsonFiles(PATHS.testPlansApproved),
  ].filter((file) => !file.includes('-approval'));
  const testPlanMessages: string[] = [];
  for (const file of testPlanFiles) {
    const raw = readJson(file);
    const parsed = testPlanSchema.safeParse(raw);
    if (!parsed.success) {
      testPlanMessages.push(...formatZodIssues(file, parsed.error));
      continue;
    }
    for (const issue of checkSchemaParity(PATHS.testPlanSchema, raw)) {
      testPlanMessages.push(`${file} -> schema parity ${issue.path}: ${issue.message}`);
    }
    loaded.testPlans.set(file, parsed.data);
  }
  results.push(
    testPlanFiles.length === 0
      ? skip('TP-STRUCTURE', 'Test plans validate against schema', 'No test plans found.')
      : testPlanMessages.length === 0
        ? pass('TP-STRUCTURE', 'Test plans validate against schema', [
            `${loaded.testPlans.size} test plan(s) validated.`,
          ])
        : fail('TP-STRUCTURE', 'Test plans validate against schema', testPlanMessages),
  );

  const workflowFiles = collectJsonFiles(PATHS.workflowInstances);
  const workflowMessages: string[] = [];
  for (const file of workflowFiles) {
    const raw = readJson(file);
    const parsed = workflowStateSchema.safeParse(raw);
    if (!parsed.success) {
      workflowMessages.push(...formatZodIssues(file, parsed.error));
      continue;
    }
    for (const issue of checkSchemaParity(PATHS.workflowStateSchema, raw)) {
      workflowMessages.push(`${file} -> schema parity ${issue.path}: ${issue.message}`);
    }
    loaded.workflows.set(file, parsed.data);
  }
  results.push(
    workflowFiles.length === 0
      ? skip('WF-STRUCTURE', 'Workflow states validate against schema', 'No workflow instances found.')
      : workflowMessages.length === 0
        ? pass('WF-STRUCTURE', 'Workflow states validate against schema', [
            `${loaded.workflows.size} workflow instance(s) validated.`,
          ])
        : fail('WF-STRUCTURE', 'Workflow states validate against schema', workflowMessages),
  );

  results.push(checkWorkflowHistory());

  const rtmFiles = collectJsonFiles(PATHS.rtmCapabilities);
  const rtmMessages: string[] = [];
  for (const file of rtmFiles) {
    const raw = readJson(file);
    if (file.endsWith('.coverage.json')) {
      const parsed = coverageMatrixSchema.safeParse(raw);
      if (!parsed.success) {
        rtmMessages.push(...formatZodIssues(file, parsed.error));
        continue;
      }
      for (const issue of checkSchemaParity(PATHS.coverageSchema, raw)) {
        rtmMessages.push(`${file} -> schema parity ${issue.path}: ${issue.message}`);
      }
      loaded.coverage.set(file, parsed.data);
      continue;
    }
    const parsed = rtmSchema.safeParse(raw);
    if (!parsed.success) {
      rtmMessages.push(...formatZodIssues(file, parsed.error));
      continue;
    }
    for (const issue of checkSchemaParity(PATHS.rtmSchema, raw)) {
      rtmMessages.push(`${file} -> schema parity ${issue.path}: ${issue.message}`);
    }
    loaded.rtms.set(file, parsed.data);
  }

  for (const file of collectJsonFiles(PATHS.traceabilityIndex)) {
    const raw = readJson(file);
    const parsed = lookupIndexSchema.safeParse(raw);
    if (!parsed.success) {
      rtmMessages.push(...formatZodIssues(file, parsed.error));
      continue;
    }
    for (const issue of checkSchemaParity(PATHS.lookupIndexSchema, raw)) {
      rtmMessages.push(`${file} -> schema parity ${issue.path}: ${issue.message}`);
    }
    loaded.indexes.set(file, parsed.data);
  }

  results.push(
    rtmFiles.length === 0
      ? skip('RTM-STRUCTURE', 'RTM and coverage artifacts validate against schema', 'No RTM partitions found.')
      : rtmMessages.length === 0
        ? pass('RTM-STRUCTURE', 'RTM and coverage artifacts validate against schema', [
            `${loaded.rtms.size} RTM partition(s), ${loaded.coverage.size} coverage matrix/matrices, ${loaded.indexes.size} index file(s).`,
          ])
        : fail('RTM-STRUCTURE', 'RTM and coverage artifacts validate against schema', rtmMessages),
  );

  // Defect artifacts live at the top level of defects/; defects/schemas/ holds
  // the JSON Schema and is deliberately not picked up by this non-recursive list.
  const defectFiles = collectJsonFiles(PATHS.defects);
  const defectMessages: string[] = [];
  for (const file of defectFiles) {
    const raw = readJson(file);
    const parsed = defectReportSchema.safeParse(raw);
    if (!parsed.success) {
      defectMessages.push(...formatZodIssues(file, parsed.error));
      continue;
    }
    for (const issue of checkSchemaParity(PATHS.defectSchema, raw)) {
      defectMessages.push(`${file} -> schema parity ${issue.path}: ${issue.message}`);
    }
    loaded.defects.set(file, parsed.data);
  }
  results.push(
    defectFiles.length === 0
      ? skip('DEF-STRUCTURE', 'Defect reports validate against schema', 'No defect reports found.')
      : defectMessages.length === 0
        ? pass('DEF-STRUCTURE', 'Defect reports validate against schema', [
            `${loaded.defects.size} defect report(s) validated.`,
          ])
        : fail('DEF-STRUCTURE', 'Defect reports validate against schema', defectMessages),
  );

  return loaded;
}

function checkApprovalEvidence(loaded: LoadedArtifacts): CheckResult {
  const messages: string[] = [];
  for (const approval of loaded.approvals) {
    if (!exists(approval.sourceArtifactPath)) {
      messages.push(
        `${approval.approvalId}: sourceArtifactPath "${approval.sourceArtifactPath}" does not exist.`,
      );
    }
  }

  for (const [file, requirement] of loaded.requirements) {
    if (requirement.approvalStatus !== 'APPROVED') continue;
    const ref = requirement.approvalRef;
    if (!ref || !exists(ref)) {
      messages.push(`${file}: approvalRef "${ref ?? 'null'}" is missing or does not exist.`);
      continue;
    }
    const approval = loaded.approvals.find((item) => item.gate === 'ACCEPTANCE_CRITERIA' && item.artifactId === requirement.story.jiraId);
    if (!approval) {
      messages.push(`${file}: no ACCEPTANCE_CRITERIA approval artifact found for ${requirement.story.jiraId}.`);
      continue;
    }
    if (!isGateOpen(approval)) {
      messages.push(
        `${file}: acceptance criteria gate decision is "${approval.decision}", so the artifact must not be APPROVED.`,
      );
    }
    if (approval.artifactVersion !== requirement.artifactVersion) {
      messages.push(
        `${file}: approval covers artifactVersion ${approval.artifactVersion} but the artifact is version ${requirement.artifactVersion}. Re-approval is required.`,
      );
    }
  }

  // A plan sitting in test-plans/approved/ carries the same burden of proof as an
  // approved requirement: its own approval, at its own version.
  const approvedPlanFiles = new Set(collectJsonFiles(PATHS.testPlansApproved));
  for (const [file, plan] of loaded.testPlans) {
    if (!approvedPlanFiles.has(file)) continue;
    const approval = loaded.approvals.find(
      (item) => item.gate === 'TEST_PLAN' && item.artifactId === plan.testPlanId,
    );
    if (!approval) {
      messages.push(`${file}: no TEST_PLAN approval artifact found for ${plan.testPlanId}.`);
      continue;
    }
    if (!isGateOpen(approval)) {
      messages.push(
        `${file}: test plan gate decision is "${approval.decision}", so the plan must not sit in test-plans/approved/.`,
      );
    }
    if (approval.artifactVersion !== plan.artifactVersion) {
      messages.push(
        `${file}: approval covers artifactVersion ${approval.artifactVersion} but the plan is version ${plan.artifactVersion}. Re-approval is required.`,
      );
    }
    if (plan.approvalStatus === 'APPROVED' && (!plan.approvalRef || !exists(plan.approvalRef))) {
      messages.push(
        `${file}: approvalRef "${plan.approvalRef ?? 'null'}" is missing or does not exist.`,
      );
    }
  }

  return messages.length === 0
    ? pass('SEM-APPROVAL-EVIDENCE', 'Approved artifacts carry validated approval evidence')
    : fail('SEM-APPROVAL-EVIDENCE', 'Approved artifacts carry validated approval evidence', messages);
}

function checkGateOrdering(loaded: LoadedArtifacts): CheckResult {
  const messages: string[] = [];

  const approvedAcIdsByStory = new Map<string, Set<string>>();
  for (const approval of loaded.approvals) {
    if (approval.gate !== 'ACCEPTANCE_CRITERIA') continue;
    approvedAcIdsByStory.set(approval.artifactId, new Set(approvedItemIds(approval)));
  }

  // Gate 1 -> test plans may only reference approved ACs.
  for (const [file, plan] of loaded.testPlans) {
    for (const storyId of plan.jiraStoryIds) {
      const approvedAcs = approvedAcIdsByStory.get(storyId);
      if (!approvedAcs) {
        messages.push(
          `${file}: test plan exists for ${storyId} but no recorded ACCEPTANCE_CRITERIA approval was found. Gate 1 must not be bypassed.`,
        );
        continue;
      }
      for (const acId of plan.acIds) {
        if (!acId.startsWith(`AC-${storyId}-`)) continue;
        if (!approvedAcs.has(acId)) {
          messages.push(`${file}: ${acId} is not APPROVE-d in the Gate 1 approval artifact.`);
        }
      }
    }
  }

  // Gate 2 -> EVERY plan in test-plans/approved/ needs its own approval. An
  // existence check would let one story's approval unlock every later story.
  const approvedPlanPaths = collectJsonFiles(PATHS.testPlansApproved).filter(
    (file) => !file.includes('-approval'),
  );
  const openTestPlanApprovalIds = new Set(
    loaded.approvals
      .filter((item) => item.gate === 'TEST_PLAN' && isGateOpen(item))
      .map((item) => item.artifactId),
  );
  for (const file of approvedPlanPaths) {
    const planId = loaded.testPlans.get(file)?.testPlanId;
    if (planId === undefined) continue; // TP-STRUCTURE already reported it.
    if (!openTestPlanApprovalIds.has(planId)) {
      messages.push(
        `${file}: ${planId} sits in test-plans/approved/ with no APPROVE-d TEST_PLAN approval artifact. Gate 2 must not be bypassed.`,
      );
    }
  }

  // Gate 3 -> every approved feature must name a plan that carries an
  // AUTOMATION_DESIGN approval, matched through its own @tp- tag.
  const approvedFeatures = listFilesRecursive(PATHS.featuresApproved, '.feature');
  const openAutomationApprovalIds = new Set(
    loaded.approvals
      .filter((item) => item.gate === 'AUTOMATION_DESIGN' && isGateOpen(item))
      .map((item) => item.artifactId),
  );
  for (const file of approvedFeatures) {
    const planTags = [...new Set(featureTagsWithPrefix(file, '@tp-'))];
    if (planTags.length === 0) {
      messages.push(
        `${file}: carries no @tp- tag, so it cannot be tied to an AUTOMATION_DESIGN approval and Gate 3 cannot be evidenced.`,
      );
      continue;
    }
    for (const planId of planTags) {
      if (!openAutomationApprovalIds.has(planId)) {
        messages.push(
          `${file}: ${planId} has no APPROVE-d AUTOMATION_DESIGN approval artifact. Gate 3 must not be bypassed.`,
        );
      }
    }
  }

  // A workflow waiting for a human must not already have produced its next-stage output.
  for (const [file, state] of loaded.workflows) {
    if (state.status !== 'WAITING_FOR_HUMAN' || state.pendingApproval === null) continue;
    if (!exists(state.pendingApproval.reviewPackagePath)) {
      messages.push(
        `${file}: pending review package "${state.pendingApproval.reviewPackagePath}" does not exist.`,
      );
    }
    if (!exists(state.pendingApproval.approvalTemplatePath)) {
      messages.push(
        `${file}: approval template "${state.pendingApproval.approvalTemplatePath}" does not exist.`,
      );
    }
  }

  return messages.length === 0
    ? pass('SEM-GATES', 'All three approval gates are enforced by artifact evidence')
    : fail('SEM-GATES', 'All three approval gates are enforced by artifact evidence', messages);
}

function checkRtmIntegrity(loaded: LoadedArtifacts): CheckResult {
  const messages: string[] = [];

  const knownAcs = new Map<string, JiraRequirementArtifact>();
  for (const requirement of loaded.requirements.values()) {
    for (const ac of requirement.acceptanceCriteria) {
      knownAcs.set(ac.acId, requirement);
    }
  }

  const knownScenarioIds = new Set<string>();
  for (const plan of loaded.testPlans.values()) {
    for (const scenario of plan.scenarios) knownScenarioIds.add(scenario.testScenarioId);
  }

  const globalTraceIds = new Set<string>();
  for (const [file, rtm] of loaded.rtms) {
    for (const entry of rtm.entries) {
      if (globalTraceIds.has(entry.traceId)) {
        messages.push(`${file}: traceId "${entry.traceId}" is not unique across capability partitions.`);
      }
      globalTraceIds.add(entry.traceId);

      const requirement = knownAcs.get(entry.acId);
      if (!requirement) {
        messages.push(`${file}: ${entry.traceId} references unknown acId "${entry.acId}".`);
      } else if (requirement.story.jiraId !== entry.jiraStoryId) {
        messages.push(
          `${file}: ${entry.traceId} claims story ${entry.jiraStoryId} but ${entry.acId} belongs to ${requirement.story.jiraId}.`,
        );
      }

      if (!exists(entry.requirementArtifact.path)) {
        messages.push(`${file}: ${entry.traceId} points at missing artifact "${entry.requirementArtifact.path}".`);
      }

      if (entry.testPlan !== null) {
        if (!knownScenarioIds.has(entry.testPlan.testScenarioId)) {
          messages.push(
            `${file}: ${entry.traceId} references unknown testScenarioId "${entry.testPlan.testScenarioId}".`,
          );
        }
        if (!exists(entry.testPlan.path)) {
          messages.push(`${file}: ${entry.traceId} points at missing test plan "${entry.testPlan.path}".`);
        }
      }

      if (entry.automation !== null) {
        if (!exists(entry.automation.featureFile)) {
          messages.push(
            `${file}: ${entry.traceId} points at missing feature file "${entry.automation.featureFile}".`,
          );
        }
        for (const stepFile of entry.automation.stepDefinitions) {
          if (!exists(stepFile)) {
            messages.push(`${file}: ${entry.traceId} points at missing step definition "${stepFile}".`);
          }
        }
        for (const pageObject of entry.automation.pageObjects) {
          if (!exists(pageObject)) {
            messages.push(`${file}: ${entry.traceId} points at missing page object "${pageObject}".`);
          }
        }
        for (const fixture of entry.automation.fixtures) {
          if (!exists(fixture)) {
            messages.push(`${file}: ${entry.traceId} points at missing fixture "${fixture}".`);
          }
        }
      }

      for (const execution of entry.executionRefs) {
        if (execution.result !== 'NOT_EXECUTED' && execution.result !== 'BLOCKED' && !exists(execution.recordPath)) {
          messages.push(
            `${file}: ${entry.traceId} claims result "${execution.result}" but execution record "${execution.recordPath}" does not exist.`,
          );
        }
      }

      for (const specRef of entry.openSpecRefs) {
        if (!exists(specRef)) {
          messages.push(`${file}: ${entry.traceId} points at missing OpenSpec artifact "${specRef}".`);
        }
      }
    }
  }

  for (const [file, plan] of loaded.testPlans) {
    for (const specRef of plan.openSpecRefs ?? []) {
      if (!exists(specRef)) {
        messages.push(`${file}: ${plan.testPlanId} points at missing OpenSpec artifact "${specRef}".`);
      }
    }
  }

  return messages.length === 0
    ? pass('SEM-RTM', 'RTM relationships resolve to existing, consistent artifacts')
    : fail('SEM-RTM', 'RTM relationships resolve to existing, consistent artifacts', messages);
}

function checkCoverageHonesty(loaded: LoadedArtifacts): CheckResult {
  const messages: string[] = [];
  if (loaded.coverage.size === 0) {
    return skip('SEM-COVERAGE', 'Coverage percentages are derived only from RTM data', 'No coverage matrix found.');
  }

  for (const [file, matrix] of loaded.coverage) {
    const rtmEntry = [...loaded.rtms.entries()].find(([rtmPath]) => rtmPath === matrix.sourceRtm.path);
    if (!rtmEntry) {
      messages.push(`${file}: sourceRtm "${matrix.sourceRtm.path}" was not found or is not a valid RTM.`);
      continue;
    }
    const [, rtm] = rtmEntry;
    if (rtm.artifactVersion !== matrix.sourceRtm.version) {
      messages.push(
        `${file}: coverage was derived from RTM version ${matrix.sourceRtm.version} but the RTM is now version ${rtm.artifactVersion}.`,
      );
    }

    const recomputed = computeCoverage(rtm);
    const compare = (label: string, stored: number | null, actual: number | null): void => {
      if (stored !== actual) {
        messages.push(`${file}: ${label} is recorded as ${String(stored)} but RTM data yields ${String(actual)}.`);
      }
    };
    compare('acDesignCoveragePct', matrix.coverage.acDesignCoveragePct, recomputed.acDesignCoveragePct);
    compare('automationCoveragePct', matrix.coverage.automationCoveragePct, recomputed.automationCoveragePct);
    compare('executionCoveragePct', matrix.coverage.executionCoveragePct, recomputed.executionCoveragePct);
    compare('passCoveragePct', matrix.coverage.passCoveragePct, recomputed.passCoveragePct);

    // Only checked when recorded. An absent split means "never measured", but a
    // recorded one that disagrees with the RTM is a false coverage claim.
    if (matrix.coverage.byInterface !== undefined) {
      for (const interfaceType of ['UI', 'API', 'HYBRID'] as const) {
        const stored = matrix.coverage.byInterface[interfaceType];
        const actual = recomputed.byInterface[interfaceType];
        for (const measure of [
          'automationCoveragePct',
          'executionCoveragePct',
          'passCoveragePct',
        ] as const) {
          compare(`byInterface.${interfaceType}.${measure}`, stored[measure], actual[measure]);
        }
        for (const total of [
          'acsWithScenarios',
          'acsWithExecutableAutomation',
          'acsExecuted',
          'acsPassed',
        ] as const) {
          compare(`byInterface.${interfaceType}.${total}`, stored[total], actual[total]);
        }
      }
    }

    const totalsMatch =
      matrix.totals.approvedAcs === recomputed.totals.approvedAcs &&
      matrix.totals.approvedAcsLinkedToApprovedScenarios ===
        recomputed.totals.approvedAcsLinkedToApprovedScenarios &&
      matrix.totals.approvedAcsLinkedToExecutableAutomation ===
        recomputed.totals.approvedAcsLinkedToExecutableAutomation &&
      matrix.totals.automatedAcsExecuted === recomputed.totals.automatedAcsExecuted &&
      matrix.totals.executedAcsPassed === recomputed.totals.executedAcsPassed;
    if (!totalsMatch) {
      messages.push(`${file}: recorded totals do not match the totals derived from the RTM.`);
    }
  }

  return messages.length === 0
    ? pass('SEM-COVERAGE', 'Coverage percentages are derived only from RTM data')
    : fail('SEM-COVERAGE', 'Coverage percentages are derived only from RTM data', messages);
}

function checkFeatureTraceability(): CheckResult {
  // Generated features are checked too: a missing tag caught while the file is
  // still under review is a correction, whereas the same tag missing after
  // Gate 3 means a human approved something that was never traceable.
  const featureFiles = [
    ...listFilesRecursive(PATHS.featuresApproved, '.feature'),
    ...listFilesRecursive(PATHS.featuresGenerated, '.feature'),
  ];
  if (featureFiles.length === 0) {
    return skip('SEM-FEATURE-TAGS', 'Every Gherkin scenario carries traceability tags', 'No feature files found.');
  }

  const messages: string[] = [];
  const requiredPrefixes = ['@release-', '@capability-', '@req-', '@ac-', '@tp-', '@ts-'];

  for (const file of featureFiles) {
    const lines = readText(file).split(/\r?\n/);
    let pendingTags: string[] = [];
    let featureTags: string[] = [];
    let seenFeature = false;
    let scenarioCount = 0;

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (line.startsWith('@')) {
        pendingTags = pendingTags.concat(line.split(/\s+/).filter((tag) => tag.startsWith('@')));
        continue;
      }
      if (line.startsWith('Feature:')) {
        featureTags = pendingTags;
        pendingTags = [];
        seenFeature = true;
        continue;
      }
      if (line.startsWith('Scenario:') || line.startsWith('Scenario Outline:')) {
        scenarioCount += 1;
        const effective = featureTags.concat(pendingTags);
        for (const prefix of requiredPrefixes) {
          if (!effective.some((tag) => tag.startsWith(prefix))) {
            messages.push(`${file}: scenario "${line}" is missing a ${prefix}* traceability tag.`);
          }
        }
        pendingTags = [];
        continue;
      }
      if (line === '' || line.startsWith('#')) continue;
      if (!seenFeature) continue;
    }

    if (scenarioCount === 0) {
      messages.push(`${file}: contains no scenarios.`);
    }
  }

  return messages.length === 0
    ? pass('SEM-FEATURE-TAGS', 'Every Gherkin scenario carries traceability tags', [
        `${featureFiles.length} approved and generated feature file(s) checked.`,
      ])
    : fail('SEM-FEATURE-TAGS', 'Every Gherkin scenario carries traceability tags', messages);
}

/**
 * OpenSpec artifacts are markdown owned by the OpenSpec CLI, so this check runs
 * that CLI rather than inventing a second definition of a valid change. A
 * hand-written schema here would drift from the tool's own conventions and
 * would start failing changes the tool considers correct.
 *
 * Skips - never fails - when the CLI is absent: `npm run preflight` is the
 * check that reports missing tooling.
 */
function checkOpenSpecChanges(): CheckResult {
  const id = 'SEM-OPENSPEC';
  const title = 'Open OpenSpec changes pass `openspec validate --strict`';

  const changesDir = toAbsolute(PATHS.openSpecChanges);
  if (!fs.existsSync(changesDir)) {
    return skip(id, title, 'No openspec/changes directory found.');
  }

  const changeNames = fs
    .readdirSync(changesDir, { withFileTypes: true })
    // `archive` holds completed changes; re-validating them would fail a build
    // for a decision that was already made and closed.
    .filter((entry) => entry.isDirectory() && entry.name !== 'archive')
    .map((entry) => entry.name);

  if (changeNames.length === 0) {
    return skip(id, title, 'No open OpenSpec changes.');
  }

  const cli = resolveBinEntry('@fission-ai/openspec', 'openspec');
  if (cli === null) {
    return skip(id, title, 'The OpenSpec CLI is not installed. Run npm run preflight.');
  }

  const messages: string[] = [];
  for (const name of changeNames) {
    try {
      execFileSync(process.execPath, [cli, 'validate', name, '--strict'], {
        cwd: PROJECT_ROOT,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      });
    } catch (error) {
      const output = error as { stdout?: string; stderr?: string };
      const detail = `${output.stdout ?? ''}${output.stderr ?? ''}`.trim();
      messages.push(
        `${PATHS.openSpecChanges}/${name}: openspec validate --strict failed -> ${detail || 'no output'}`,
      );
    }
  }

  return messages.length === 0
    ? pass(id, title, [`${changeNames.length} open change(s) validated: ${changeNames.join(', ')}.`])
    : fail(id, title, messages);
}

/**
 * Templates are the shape authority an agent fills instead of copying another
 * story. Their placeholder values are deliberately not schema-valid, so only
 * key and required-property parity is compared - enough to fail the build when
 * a schema gains a field and its template is left behind.
 */
function checkTemplateStructure(): CheckResult {
  const id = 'TPL-STRUCTURE';
  const title = 'Artifact templates stay in parity with their schemas';

  if (!exists(PATHS.templatesManifest)) {
    return skip(id, title, 'No templates/manifest.json found.');
  }

  const manifest = readJson<TemplateManifest>(PATHS.templatesManifest);
  const messages: string[] = [];

  for (const entry of manifest.artifacts) {
    if (!exists(entry.template)) {
      messages.push(`${entry.id}: template "${entry.template}" does not exist.`);
      continue;
    }
    if (!exists(entry.schema)) {
      messages.push(`${entry.id}: schema "${entry.schema}" does not exist.`);
      continue;
    }

    const template = readJson<unknown>(entry.template);
    for (const issue of checkSchemaParity(entry.schema, template)) {
      messages.push(`${entry.template}${issue.path}: ${issue.message}`);
    }

    if (!readText(entry.template).includes(manifest.placeholderPrefix)) {
      messages.push(
        `${entry.template}: contains no "${manifest.placeholderPrefix}" placeholder, so it reads as a filled artifact rather than a blank.`,
      );
    }
  }

  for (const entry of manifest.reviews) {
    if (!exists(entry.template)) {
      messages.push(`${entry.id}: review template "${entry.template}" does not exist.`);
      continue;
    }
    const headings = headingLines(readText(entry.template));
    for (const section of entry.requiredSections) {
      if (!headings.some((heading) => heading.includes(section.toLowerCase()))) {
        messages.push(
          `${entry.template}: the template itself is missing its own required section "${section}".`,
        );
      }
    }
  }

  return messages.length === 0
    ? pass(id, title, [
        `${manifest.artifacts.length} artifact template(s) and ${manifest.reviews.length} review template(s) checked.`,
      ])
    : fail(id, title, messages);
}

function headingLines(markdown: string): string[] {
  return markdown
    .split(/\r?\n/)
    .filter((line) => line.startsWith('#'))
    .map((line) => line.replace(/^#+\s*/, '').toLowerCase());
}

/**
 * Checks the review package a human is about to read.
 *
 * Only packages currently blocking a gate are checked. Reshaping one whose gate
 * is already cleared would rewrite the record of what the reviewer actually
 * saw, which is worse than the inconsistency it would tidy up.
 */
function checkReviewSections(loaded: LoadedArtifacts): CheckResult {
  const id = 'TPL-REVIEW-SECTIONS';
  const title = 'A review package blocking a gate carries every required section';

  if (!exists(PATHS.templatesManifest)) {
    return skip(id, title, 'No templates/manifest.json found.');
  }

  const manifest = readJson<TemplateManifest>(PATHS.templatesManifest);
  const pending = [...loaded.workflows].filter(([, workflow]) => workflow.pendingApproval !== null);
  if (pending.length === 0) {
    return skip(id, title, 'No workflow is currently waiting at an approval gate.');
  }

  const messages: string[] = [];
  let checked = 0;

  for (const [file, workflow] of pending) {
    const approval = workflow.pendingApproval;
    if (!approval) continue;

    const spec = manifest.reviews.find((review) => review.gate === approval.gate);
    if (!spec) {
      messages.push(`${file}: no review template is registered for gate ${approval.gate}.`);
      continue;
    }
    if (!exists(approval.reviewPackagePath)) {
      messages.push(`${file}: review package "${approval.reviewPackagePath}" does not exist.`);
      continue;
    }

    const headings = headingLines(readText(approval.reviewPackagePath));
    for (const section of spec.requiredSections) {
      if (!headings.some((heading) => heading.includes(section.toLowerCase()))) {
        messages.push(
          `${approval.reviewPackagePath}: missing required section "${section}". The reviewer would have to approve without it.`,
        );
      }
    }
    checked += 1;
  }

  return messages.length === 0
    ? pass(id, title, [`${checked} pending review package(s) checked.`])
    : fail(id, title, messages);
}

/**
 * A placeholder surviving into an approved artifact means a template was
 * promoted without being filled in - an approval nobody actually made.
 */
function checkNoPlaceholders(): CheckResult {
  const id = 'SEM-NO-PLACEHOLDERS';
  const title = 'No approved artifact still carries a template placeholder';

  if (!exists(PATHS.templatesManifest)) {
    return skip(id, title, 'No templates/manifest.json found.');
  }

  const prefix = readJson<TemplateManifest>(PATHS.templatesManifest).placeholderPrefix;
  const approvedRoots = [PATHS.requirementApproved, PATHS.testPlansApproved, PATHS.featuresApproved];
  const messages: string[] = [];
  let scanned = 0;

  for (const root of approvedRoots) {
    for (const extension of ['.json', '.md', '.feature']) {
      for (const file of listFilesRecursive(root, extension)) {
        scanned += 1;
        if (readText(file).includes(prefix)) {
          messages.push(`${file}: still contains the placeholder "${prefix}".`);
        }
      }
    }
  }

  return messages.length === 0
    ? pass(id, title, [`${scanned} approved artifact(s) scanned.`])
    : fail(id, title, messages);
}

interface HygieneRule {
  id: string;
  pattern: RegExp;
  problem: string;
  waiver: string | null;
}

/**
 * Locator and wait rules from playwright-automation.instructions.md, in
 * machine-checkable form. A waiver is deliberately narrow: it does not disable
 * the rule, it forces the author to write down why the preferred approach is
 * unavailable, so the exception is reviewable instead of invisible.
 */
const HYGIENE_RULES: HygieneRule[] = [
  {
    id: 'XPATH',
    pattern: /\.locator\(\s*['"`]\s*\(?\/\/|xpath\s*=/i,
    problem: 'uses an XPath selector, which breaks on any markup change',
    waiver: null,
  },
  {
    id: 'NTH_SELECTION',
    pattern: /\.nth\(|:nth-child\(|:nth-of-type\(/,
    problem: 'selects an element by position, which silently targets the wrong element when the list changes',
    waiver: null,
  },
  {
    id: 'HARD_WAIT',
    pattern: /waitForTimeout\s*\(/,
    problem: 'uses a fixed sleep instead of a web-first assertion',
    waiver: 'JUSTIFIED-WAIT:',
  },
  {
    id: 'DISABLED_TEST',
    pattern: /\btest\.(skip|fixme|slow)\s*\(/,
    problem: 'disables or slows a test instead of fixing it, which would report a red build as green',
    waiver: null,
  },
  {
    id: 'RAW_LOCATOR',
    pattern: /\.locator\(\s*['"`]|getByTestId\s*\(/,
    problem:
      'bypasses the accessible-locator order (getByRole, getByLabel, getByPlaceholder, getByText, then getByTestId)',
    waiver: 'VALIDATED -',
  },
];

/**
 * Rules for `src/api`, where the failure modes are different from the DOM's.
 *
 * A guessed endpoint is as dangerous as a guessed locator and worse when the
 * verb has side effects, so a destructive call must name its cleanup strategy
 * rather than silently mutate a shared environment.
 */
const API_HYGIENE_RULES: HygieneRule[] = [
  {
    id: 'HARDCODED_URL',
    pattern: /['"`]https?:\/\//i,
    problem: 'hard-codes an absolute URL instead of resolving it from API_BASE_URL through env',
    waiver: null,
  },
  {
    id: 'DIRECT_ENV_READ',
    pattern: /process\.env\./,
    problem: 'reads process.env directly instead of going through the typed loader in src/utils/env.ts',
    waiver: null,
  },
  {
    id: 'DESTRUCTIVE_CALL',
    pattern: /\.(delete|put)\s*\(/i,
    problem:
      'issues a non-idempotent request against a shared environment, which can destroy data another team is using',
    waiver: 'CLEANUP -',
  },
  {
    id: 'HARD_WAIT',
    pattern: /waitForTimeout\s*\(/,
    problem: 'uses a fixed sleep instead of polling or a web-first assertion',
    waiver: 'JUSTIFIED-WAIT:',
  },
  {
    id: 'DISABLED_TEST',
    pattern: /\btest\.(skip|fixme|slow)\s*\(/,
    problem: 'disables or slows a test instead of fixing it, which would report a red build as green',
    waiver: null,
  },
];

/**
 * Walks upwards from a line looking for a waiver marker, stopping at the blank
 * line or closing brace that separates this member from the previous one, so a
 * marker can never leak from an unrelated member below it.
 */
function hasWaiverAbove(lines: string[], index: number, marker: string): boolean {
  for (let i = index - 1; i >= 0; i -= 1) {
    const line = (lines[i] ?? '').trim();
    if (line === '' || line === '}' || line === '};') return false;
    if (line.includes(marker)) return true;
  }
  return false;
}

function checkAutomationHygiene(loaded: LoadedArtifacts): CheckResult {
  const title = 'Automation code follows the approved locator and wait policy';
  const sourceFiles = [
    ...listFilesRecursive(PATHS.pages, '.ts'),
    ...listFilesRecursive(PATHS.components, '.ts'),
    ...listFilesRecursive(PATHS.services, '.ts'),
    ...listFilesRecursive(PATHS.fixtures, '.ts'),
    ...listFilesRecursive(PATHS.steps, '.ts'),
  ];
  const featureFiles = listFilesRecursive(PATHS.featuresApproved, '.feature');
  const apiFiles = listFilesRecursive(PATHS.api, '.ts');

  if (sourceFiles.length === 0 && featureFiles.length === 0 && apiFiles.length === 0) {
    return skip('SEM-AUTOMATION-HYGIENE', title, 'No automation source or approved feature files found.');
  }

  const messages: string[] = [];

  for (const file of apiFiles) {
    const lines = readText(file).split(/\r?\n/);
    for (let index = 0; index < lines.length; index += 1) {
      const rawLine = lines[index] ?? '';
      const line = rawLine.trim();
      if (line.startsWith('//') || line.startsWith('*') || line.startsWith('/*')) continue;

      for (const rule of API_HYGIENE_RULES) {
        if (!rule.pattern.test(rawLine)) continue;
        if (rule.waiver !== null && hasWaiverAbove(lines, index, rule.waiver)) continue;

        const remedy =
          rule.waiver === null
            ? ''
            : ` If there is genuinely no alternative, record why in a "${rule.waiver}" comment directly above it.`;
        messages.push(`${file}:${index + 1}: ${rule.id} - ${rule.problem}.${remedy} Line: ${line}`);
      }
    }
  }

  for (const file of sourceFiles) {
    const lines = readText(file).split(/\r?\n/);
    for (let index = 0; index < lines.length; index += 1) {
      const rawLine = lines[index] ?? '';
      const line = rawLine.trim();
      if (line.startsWith('//') || line.startsWith('*') || line.startsWith('/*')) continue;

      let xpathMatched = false;
      for (const rule of HYGIENE_RULES) {
        if (rule.id === 'RAW_LOCATOR' && xpathMatched) continue;
        if (!rule.pattern.test(rawLine)) continue;
        if (rule.id === 'XPATH') xpathMatched = true;
        if (rule.waiver !== null && hasWaiverAbove(lines, index, rule.waiver)) continue;

        const remedy =
          rule.waiver === null
            ? ''
            : ` If there is genuinely no alternative, record why in a "${rule.waiver}" comment directly above it.`;
        messages.push(`${file}:${index + 1}: ${rule.id} - ${rule.problem}.${remedy} Line: ${line}`);
      }
    }
  }

  for (const file of featureFiles) {
    const lines = readText(file).split(/\r?\n/);
    for (let index = 0; index < lines.length; index += 1) {
      const line = (lines[index] ?? '').trim();
      if (!line.startsWith('@')) continue;
      for (const tag of line.split(/\s+/)) {
        if (tag === '@skip' || tag === '@fixme') {
          messages.push(
            `${file}:${index + 1}: DISABLED_TEST - an approved scenario carries "${tag}". Approved behaviour must run or be withdrawn at Gate 3.`,
          );
        }
      }
    }
  }

  // Only automation that has cleared Gate 3 may still carry the marker, because
  // the generator legitimately writes it before PLAYWRIGHT_VALIDATION runs.
  const approvedAutomationFiles = new Set<string>();
  for (const rtm of loaded.rtms.values()) {
    for (const entry of rtm.entries) {
      if (entry.automation === null || entry.approvalRefs.automationDesign === null) continue;
      for (const path of entry.automation.pageObjects) approvedAutomationFiles.add(path);
      for (const path of entry.automation.components ?? []) approvedAutomationFiles.add(path);
      for (const path of entry.automation.stepDefinitions) approvedAutomationFiles.add(path);
      for (const path of entry.automation.fixtures) approvedAutomationFiles.add(path);
    }
  }

  for (const file of [...approvedAutomationFiles].sort()) {
    if (!exists(file)) continue; // SEM-RTM already reports references that do not resolve.
    const lines = readText(file).split(/\r?\n/);
    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index] ?? '';
      if (line.includes('MCP_VALIDATION_REQUIRED')) {
        messages.push(
          `${file}:${index + 1}: UNVALIDATED_LOCATOR - this file backs Gate 3 approved automation but still carries MCP_VALIDATION_REQUIRED. Validate the locator through Playwright MCP.`,
        );
      }
      if (line.includes('API_CONTRACT_UNVERIFIED')) {
        messages.push(
          `${file}:${index + 1}: UNVERIFIED_CONTRACT - this file backs Gate 3 approved automation but still carries API_CONTRACT_UNVERIFIED. A guessed endpoint is as dangerous as a guessed locator.`,
        );
      }
    }
  }

  return messages.length === 0
    ? pass('SEM-AUTOMATION-HYGIENE', title, [
        `${sourceFiles.length} automation source file(s) and ${featureFiles.length} approved feature file(s) checked against ${HYGIENE_RULES.length} locator/wait rules.`,
      ])
    : fail('SEM-AUTOMATION-HYGIENE', title, messages);
}

/**
 * Every API scenario rests on a contract nobody guessed.
 *
 * The rule that matters most here is the OBSERVED one. Traffic captured from
 * the running application records what it *does*; asserting an acceptance
 * criterion against it would make the current behaviour the definition of
 * correct, so a bug would pass forever and only fail once someone fixed it.
 * Gate 2 is where a human converts OBSERVED into HUMAN_APPROVED, and this check
 * is what makes skipping that step impossible.
 */
function checkApiContracts(loaded: LoadedArtifacts): CheckResult {
  const id = 'SEM-API-CONTRACT';
  const title = 'API scenarios rest on an authoritative, tagged contract';

  const approvedPlanFiles = new Set(collectJsonFiles(PATHS.testPlansApproved));
  const messages: string[] = [];

  // testScenarioId -> declared interface, across approved plans only.
  const interfaceByScenario = new Map<string, 'UI' | 'API' | 'HYBRID'>();
  let apiScenarioCount = 0;

  for (const [file, plan] of loaded.testPlans) {
    const isApproved = approvedPlanFiles.has(file);
    for (const scenario of plan.scenarios) {
      const interfaceType = scenario.interfaceType ?? 'UI';
      if (isApproved) interfaceByScenario.set(scenario.testScenarioId, interfaceType);
      if (interfaceType === 'UI') continue;
      apiScenarioCount += 1;

      const contract = scenario.apiContract;
      if (contract === undefined) continue; // Already reported by TP-STRUCTURE.

      if (contract.responseContractRef && !exists(contract.responseContractRef)) {
        messages.push(
          `${file}: ${scenario.testScenarioId} references response contract "${contract.responseContractRef}", which does not exist.`,
        );
      }

      const authoritative = contract.contractSource === 'OPENAPI' || contract.contractSource === 'HUMAN_APPROVED';
      if (isApproved && contract.scaffoldingOnly !== true && !authoritative) {
        messages.push(
          `${file}: ${scenario.testScenarioId} asserts ${scenario.acIds.join(', ')} against a ${contract.contractSource} contract. ` +
            'Observed traffic describes what the application does, not what it should do. Agree the contract at Gate 2 (HUMAN_APPROVED) or mark it scaffoldingOnly.',
        );
      }

      // Scaffolding reaches a state; it never proves one.
      if (contract.scaffoldingOnly === true && interfaceType === 'API') {
        messages.push(
          `${file}: ${scenario.testScenarioId} is API-only and scaffoldingOnly. A scenario that only reaches a state asserts nothing, so it cannot cover ${scenario.acIds.join(', ')}. Use HYBRID, or drop scaffoldingOnly and agree the contract.`,
        );
      }
    }
  }

  // A feature scenario must declare the same interface its approved plan does.
  for (const file of listFilesRecursive(PATHS.featuresApproved, '.feature')) {
    const lines = readText(file).split(/\r?\n/);
    let pendingTags: string[] = [];
    let featureTags: string[] = [];

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (line.startsWith('@')) {
        pendingTags = pendingTags.concat(line.split(/\s+/).filter((tag) => tag.startsWith('@')));
        continue;
      }
      if (line.startsWith('Feature:')) {
        featureTags = pendingTags;
        pendingTags = [];
        continue;
      }
      if (!line.startsWith('Scenario:') && !line.startsWith('Scenario Outline:')) continue;

      const effective = featureTags.concat(pendingTags);
      pendingTags = [];

      const scenarioTag = effective.find((tag) => tag.startsWith('@ts-'));
      if (scenarioTag === undefined) continue; // SEM-FEATURE-TAGS reports this.

      const declared = interfaceByScenario.get(scenarioTag.slice('@ts-'.length));
      if (declared === undefined) continue;

      // Absence means UI, so a legacy feature file stays valid without edits.
      const interfaceTag = effective.find((tag) => tag.startsWith('@interface-'));
      const tagged = interfaceTag === undefined ? 'UI' : interfaceTag.slice('@interface-'.length).toUpperCase();

      if (tagged !== declared) {
        messages.push(
          `${file}: scenario "${line}" is tagged ${interfaceTag ?? '(no @interface- tag, meaning UI)'} but its approved test plan declares ${declared}. Add @interface-${declared.toLowerCase()}.`,
        );
      }
    }
  }

  if (apiScenarioCount === 0 && messages.length === 0) {
    return skip(id, title, 'No API or hybrid scenarios are declared in any test plan.');
  }

  return messages.length === 0
    ? pass(id, title, [`${apiScenarioCount} API/hybrid scenario(s) checked.`])
    : fail(id, title, messages);
}

function checkNoDuplicateBusinessScenarios(): CheckResult {
  const messages: string[] = [];
  const featureFiles = listFilesRecursive(PATHS.featuresApproved, '.feature');
  const scenarioTitles = new Map<string, string>();

  for (const file of featureFiles) {
    for (const rawLine of readText(file).split(/\r?\n/)) {
      const line = rawLine.trim();
      const match = /^Scenario(?: Outline)?:\s*(.+)$/.exec(line);
      if (!match) continue;
      const title = (match[1] ?? '').trim().toLowerCase();
      const existing = scenarioTitles.get(title);
      if (existing) {
        messages.push(`Business scenario "${match[1]}" is defined in both ${existing} and ${file}.`);
      } else {
        scenarioTitles.set(title, file);
      }
    }
  }

  // Manually authored technical specs must not re-implement a BDD scenario.
  for (const specFile of listFilesRecursive(PATHS.tests, '.ts')) {
    const content = readText(specFile);
    for (const [title, featureFile] of scenarioTitles) {
      if (content.toLowerCase().includes(`'${title}'`) || content.toLowerCase().includes(`"${title}"`)) {
        messages.push(
          `${specFile} duplicates the business scenario "${title}" already covered by ${featureFile}.`,
        );
      }
    }
    if (/@ts-[a-z0-9-]+/i.test(content)) {
      messages.push(`${specFile} carries a Test Scenario tag; business scenarios belong in feature files only.`);
    }
  }

  return messages.length === 0
    ? pass('SEM-NO-DUPLICATES', 'No duplicate executable tests exist for a business scenario')
    : fail('SEM-NO-DUPLICATES', 'No duplicate executable tests exist for a business scenario', messages);
}

function checkSampleDataIsolation(loaded: LoadedArtifacts): CheckResult {
  const messages: string[] = [];
  const classificationByStory = new Map<string, string>();

  for (const requirement of loaded.requirements.values()) {
    classificationByStory.set(requirement.story.jiraId, requirement.source.dataClassification);
  }

  for (const [file, plan] of loaded.testPlans) {
    for (const storyId of plan.jiraStoryIds) {
      const storyClassification = classificationByStory.get(storyId);
      if (storyClassification && storyClassification !== plan.dataClassification) {
        messages.push(
          `${file}: test plan is ${plan.dataClassification} but story ${storyId} is ${storyClassification}. Synthetic and real data must not be mixed.`,
        );
      }
    }
  }

  for (const [file, rtm] of loaded.rtms) {
    for (const entry of rtm.entries) {
      const storyClassification = classificationByStory.get(entry.jiraStoryId);
      if (storyClassification && storyClassification !== rtm.dataClassification) {
        messages.push(
          `${file}: RTM partition is ${rtm.dataClassification} but ${entry.jiraStoryId} is ${storyClassification}.`,
        );
      }
    }
  }

  for (const [file, defect] of loaded.defects) {
    const storyClassification = classificationByStory.get(defect.jiraStoryId);
    if (storyClassification && storyClassification !== defect.dataClassification) {
      messages.push(
        `${file}: defect report is ${defect.dataClassification} but story ${defect.jiraStoryId} is ${storyClassification}.`,
      );
    }
  }

  return messages.length === 0
    ? pass('SEM-SAMPLE-ISOLATION', 'Synthetic SAMPLE_DATA stays separated from real Jira data')
    : fail('SEM-SAMPLE-ISOLATION', 'Synthetic SAMPLE_DATA stays separated from real Jira data', messages);
}

/**
 * A defect report must be backed by a real failed execution, must not duplicate
 * an already-reported failure, and must not reach Jira before the governed
 * healing cap has genuinely been exhausted.
 */
function checkDefectEvidence(loaded: LoadedArtifacts): CheckResult {
  if (loaded.defects.size === 0) {
    return skip('SEM-DEFECT-EVIDENCE', 'Defect reports are backed by real failed executions', 'No defect reports found.');
  }

  const messages: string[] = [];
  const knownAcs = new Set<string>();
  for (const requirement of loaded.requirements.values()) {
    for (const ac of requirement.acceptanceCriteria) knownAcs.add(ac.acId);
  }

  const seenDefectIds = new Map<string, string>();
  const reportedFingerprints = new Map<string, string>();

  for (const [file, defect] of loaded.defects) {
    const duplicateId = seenDefectIds.get(defect.defectId);
    if (duplicateId) {
      messages.push(`${file}: defectId "${defect.defectId}" is already used by ${duplicateId}.`);
    } else {
      seenDefectIds.set(defect.defectId, file);
    }

    if (knownAcs.size > 0 && !knownAcs.has(defect.acId)) {
      messages.push(`${file}: references unknown acId "${defect.acId}".`);
    }

    if (!exists(defect.executionRecordPath)) {
      messages.push(
        `${file}: execution record "${defect.executionRecordPath}" does not exist. A defect can never be raised without a real execution.`,
      );
    } else {
      const record = readJson<{
        result?: string;
        scenarios?: { testScenarioId?: string; result?: string }[];
      }>(defect.executionRecordPath);
      const scenario = (record.scenarios ?? []).find(
        (item) => item.testScenarioId === defect.testScenarioId,
      );
      const observed = scenario?.result ?? record.result;
      if (observed !== undefined && observed !== 'FAILED' && observed !== 'TIMED_OUT') {
        messages.push(
          `${file}: ${defect.testScenarioId} is recorded as "${observed}" in ${defect.executionRecordPath}. A defect must not be raised for a scenario that did not fail.`,
        );
      }
    }

    if (!exists(defect.featureFile)) {
      messages.push(`${file}: points at missing feature file "${defect.featureFile}".`);
    }

    // Local evidence lives in git-ignored reports/defects/, so it is only
    // required while the defect still needs it. Once REPORTED, Jira holds the
    // attachments and is the system of record.
    if (defect.status !== 'REPORTED' && defect.status !== 'DUPLICATE') {
      for (const screenshot of defect.evidence.screenshots) {
        if (!exists(screenshot)) messages.push(`${file}: missing screenshot evidence "${screenshot}".`);
      }
      for (const trace of defect.evidence.traceFiles) {
        if (!exists(trace)) messages.push(`${file}: missing trace evidence "${trace}".`);
      }
    } else if (defect.jira !== null && defect.jira.attachmentsUploaded.length === 0) {
      const expected = defect.evidence.screenshots.length + defect.evidence.traceFiles.length;
      if (expected > 0 && !defect.evidence.attachmentsWithheld) {
        messages.push(
          `${file}: evidence was collected but nothing was uploaded to ${defect.jira.issueKey}. Set attachmentsWithheld if that was deliberate.`,
        );
      }
    }

    // A locator-suspect failure may only be reported once healing is exhausted.
    if (defect.status === 'REPORTED' && defect.classification === 'LOCATOR_SUSPECT') {
      messages.push(
        `${file}: a LOCATOR_SUSPECT failure was reported to Jira without exhausting the two governed healing attempts.`,
      );
    }

    if (defect.status === 'REPORTED') {
      const owner = reportedFingerprints.get(defect.fingerprint);
      if (owner) {
        messages.push(
          `${file}: fingerprint is already REPORTED by ${owner}. Duplicate Jira issues must be recorded as DUPLICATE with dedupeOf instead.`,
        );
      } else {
        reportedFingerprints.set(defect.fingerprint, file);
      }
    }
  }

  return messages.length === 0
    ? pass('SEM-DEFECT-EVIDENCE', 'Defect reports are backed by real failed executions', [
        `${loaded.defects.size} defect report(s) checked.`,
      ])
    : fail('SEM-DEFECT-EVIDENCE', 'Defect reports are backed by real failed executions', messages);
}

function checkVersionMonotonicity(loaded: LoadedArtifacts): CheckResult {
  const messages: string[] = [];
  const approvedByStory = new Map<string, JiraRequirementArtifact>();

  for (const [file, requirement] of loaded.requirements) {
    if (!file.startsWith(PATHS.requirementApproved)) continue;
    approvedByStory.set(requirement.story.jiraId, requirement);
  }

  for (const [file, requirement] of loaded.requirements) {
    if (!file.startsWith(PATHS.requirementNormalized)) continue;
    const approved = approvedByStory.get(requirement.story.jiraId);
    if (!approved) continue;
    if (requirement.artifactVersion < approved.artifactVersion) {
      messages.push(
        `${file}: working version ${requirement.artifactVersion} is lower than the approved version ${approved.artifactVersion}. Approved history must not be rewritten.`,
      );
    }
    if (
      requirement.artifactVersion === approved.artifactVersion &&
      JSON.stringify(requirement.acceptanceCriteria) !== JSON.stringify(approved.acceptanceCriteria)
    ) {
      messages.push(
        `${file}: content changed without increasing artifactVersion above the approved version ${approved.artifactVersion}.`,
      );
    }
  }

  return messages.length === 0
    ? pass('SEM-VERSIONS', 'Artifact versions increase when approved content changes')
    : fail('SEM-VERSIONS', 'Artifact versions increase when approved content changes', messages);
}

function checkWorkflowLocks(loaded: LoadedArtifacts): CheckResult {
  const messages: string[] = [];
  const lockedScopes = new Map<string, string>();

  for (const [file, state] of loaded.workflows) {
    if (state.processingLock === null) continue;
    for (const scope of state.processingLock.scope) {
      const owner = lockedScopes.get(scope);
      if (owner) {
        messages.push(
          `${file}: traceability artifact "${scope}" is locked concurrently by ${owner} and ${state.workflowId}.`,
        );
      } else {
        lockedScopes.set(scope, state.workflowId);
      }
    }
  }

  const seenWorkflowIds = new Set<string>();
  for (const [file, state] of loaded.workflows) {
    if (seenWorkflowIds.has(state.workflowId)) {
      messages.push(`${file}: duplicate workflowId "${state.workflowId}". One instance per story and release.`);
    }
    seenWorkflowIds.add(state.workflowId);
  }

  return messages.length === 0
    ? pass('SEM-LOCKS', 'No two workflows write to the same traceability artifact')
    : fail('SEM-LOCKS', 'No two workflows write to the same traceability artifact', messages);
}

export interface ValidationScope {
  requirements: boolean;
  workflow: boolean;
  rtm: boolean;
  artifacts: boolean;
}

export function runValidation(
  scope: 'requirements' | 'workflow' | 'rtm' | 'defects' | 'automation' | 'all',
): CheckResult[] {
  const results: CheckResult[] = [];
  const loaded = loadArtifacts(results);

  const structural = new Set([
    'REQ-STRUCTURE',
    'APR-STRUCTURE',
    'TP-STRUCTURE',
    'WF-STRUCTURE',
    'RTM-STRUCTURE',
    'DEF-STRUCTURE',
  ]);

  const semantic: CheckResult[] = [
    checkTemplateStructure(),
    checkReviewSections(loaded),
    checkNoPlaceholders(),
    checkApprovalEvidence(loaded),
    checkGateOrdering(loaded),
    checkRtmIntegrity(loaded),
    checkCoverageHonesty(loaded),
    checkFeatureTraceability(),
    checkOpenSpecChanges(),
    checkNoDuplicateBusinessScenarios(),
    checkSampleDataIsolation(loaded),
    checkVersionMonotonicity(loaded),
    checkWorkflowLocks(loaded),
    checkDefectEvidence(loaded),
    checkAutomationHygiene(loaded),
    checkApiContracts(loaded),
  ];

  const all = results.concat(semantic);
  if (scope === 'all') return all;

  const scopeFilter: Record<Exclude<typeof scope, 'all'>, string[]> = {
    requirements: ['REQ-STRUCTURE', 'APR-STRUCTURE', 'SEM-APPROVAL-EVIDENCE', 'SEM-VERSIONS', 'SEM-SAMPLE-ISOLATION', 'TPL-STRUCTURE', 'SEM-NO-PLACEHOLDERS'],
    workflow: ['WF-STRUCTURE', 'SEM-GATES', 'SEM-LOCKS', 'TPL-REVIEW-SECTIONS'],
    rtm: ['RTM-STRUCTURE', 'SEM-RTM', 'SEM-COVERAGE', 'SEM-FEATURE-TAGS', 'SEM-NO-DUPLICATES', 'SEM-OPENSPEC'],
    defects: ['DEF-STRUCTURE', 'SEM-DEFECT-EVIDENCE', 'SEM-SAMPLE-ISOLATION'],
    automation: ['SEM-AUTOMATION-HYGIENE', 'SEM-FEATURE-TAGS', 'SEM-NO-DUPLICATES', 'SEM-API-CONTRACT'],
  };

  const wanted = new Set(scopeFilter[scope]);
  return all.filter((result) => wanted.has(result.id) || (structural.has(result.id) && wanted.has(result.id)));
}
