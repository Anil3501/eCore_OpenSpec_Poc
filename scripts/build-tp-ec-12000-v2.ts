import fs from 'node:fs';
import path from 'node:path';

/**
 * Builds TP-EC-12000-001 v2 from the approved v1.
 *
 * One-off transformation script rather than a hand-edited JSON copy: the plan
 * is ~700 lines and every field other than the ones named here must survive
 * byte-identical, because the reviewer at Gate 2 has to be able to see that
 * only the split was changed. Re-typing it by hand would make that
 * impossible to verify.
 */
const approvedPath = path.join('test-plans', 'approved', 'TP-EC-12000-001.json');
const outPath = path.join('test-plans', 'generated', 'TP-EC-12000-001.json');

const plan = JSON.parse(fs.readFileSync(approvedPath, 'utf8'));

plan.artifactVersion = 2;
plan.approvalStatus = 'PENDING_TEST_PLAN_APPROVAL';
plan.approvalRef = null;
plan.timestamps.updatedAt = '2026-09-14T14:20:00.000Z';
plan.timestamps.approvedAt = null;

const sixteen = plan.scenarios.find((s) => s.testScenarioId === 'TS-EC-12000-016');
if (sixteen === undefined) throw new Error('TS-EC-12000-016 not found in the approved plan.');

sixteen.title =
  'Media Type is recorded on the Submitted Paper Out event, not the Authorized one, and appears in the downloaded activity history report';
sixteen.steps = [
  'Submit a Paper Out.',
  "Inspect the Submitted Paper Out event's Additional Information in the document history.",
  "Inspect the Authorized Paper Out event's Additional Information.",
  'Download the document activity history report and inspect it.',
];
sixteen.expectedResult =
  'Media Type appears as Additional Information on the Submitted Paper Out event and is absent from the Authorized Paper Out event, and is present in the downloaded document activity history report. The package cover page is covered separately by TS-EC-12000-020.';
sixteen.scenarioAction = 'UPDATE';
sixteen.testDataRequirements = [
  'A transaction or document eligible for Paper Out.',
  'An already-Authorized Paper Out batch, for the Authorized-event half of the assertion.',
];

const coverPage = {
  testScenarioId: 'TS-EC-12000-020',
  title: 'Media Type is visible on the Paper Out package cover page',
  type: 'POSITIVE',
  acIds: ['AC-EC-12000-016'],
  preconditions: [
    'A Paper Out has been submitted and authorized, so the package is downloadable.',
  ],
  steps: [
    'Open the authorized batch in the Work Queue and choose Print.',
    'In the Verify Paper Out modal, download the Paper Out package.',
    'Inspect the cover page of the downloaded package.',
  ],
  expectedResult: 'Media Type is visible on the package cover page.',
  testDataRequirements: [
    'A Paper Out batch in the Authorized/Verification state whose package may be downloaded.',
  ],
  automationCandidate: false,
  automationDecision: 'MANUAL_ONLY',
  priority: 'MEDIUM',
  riskTag: 'risk-medium',
  suiteTag: 'suite-regression',
  scenarioAction: 'CREATE',
  interfaceType: 'UI',
};

plan.scenarios.splice(plan.scenarios.indexOf(sixteen) + 1, 0, coverPage);

const mapping = plan.coverageMappings.find((c) => c.acId === 'AC-EC-12000-016');
mapping.testScenarioIds = ['TS-EC-12000-016', 'TS-EC-12000-020'];

plan.clarifications.push(
  {
    clarificationId: 'CLR-TP-EC-12000-002',
    question:
      "AC-EC-12000-016 names four surfaces: the Submitted Paper Out event, the Authorized Paper Out event, the package cover page and the downloaded activity history report. Three were confirmed observable and automatable live against qa5 on 2026-09-14. The fourth, the cover page, was not: the package is served by getPrintableDocumentContents.eo, which returns HTML rather than a PDF while the batch is merely Submitted and yields the package only once the batch is Authorized. Authorizing the fixture is a one-way door - a Submitted request can be cancelled, but the only exit after authorization is Verify, which permanently removes the source documents from the vault and would consume the single qa5 collection that qualifies for Paper Out at all. Should the cover-page clause therefore be split into its own MANUAL_ONLY scenario (TS-EC-12000-020), leaving TS-EC-12000-016 to automate the other three surfaces?",
    status: 'REVIEW_REQUIRED',
  },
  {
    clarificationId: 'CLR-TP-EC-12000-003',
    question:
      'TS-EC-12000-017 requires a Paper Out record created BEFORE this change was deployed, so that it can be shown not to have been retroactively given a Media Type. No such record is reachable in qa5: the fixture document and four other collections were scanned on 2026-09-14 and every Submitted Paper Out event carries a Media Type, because all of them originate from this automation run. Note that Canceled Paper Out events legitimately carry no Media Type, so "any event lacking one" is not a safe proxy and would pass for the wrong reason. Which specific pre-deployment transaction or document should this scenario use, or should it be DEFERRED until one is identified?',
    status: 'REVIEW_REQUIRED',
  },
);

fs.writeFileSync(outPath, `${JSON.stringify(plan, null, 2)}\n`, 'utf8');
console.log('scenarios', plan.scenarios.length);
console.log('written', outPath);
