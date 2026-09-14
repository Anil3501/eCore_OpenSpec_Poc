// Temporary: builds the Gate 2 v2 approval template from the v2 plan.
// Delete once TP-EC-12000-001 v2 is approved.
import { readFileSync, writeFileSync } from 'node:fs';

const planPath = 'test-plans/generated/TP-EC-12000-001.json';
const outPath = 'test-plans/generated/TP-EC-12000-001-v2-approval.template.json';

const plan = JSON.parse(readFileSync(planPath, 'utf8')) as {
  testPlanId: string;
  artifactVersion: number;
  release: string;
  capability: string;
  scenarios: { testScenarioId: string; title: string; automationDecision?: string }[];
};

const revised = new Set(['TS-EC-12000-016', 'TS-EC-12000-020']);

const itemDecisions = plan.scenarios.map((scenario) => ({
  itemId: scenario.testScenarioId,
  decision: 'REPLACE_WITH_APPROVE_OR_REJECT_OR_DEFER_OR_REQUEST_CHANGES',
  comment: revised.has(scenario.testScenarioId)
    ? `CHANGED IN v2 - read this one. ${scenario.title}`
    : `Unchanged from approved v1. ${scenario.title}`,
}));

const approval = {
  schemaVersion: '1.0.0',
  approvalId: 'APR-TP-EC-12000-001',
  gate: 'TEST_PLAN',
  artifactId: plan.testPlanId,
  artifactVersion: plan.artifactVersion,
  release: plan.release,
  capability: plan.capability,
  sourceArtifactPath: planPath,
  decision: 'REPLACE_WITH_APPROVE_OR_REJECT_OR_DEFER_OR_REQUEST_CHANGES',
  reviewer: {
    name: 'REPLACE_WITH_YOUR_NAME',
    role: 'REPLACE_WITH_YOUR_ROLE',
    reference: null,
  },
  reviewedAt: 'REPLACE_WITH_ISO_8601_TIMESTAMP',
  comments:
    'REPLACE_WITH_YOUR_ANSWER_TO_CLR-TP-EC-12000-002 (split the cover-page clause into the MANUAL_ONLY TS-EC-12000-020?) AND CLR-TP-EC-12000-003 (which pre-deployment record should TS-EC-12000-017 use, or should it be DEFERRED?). A question left unanswered here is a decision nobody made.',
  itemDecisions,
};

writeFileSync(outPath, `${JSON.stringify(approval, null, 2)}\n`, 'utf8');
console.log(`wrote ${outPath} with ${itemDecisions.length} item decisions`);
