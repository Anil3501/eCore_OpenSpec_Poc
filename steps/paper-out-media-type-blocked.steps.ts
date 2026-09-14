import { createBdd } from 'playwright-bdd';
import { test } from '../src/fixtures/test.ts';

/**
 * Deliberate placeholder step definitions for
 * features/approved/paper-out-export/paper-out-media-type.feature.
 *
 * playwright-bdd's generator (`npm run bdd`) requires every step text used by
 * an approved feature file to resolve to *some* definition, or generation
 * fails outright for the whole file - it does not skip just the affected
 * scenario. TS-EC-12000-011 through -015 and -017 cannot be given a real
 * implementation yet: either the recorded Media Type is not observable
 * anywhere in qa5 (BLOCKER-EC-12000-004, still open for -017's pre-change
 * fixture) or the eoRequestExport contract is unverified and lives outside
 * the ssweb browser app (BLOCKER-EC-12000-002). TS-EC-12000-019 and -020 are
 * MANUAL_ONLY per the approved plan. See
 * features/generated/paper-out-export/TP-EC-12000-001-automation-design.md
 * and reports/validation/TP-EC-12000-001-{browser,api}-validation.json.
 * Writing a real assertion here would mean guessing a locator or an endpoint -
 * exactly what AGENTS.md forbids.
 *
 * TS-EC-12000-007 through -010, -016 and -018 have all been implemented for
 * real in steps/paper-out-media-type.steps.ts: BLOCKER-EC-12000-004 was
 * resolved on 2026-09-14 for a currently-Authorized fixture once the Verify
 * Paper Out modal's package download was found to bundle the same activity
 * history report the Document History dialog reads.
 *
 * Every step below therefore throws a specific, honest failure identifying
 * the exact blocker rather than asserting anything. This is a real, visible
 * test failure - never a fabricated pass, never a `test.skip()` (which
 * AGENTS.md also forbids without waiver). It exists only so `npm run bdd` can
 * generate the approved feature file at all; each throw names precisely what
 * a human must resolve before the corresponding real step definition can
 * replace it.
 */
const { Given, When, Then } = createBdd(test);

const OBSERVABILITY_GAP =
  'BLOCKER-EC-12000-004: the recorded Media Type is not observable anywhere in qa5. A real ' +
  'transaction-level Paper Out was driven end to end against "test collection" on 2026-09-14 ' +
  '(submitted, then cancelled), and "Media Type" appeared on neither the Workspace, the Work ' +
  'Queue nor the transaction History dialog - the History recorded no Paper Out event at all. ' +
  'Two questions need a human before these steps can assert anything: (1) where is Media Type ' +
  'meant to surface in 26.3, and (2) is the recording change actually deployed to qa5? The ' +
  'remaining candidates (package cover page, activity history report) are reachable only via ' +
  'Verify, which permanently destroys vault documents, so they were not probed. See ' +
  'features/generated/paper-out-export/TP-EC-12000-001-automation-design.md and ' +
  'reports/validation/TP-EC-12000-001-browser-validation.json. ' +
  '(BLOCKER-EC-12000-001, the earlier "no qualifying fixture" gap, is RESOLVED: "test collection" ' +
  'qualifies and now backs TS-EC-12000-003.)';

const API_CONTRACT_GAP =
  'BLOCKER-EC-12000-002: eoRequestExport\'s endpoint URL, HTTP method and response shape remain ' +
  'unverified. It is confirmed to live entirely outside the ssweb browser app Playwright MCP ' +
  'drives (Postman-only in dev usage, absent from reports/validation/ecore-api-discovery.json), so ' +
  'its contract cannot be captured through browser exploration. A human must supply the ' +
  'integration endpoint (base URL/credentials) or an existing WSDL/integration-guide reference. ' +
  'See reports/validation/TP-EC-12000-001-api-validation.json.';

const MANUAL_ONLY =
  'TS-EC-12000-019 is MANUAL_ONLY per the approved test plan (test-plans/approved/TP-EC-12000-001.json): ' +
  'visual border alignment is not a reliable Playwright assertion target. A human reviewer must confirm ' +
  'this visually; this step definition exists only for traceability and must never report an automated pass.';

const MANUAL_ONLY_COVER_PAGE =
  'TS-EC-12000-020 is MANUAL_ONLY per the approved test plan v2 (test-plans/approved/TP-EC-12000-001-v2.json), ' +
  'split out of TS-EC-12000-016 at Gate 2 v2 (CLR-TP-EC-12000-002): the package cover page is a printed/' +
  'downloaded artifact, and confirming Media Type is visible on it needs a human to open the real downloaded ' +
  'file rather than a Playwright locator. This step definition exists only for traceability and must never ' +
  'report an automated pass.';

function blocked(reason: string): never {
  throw new Error(reason);
}

// --- TS-EC-12000-011 through -015 (eoRequestExport, HYBRID) ---
//
// TS-EC-12000-007 through -010 have been implemented for real in
// steps/paper-out-media-type.steps.ts: BLOCKER-EC-12000-004 was resolved on
// 2026-09-14 when the recorded Media Type was found in the DOCUMENT history's
// "Submitted Paper Out" event, a surface every earlier probe missed because it
// looked at the transaction history, where no Paper Out event is ever logged.

Given('eoRequestExport is available at the transaction level', async () => blocked(API_CONTRACT_GAP));
Given('eoRequestExport is available at the document level', async () => blocked(API_CONTRACT_GAP));
Given('eoRequestExport is available at both transaction and document level', async () => blocked(API_CONTRACT_GAP));
When('I call eoRequestExport at the transaction level with mediaType {string}', async ({}, _mediaType: string) =>
  blocked(API_CONTRACT_GAP),
);
When('I call eoRequestExport at the document level with mediaType {string}', async ({}, _mediaType: string) =>
  blocked(API_CONTRACT_GAP),
);
When('I call eoRequestExport without a mediaType element at transaction level', async () => blocked(API_CONTRACT_GAP));
When('I call eoRequestExport without a mediaType element at document level', async () => blocked(API_CONTRACT_GAP));
When("I open the transaction's Submitted Paper Out audit trail entry", async () => blocked(API_CONTRACT_GAP));
When("I open the document's Submitted Paper Out audit trail entry", async () => blocked(API_CONTRACT_GAP));
When('I open the Submitted Paper Out audit trail entry for both', async () => blocked(API_CONTRACT_GAP));
Then('the API call succeeds', async () => blocked(API_CONTRACT_GAP));
Then("the Media Type is recorded as {string} in the audit trail's Additional Information", async ({}, _mediaType: string) =>
  blocked(API_CONTRACT_GAP),
);
Then('both API calls succeed', async () => blocked(API_CONTRACT_GAP));
Then('the Media Type is recorded as {string} in both audit trail entries', async ({}, _mediaType: string) =>
  blocked(API_CONTRACT_GAP),
);

// --- TS-EC-12000-016 (Additional Information / activity history report) ---
// Implemented for real - see steps/paper-out-media-type.steps.ts. Its
// download-and-parse mechanism was validated live against qa5 on 2026-09-14.

// --- TS-EC-12000-017 (historical records not retroactively updated) ---

Given('a transaction or document had Paper Out\\/Export performed before this change was deployed', async () =>
  blocked(OBSERVABILITY_GAP),
);
When('I inspect its Additional Information and audit trail after deployment', async () => blocked(OBSERVABILITY_GAP));
Then('the existing record is not retroactively updated with Media Type information', async () =>
  blocked(OBSERVABILITY_GAP),
);

// --- TS-EC-12000-018 (Verify Paper Out modal verbiage) ---
// Implemented for real - see steps/paper-out-media-type.steps.ts. Its
// locators were validated live against qa5 on 2026-09-14.

// --- TS-EC-12000-019 (visual alignment, MANUAL_ONLY) ---

Given(
  'the redesigned Paper Out Request modal, including the new Media Type section, is rendered',
  async () => blocked(MANUAL_ONLY),
);
When('I observe the right side of the modal', async () => blocked(MANUAL_ONLY));
Then('the section borders are visually aligned', async () => blocked(MANUAL_ONLY));

// --- TS-EC-12000-020 (Media Type on the package cover page, MANUAL_ONLY) ---

Given('a Paper Out batch is Authorized and its package is downloadable', async () => blocked(MANUAL_ONLY_COVER_PAGE));
When('I choose Print for the batch in the Work Queue', async () => blocked(MANUAL_ONLY_COVER_PAGE));
When('I download the Paper Out package from the Verify Paper Out modal', async () => blocked(MANUAL_ONLY_COVER_PAGE));
Then("Media Type is visible on the downloaded package's cover page", async () => blocked(MANUAL_ONLY_COVER_PAGE));
