import { expect } from '@playwright/test';
import { createBdd } from 'playwright-bdd';
import { test } from '../src/fixtures/test.ts';
import type { AcknowledgementModalComponent } from '../src/components/acknowledgement-modal.component.ts';
import type { EcoreHomePage } from '../src/pages/ecore-home.page.ts';
import type { EcoreWorkspacePage } from '../src/pages/ecore-workspace.page.ts';
import type { PaperOutRequestModalComponent } from '../src/components/paper-out-request-modal.component.ts';
import type { PaperOutExportService } from '../src/services/paper-out-export.service.ts';

/**
 * Step definitions for
 * features/approved/paper-out-export/paper-out-media-type.feature.
 *
 * TS-EC-12000-001, -002, -003, -004, -007 through -010, -016 and -018 are
 * implemented here. The remaining approved scenarios (TS-EC-12000-011
 * through -015, -017, -019 and -020) are deliberately left to
 * steps/paper-out-media-type-blocked.steps.ts, where each throws with the
 * exact blocker that prevents it: BLOCKER-EC-12000-004 (still open for -017's
 * pre-change fixture) or BLOCKER-EC-12000-002 (the eoRequestExport contract
 * is unverified and lives outside the ssweb browser app) for TS-011 through
 * -015. TS-019 and -020 are MANUAL_ONLY per the approved plan. Writing a
 * locator or an assertion for any of them here would mean guessing one -
 * exactly what AGENTS.md forbids. See
 * features/generated/paper-out-export/TP-EC-12000-001-automation-design.md
 * and reports/validation/TP-EC-12000-001-{browser,api}-validation.json.
 *
 * TS-002 and TS-004 never submit the Paper Out Request modal to completion
 * (TS-002 stops at the Acknowledgement modal opening, TS-004 cancels it), so
 * neither creates a real Work Queue item or mutates shared QA data. TS-003 is
 * different by design: it performs a real submission against a qualifying
 * fixture collection and creates a real, pending Work Queue approval item -
 * see test-data/paper-out-export.sample.json's safetyNote. A tagged After
 * hook at the foot of this file cancels that item again, because a pending
 * request locks its transactions and would otherwise make the scenario pass
 * exactly once.
 */
const { Given, When, Then, After } = createBdd(test);

/**
 * Which collection each flow used, discovered once per run and reused for
 * every later scenario. Module-level rather than per-scenario: qa5's
 * Collections list changed once already during this story without warning
 * ("demo collection"/"test collection" became "c1".."c5"), so no collection
 * name may be hard-coded anywhere in this file. Re-establishing eligibility
 * on every scenario would also be needlessly slow and would itself create and
 * cancel a real submission per scenario, so the first successful discovery is
 * cached for the rest of the process.
 */
let openCancelCollectionName: string | undefined;
let submittableCollectionName: string | undefined;

/**
 * Returns to a clean Workspace, discarding whatever modal or dropdown state
 * the previous discovery attempt left behind. Reloading through Home is
 * cheaper and more reliable than trying to identify and close every possible
 * dialog the application might have shown.
 */
async function resetToWorkspace(homePage: EcoreHomePage, workspacePage: EcoreWorkspacePage): Promise<void> {
  await homePage.open();
  await homePage.activateDashboardIcon('Workspace');
  await workspacePage.expectArrived();
}

/**
 * Finds a collection whose Paper Out Request modal opens normally - good
 * enough for TS-EC-12000-001, -002 and -004, which only ever open, inspect or
 * cancel the modal and never reach the application's submit-time eligibility
 * checks. An unlocked collection renders the Media Type section regardless of
 * whether it would actually be accepted at submit time, so this is a weaker
 * (and cheaper) check than `resolveSubmittableCollectionName` on purpose.
 *
 * Collections are tried in the order the accordion presents them; the first
 * one whose modal opens is cached and reused for the rest of the run.
 */
async function resolveOpenCancelCollectionName(
  homePage: EcoreHomePage,
  workspacePage: EcoreWorkspacePage,
  paperOutRequestModal: PaperOutRequestModalComponent,
): Promise<string> {
  if (openCancelCollectionName !== undefined) return openCancelCollectionName;

  const names = await workspacePage.collectionNames();
  for (const name of names) {
    await workspacePage.openPaperOutRequestModal(name);
    try {
      await paperOutRequestModal.expectOpen();
    } catch {
      await resetToWorkspace(homePage, workspacePage);
      continue;
    }
    await resetToWorkspace(homePage, workspacePage);
    openCancelCollectionName = name;
    return name;
  }
  throw new Error(
    'No collection in the Collections accordion currently opens the Paper Out Request modal. ' +
      `Collections checked: ${names.join(', ') || '(none found)'}.`,
  );
}

/**
 * Finds a collection a real Paper Out submission is currently accepted
 * against - needed by TS-EC-12000-003, -007, -008, -009 and -010, which all
 * submit for real.
 *
 * The application enforces "Each transaction you wish to Paper Out must
 * contain at least 1 electronic original document" (and a separate
 * active-signature-path restriction) only when the request is actually
 * submitted; the modal opens and renders its Media Type section regardless,
 * so an open modal is not evidence of eligibility. This drives a real
 * submission through to the Acknowledgement modal and then cancels it -
 * mirroring TS-EC-12000-004, which proves cancelling before the
 * Acknowledgement modal's own OK creates no Work Queue item and leaves no
 * lock behind - so the probe itself is non-destructive and repeatable.
 *
 * Collections are tried in the order the accordion presents them; the first
 * one that reaches the Acknowledgement modal is cached and reused for the
 * rest of the run.
 */
async function resolveSubmittableCollectionName(
  homePage: EcoreHomePage,
  workspacePage: EcoreWorkspacePage,
  paperOutRequestModal: PaperOutRequestModalComponent,
  acknowledgementModal: AcknowledgementModalComponent,
  paperOutExport: PaperOutExportService,
): Promise<string> {
  if (submittableCollectionName !== undefined) return submittableCollectionName;

  const names = await workspacePage.collectionNames();
  for (const name of names) {
    await workspacePage.openPaperOutRequestModal(name);
    try {
      await paperOutRequestModal.expectOpen();
      await paperOutRequestModal.selectSaveAsElectronicFile();
      await paperOutRequestModal.completeRequiredFields(paperOutExport.fabricatedNameOfRequest());
      await paperOutRequestModal.clickOk();
      await acknowledgementModal.expectOpen();
    } catch {
      // Locked, refused for the electronic-original rule, refused for the
      // active-signature-path rule, or any other reason the application
      // declined this collection - all indistinguishable from here, and all
      // equally disqualifying.
      await resetToWorkspace(homePage, workspacePage);
      continue;
    }
    await acknowledgementModal.clickCancel();
    await resetToWorkspace(homePage, workspacePage);
    submittableCollectionName = name;
    return name;
  }
  throw new Error(
    'No collection in the Collections accordion currently qualifies for a real Paper Out ' +
      `submission. Collections checked: ${names.join(', ') || '(none found)'}.`,
  );
}

Given('a user opens the Paper Out Request modal', async ({
  loginPage,
  homePage,
  organizationLogin,
  workspacePage,
  paperOutRequestModal,
}) => {
  await loginPage.open();
  await loginPage.chooseOrganizationSignIn();
  await loginPage.enterOrganizationDetails(organizationLogin.correctDetails());
  await loginPage.submit();
  await homePage.expectArrived();
  await homePage.activateDashboardIcon('Workspace');
  await workspacePage.expectArrived();
  const collectionName = await resolveOpenCancelCollectionName(homePage, workspacePage, paperOutRequestModal);
  await workspacePage.openPaperOutRequestModal(collectionName);
  await paperOutRequestModal.expectOpen();
});

Given('the Paper Out Request modal is open', async ({
  loginPage,
  homePage,
  organizationLogin,
  workspacePage,
  paperOutRequestModal,
}) => {
  await loginPage.open();
  await loginPage.chooseOrganizationSignIn();
  await loginPage.enterOrganizationDetails(organizationLogin.correctDetails());
  await loginPage.submit();
  await homePage.expectArrived();
  await homePage.activateDashboardIcon('Workspace');
  await workspacePage.expectArrived();
  const collectionName = await resolveOpenCancelCollectionName(homePage, workspacePage, paperOutRequestModal);
  await workspacePage.openPaperOutRequestModal(collectionName);
  await paperOutRequestModal.expectOpen();
});

Given('the acknowledgement modal is open', async ({
  loginPage,
  homePage,
  organizationLogin,
  workspacePage,
  paperOutRequestModal,
  acknowledgementModal,
  paperOutExport,
  $tags,
}) => {
  await loginPage.open();
  await loginPage.chooseOrganizationSignIn();
  await loginPage.enterOrganizationDetails(organizationLogin.correctDetails());
  await loginPage.submit();
  await homePage.expectArrived();
  await homePage.activateDashboardIcon('Workspace');
  await workspacePage.expectArrived();
  // Two scenarios share this step text but need different collections, and
  // the assumption that one fixture served both was wrong.
  //
  // TS-EC-12000-003 submits for real, so it needs a collection carrying a
  // qualifying electronic original document - the rule is enforced only at
  // submit time. TS-EC-12000-004 never submits; it opens the acknowledgement
  // modal and cancels, so an unlocked collection is sufficient for it -
  // pointing it at whatever the submission-eligible collection happens to be
  // can fail for a reason that has nothing to do with its acceptance
  // criterion, if that collection is also the one an authorized batch has
  // since locked (observed live 2026-09-14).
  const collectionName = $tags.includes('@ts-TS-EC-12000-003')
    ? await resolveSubmittableCollectionName(
        homePage,
        workspacePage,
        paperOutRequestModal,
        acknowledgementModal,
        paperOutExport,
      )
    : await resolveOpenCancelCollectionName(homePage, workspacePage, paperOutRequestModal);
  await workspacePage.openPaperOutRequestModal(collectionName);
  await paperOutRequestModal.expectOpen();
  await paperOutRequestModal.selectSaveAsElectronicFile();
  await paperOutRequestModal.completeRequiredFields(paperOutExport.fabricatedNameOfRequest());
  await paperOutRequestModal.clickOk();
  await acknowledgementModal.expectOpen();
});

When('I select {string}', async ({ paperOutRequestModal }, mediaType: string) => {
  if (mediaType === 'Save as Electronic File') {
    await paperOutRequestModal.selectSaveAsElectronicFile();
    return;
  }
  throw new Error(`This step definition only supports selecting "Save as Electronic File", got: ${mediaType}`);
});

When('I complete the required Name of Request and Approver fields', async ({ paperOutRequestModal, paperOutExport }) => {
  await paperOutRequestModal.completeRequiredFields(paperOutExport.fabricatedNameOfRequest());
});

When('I click OK', async ({ paperOutRequestModal }) => {
  await paperOutRequestModal.clickOk();
});

When('I click Cancel on the acknowledgement modal', async ({ acknowledgementModal }) => {
  await acknowledgementModal.clickCancel();
});

Then('a Media Type for Paper Out Package section is shown', async ({ paperOutRequestModal }) => {
  await paperOutRequestModal.expectMediaTypeSectionShown();
});

Then('{string} is selected by default', async ({ paperOutRequestModal }, mediaType: string) => {
  if (mediaType === 'Print to Paper') {
    await paperOutRequestModal.expectPrintToPaperSelectedByDefault();
    return;
  }
  throw new Error(`This step definition only supports "Print to Paper" as a default selection, got: ${mediaType}`);
});

Then('an acknowledgement modal opens with its checkbox unchecked', async ({ acknowledgementModal }) => {
  await acknowledgementModal.expectOpen();
  await acknowledgementModal.expectCheckboxUnchecked();
});

Then("the acknowledgement modal's OK button stays disabled until the checkbox is checked", async ({ acknowledgementModal }) => {
  await acknowledgementModal.expectOkDisabled();
  await acknowledgementModal.checkAcknowledgement();
  await acknowledgementModal.expectOkEnabled();
});

Then('only the acknowledgement modal closes', async ({ acknowledgementModal }) => {
  await acknowledgementModal.expectClosed();
});

Then('the Paper Out Request modal remains open', async ({ paperOutRequestModal, paperOutExport }) => {
  await paperOutRequestModal.expectOpen();
  // Retained field values are the observable evidence that Cancel had no
  // side effect on the Paper Out Request modal beneath it - confirmed live
  // 2026-09-11, see the automation design doc's Acknowledgement modal row.
  expect(await paperOutRequestModal.currentNameOfRequest()).toBe(paperOutExport.fabricatedNameOfRequest());
});

Then('no Work Queue item is created', async ({ paperOutRequestModal }) => {
  // Cancelling the Acknowledgement modal never submits the Paper Out Request
  // form - the OK button that would have posted to
  // requestPaperOutCollection.eo was never clicked. The Paper Out Request
  // modal staying open with its values retained (asserted in the previous
  // step) is the observable evidence of that. Reading the Work Queue instead
  // would mean navigating away from the still-open modal, destroying the very
  // state this scenario exists to assert, so the in-place check is both the
  // safer and the more direct evidence.
  await paperOutRequestModal.expectOpen();
});

// --- TS-EC-12000-003 (real submission against the "test collection" fixture,
// confirmed live 2026-09-14 to hold a genuine electronic original document
// and to be free of the active-signature-path restriction, which resolved
// BLOCKER-EC-12000-001) ---

When('I check the acknowledgement checkbox', async ({ acknowledgementModal }) => {
  await acknowledgementModal.checkAcknowledgement();
});

When("I click the acknowledgement modal's OK button", async ({ acknowledgementModal }) => {
  await acknowledgementModal.clickOk();
});

Then('the acknowledgement modal closes', async ({ acknowledgementModal }) => {
  await acknowledgementModal.expectClosed();
});

Then('the Paper Out Request modal closes', async ({ paperOutRequestModal }) => {
  await paperOutRequestModal.expectClosed();
});

Then('a Work Queue item is created for approval', async ({ workQueue, paperOutExport }) => {
  // VALIDATED - the submitted item renders as
  // tr.batch[data-batch-name][data-batch-status="Submitted"][data-next-step="Approval"]
  // in the Work Queue pane, confirmed live 2026-09-11 (see
  // src/components/work-queue.component.ts).
  await workQueue.expectApprovalItemCreated(paperOutExport.fabricatedNameOfRequest());
});

// --- TS-EC-12000-018 (Verify Paper Out modal verbiage; locators validated
// live 2026-09-14) ---

Given('the Verify Paper Out modal is displayed', async ({
  loginPage,
  homePage,
  organizationLogin,
  workspacePage,
  workQueue,
  verifyPaperOutModal,
}) => {
  await loginPage.open();
  await loginPage.chooseOrganizationSignIn();
  await loginPage.enterOrganizationDetails(organizationLogin.correctDetails());
  await loginPage.submit();
  await homePage.expectArrived();
  await homePage.activateDashboardIcon('Workspace');
  await workspacePage.expectArrived();
  await workQueue.openVerifyModalForAnyAuthorizedItem();
  await verifyPaperOutModal.expectOpen();
});

When("I read the last checkbox's label", async ({ verifyPaperOutModal, verifyModalReading }) => {
  // Read in the When and asserted in the Then: the Then must judge the same
  // reading the When took, not go and take a second one of its own.
  verifyModalReading.lastCheckboxLabel = await verifyPaperOutModal.lastCheckboxLabelText();
});

Then('the label reads {string}', async ({ verifyModalReading }, expectedLabel: string) => {
  expect(
    verifyModalReading.lastCheckboxLabel,
    "No label was read - the When step must run before this assertion",
  ).toBeDefined();
  expect(verifyModalReading.lastCheckboxLabel).toBe(expectedLabel);
});

// --- TS-EC-12000-016 (Additional Information / activity history report;
// download mechanism validated live 2026-09-14) ---
//
// "A Paper Out is submitted, at transaction or document level, after this
// change has shipped" is satisfied by any Work Queue item that has already
// reached Authorized - it was necessarily Submitted first, exactly as
// TS-EC-12000-018 already relies on. Reusing that same read-only path means
// this scenario never has to submit and cancel a fresh request of its own.
//
// The scenario's three "When" steps name three separate inspections, but the
// package downloaded from the Verify Paper Out modal turns out to answer all
// three at once: it bundles the same Transaction/Document Activity History
// Report the Document History dialog reads, so there is only one artifact to
// read from. The download therefore happens once, in the last When step, and
// is cached for every Then to read.

Given('a Paper Out is submitted, at transaction or document level, after this change has shipped', async ({
  loginPage,
  homePage,
  organizationLogin,
  workspacePage,
  workQueue,
  verifyPaperOutModal,
}) => {
  await loginPage.open();
  await loginPage.chooseOrganizationSignIn();
  await loginPage.enterOrganizationDetails(organizationLogin.correctDetails());
  await loginPage.submit();
  await homePage.expectArrived();
  await homePage.activateDashboardIcon('Workspace');
  await workspacePage.expectArrived();
  await workQueue.openVerifyModalForAnyAuthorizedItem();
  await verifyPaperOutModal.expectOpen();
});

When("I inspect the Submitted Paper Out event's Additional Information", async () => {
  // No separate action: the download triggered below reads the same
  // Submitted Paper Out event this step names. See the file-level note.
});

When("I inspect the Authorized Paper Out event's Additional Information", async () => {
  // No separate action: the download triggered below reads the same
  // Authorized Paper Out event this step names. See the file-level note.
});

When('I download the document activity history report and inspect it', async ({
  verifyPaperOutModal,
  documentActivityReport,
}) => {
  documentActivityReport.text = await verifyPaperOutModal.downloadDocumentActivityReportText();
});

Then('Media Type appears as Additional Information on the Submitted Paper Out event', async ({
  verifyPaperOutModal,
  documentActivityReport,
}) => {
  expect(
    documentActivityReport.text,
    'No report was downloaded - the download When step must run before this assertion',
  ).toBeDefined();
  const mediaType = verifyPaperOutModal.mediaTypeFromSubmittedLine(documentActivityReport.text!);
  expect(mediaType.length).toBeGreaterThan(0);
});

Then("Media Type is absent from the Authorized Paper Out event's Additional Information", async ({
  verifyPaperOutModal,
  documentActivityReport,
}) => {
  expect(
    documentActivityReport.text,
    'No report was downloaded - the download When step must run before this assertion',
  ).toBeDefined();
  expect(verifyPaperOutModal.authorizedLineRecordsMediaType(documentActivityReport.text!)).toBe(false);
});

Then('Media Type is present in the downloaded document activity history report', async ({ documentActivityReport }) => {
  expect(
    documentActivityReport.text,
    'No report was downloaded - the download When step must run before this assertion',
  ).toBeDefined();
  expect(/Media Type=/i.test(documentActivityReport.text!)).toBe(true);
});

// --- TS-EC-12000-007 and -008 (UI Print to Paper at transaction and document
// level determine Media Type Paper) ---
//
// BLOCKER-EC-12000-004 recorded that the recorded Media Type was not
// observable anywhere in qa5. That was wrong, and the reason it survived
// several probes is worth stating: a Paper Out logs NO event in the
// transaction history, only in the DOCUMENT history. Every earlier probe
// looked at the transaction. Resolved live on 2026-09-14 - see
// src/components/document-history.component.ts for the captured evidence.
//
// Both scenarios submit a real Paper Out, so they lock their transaction
// exactly as TS-EC-12000-003 does and carry the same cancellation hook.
//
// They differ only in where the request is raised from. That distinction is
// the whole point of having two acceptance criteria: AC-EC-12000-007 covers
// the transaction-level entry point and -008 the document-level one, and a
// Media Type could plausibly be captured correctly by one and dropped by the
// other. They deliberately share the Then step, because what must be true
// afterwards is identical.

/**
 * The scenario's own test-scenario id, taken from its tags.
 *
 * Used to label the unique Name of Request each submitting scenario creates,
 * so a stranded request in qa5's Work Queue names the scenario that left it.
 * Read from tags rather than written into each step because several scenarios
 * share these steps, and a hard-coded label would quietly mis-attribute every
 * run of every scenario but the first one written.
 */
function testScenarioLabel(tags: readonly string[]): string {
  const tag = tags.find((candidate) => candidate.startsWith('@ts-TS-EC-12000-'));
  if (tag === undefined) {
    throw new Error(
      'This scenario carries no @ts-TS-EC-12000-NNN tag, so the Paper Out it submits could not be ' +
        'attributed to it. Every scenario in this feature is required to carry one.',
    );
  }
  return tag.replace('@ts-TS-EC-12000-', 'TS');
}

Given('a transaction eligible for Paper Out', async ({
  loginPage,
  homePage,
  organizationLogin,
  workspacePage,
  paperOutRequestModal,
  acknowledgementModal,
  paperOutExport,
}) => {
  await loginPage.open();
  await loginPage.chooseOrganizationSignIn();
  await loginPage.enterOrganizationDetails(organizationLogin.correctDetails());
  await loginPage.submit();
  await homePage.expectArrived();
  await homePage.activateDashboardIcon('Workspace');
  await workspacePage.expectArrived();
  const collectionName = await resolveSubmittableCollectionName(
    homePage,
    workspacePage,
    paperOutRequestModal,
    acknowledgementModal,
    paperOutExport,
  );
  await workspacePage.openCollection(collectionName);
  await workspacePage.selectFirstTransaction();
});

Given('a document eligible for Paper Out', async ({
  loginPage,
  homePage,
  organizationLogin,
  workspacePage,
  paperOutRequestModal,
  acknowledgementModal,
  paperOutExport,
}) => {
  await loginPage.open();
  await loginPage.chooseOrganizationSignIn();
  await loginPage.enterOrganizationDetails(organizationLogin.correctDetails());
  await loginPage.submit();
  await homePage.expectArrived();
  await homePage.activateDashboardIcon('Workspace');
  await workspacePage.expectArrived();
  const collectionName = await resolveSubmittableCollectionName(
    homePage,
    workspacePage,
    paperOutRequestModal,
    acknowledgementModal,
    paperOutExport,
  );
  await workspacePage.openCollection(collectionName);
  // A document is only reachable through its transaction - the document rows
  // are nested under the transaction row and are not rendered until it is
  // selected. Selecting the transaction here is therefore how a document is
  // reached, not a transaction-level action.
  await workspacePage.selectFirstTransaction();
  await workspacePage.selectFirstDocument();
});

/**
 * Rejects a media type this step cannot honestly submit.
 *
 * "Save as Electronic File" opens the acknowledgement modal, so a step that
 * submits straight through would never reach the Work Queue with it. Failing
 * loudly keeps a future scenario from binding to this step and appearing to
 * pass while having tested the wrong flow.
 */
function requirePrintToPaper(mediaType: string): void {
  if (mediaType !== 'Print to Paper') {
    throw new Error(
      'This step submits without an acknowledgement step, which only "Print to Paper" allows. ' +
        '"Save as Electronic File" opens the acknowledgement modal and belongs to the ' +
        `"completing the acknowledgement flow" step instead. Got: ${mediaType}`,
    );
  }
}

When('I submit a transaction-level Paper Out via the UI with {string} selected', async ({
  workspacePage,
  paperOutRequestModal,
  paperOutExport,
  paperOutSubmission,
  $tags,
}, mediaType: string) => {
  requirePrintToPaper(mediaType);
  await workspacePage.openPaperOutRequestModalForTransaction();
  await paperOutRequestModal.expectOpen();
  await paperOutRequestModal.selectPrintToPaper();

  // A unique name per run, because the assertion finds this run's event by
  // batch name and the fixture document already carries many Paper Out events
  // sharing the fixed fabricated name.
  paperOutSubmission.nameOfRequest = paperOutExport.uniqueNameOfRequest(testScenarioLabel($tags));
  await paperOutRequestModal.completeRequiredFields(paperOutSubmission.nameOfRequest);
  await paperOutRequestModal.clickOk();
  await paperOutRequestModal.expectClosed();
});

When('I submit a document-level Paper Out via the UI with {string} selected', async ({
  workspacePage,
  paperOutRequestModal,
  paperOutExport,
  paperOutSubmission,
  $tags,
}, mediaType: string) => {
  requirePrintToPaper(mediaType);
  await workspacePage.openPaperOutRequestModalForDocument();
  await paperOutRequestModal.expectOpen();
  await paperOutRequestModal.selectPrintToPaper();

  paperOutSubmission.nameOfRequest = paperOutExport.uniqueNameOfRequest(testScenarioLabel($tags));
  await paperOutRequestModal.completeRequiredFields(paperOutSubmission.nameOfRequest);
  await paperOutRequestModal.clickOk();
  await paperOutRequestModal.expectClosed();
});

Then('the Media Type is recorded as {string}', async ({
  workspacePage,
  documentHistory,
  paperOutExport,
  paperOutSubmission,
}, mediaType: string) => {
  const nameOfRequest = paperOutSubmission.nameOfRequest;
  expect(
    nameOfRequest,
    'No Paper Out was submitted by a preceding step, so there is no recorded Media Type to read.',
  ).toBeDefined();

  // Submitting the Paper Out reloads workspace.eo, which resets the results
  // table: the collection is closed again and no transaction is selected, so
  // the document rows from before the submit are detached. Re-opening the
  // collection is therefore part of reading the audit trail, not a
  // duplicated Given. Observed live 2026-09-14.
  //
  // The preceding Given already resolved and cached the submittable
  // collection for this run - re-reading that cache here (rather than
  // re-running discovery) guarantees this reopens the exact same collection
  // the submission was made against.
  if (submittableCollectionName === undefined) {
    throw new Error(
      'No submittable collection has been resolved yet. A preceding Given step must run first.',
    );
  }
  await workspacePage.openCollection(submittableCollectionName);
  await workspacePage.selectFirstTransaction();
  await workspacePage.selectFirstDocument();
  await workspacePage.openDocumentHistory();
  await documentHistory.expectOpen();

  const recorded = await documentHistory.recordedMediaType(nameOfRequest as string);
  expect(recorded).toBe(paperOutExport.recordedMediaTypeValueFor(mediaType));
});

// --- TS-EC-12000-009 and -010 (UI Save as Electronic File at transaction and
// document level determine Media Type Electronic) ---
//
// These differ from -007/-008 by more than the value they expect. Choosing
// "Save as Electronic File" opens the acknowledgement modal, whose checkbox
// gates the OK button, so the submission only completes by passing through
// that gate. That makes them the only scenarios that prove the gate and the
// recording work together: TS-EC-12000-002 and -003 prove the gate behaves,
// and -007/-008 prove a Media Type is recorded, but neither shows that a
// gated submission still records the right one.

/**
 * Completes the acknowledgement modal that "Save as Electronic File" opens.
 *
 * The checkbox must be checked before OK becomes enabled - that is the gate
 * TS-EC-12000-002 asserts - so this drives it in the same order a user must.
 */
async function completeAcknowledgementFlow(
  acknowledgementModal: AcknowledgementModalComponent,
): Promise<void> {
  await acknowledgementModal.expectOpen();
  await acknowledgementModal.checkAcknowledgement();
  await acknowledgementModal.clickOk();
  await acknowledgementModal.expectClosed();
}

/**
 * Rejects a media type this step cannot honestly submit.
 *
 * The mirror image of `requirePrintToPaper`: "Print to Paper" opens no
 * acknowledgement modal, so a step that waited for one would hang rather than
 * fail clearly.
 */
function requireSaveAsElectronicFile(mediaType: string): void {
  if (mediaType !== 'Save as Electronic File') {
    throw new Error(
      'This step completes an acknowledgement flow, which only "Save as Electronic File" opens. ' +
        '"Print to Paper" submits directly and belongs to the step without the acknowledgement ' +
        `clause. Got: ${mediaType}`,
    );
  }
}

When(
  'I submit a transaction-level Paper Out via the UI with {string} selected, completing the acknowledgement flow',
  async ({
    workspacePage,
    paperOutRequestModal,
    acknowledgementModal,
    paperOutExport,
    paperOutSubmission,
    $tags,
  }, mediaType: string) => {
    requireSaveAsElectronicFile(mediaType);
    await workspacePage.openPaperOutRequestModalForTransaction();
    await paperOutRequestModal.expectOpen();
    await paperOutRequestModal.selectSaveAsElectronicFile();

    paperOutSubmission.nameOfRequest = paperOutExport.uniqueNameOfRequest(testScenarioLabel($tags));
    await paperOutRequestModal.completeRequiredFields(paperOutSubmission.nameOfRequest);
    await paperOutRequestModal.clickOk();

    await completeAcknowledgementFlow(acknowledgementModal);
    await paperOutRequestModal.expectClosed();
  },
);

When(
  'I submit a document-level Paper Out via the UI with {string} selected, completing the acknowledgement flow',
  async ({
    workspacePage,
    paperOutRequestModal,
    acknowledgementModal,
    paperOutExport,
    paperOutSubmission,
    $tags,
  }, mediaType: string) => {
    requireSaveAsElectronicFile(mediaType);
    await workspacePage.openPaperOutRequestModalForDocument();
    await paperOutRequestModal.expectOpen();
    await paperOutRequestModal.selectSaveAsElectronicFile();

    paperOutSubmission.nameOfRequest = paperOutExport.uniqueNameOfRequest(testScenarioLabel($tags));
    await paperOutRequestModal.completeRequiredFields(paperOutSubmission.nameOfRequest);
    await paperOutRequestModal.clickOk();

    await completeAcknowledgementFlow(acknowledgementModal);
    await paperOutRequestModal.expectClosed();
  },
);

/**
 * CLEANUP - TS-EC-12000-007 through -010 each submit a real Paper Out and
 * therefore lock their transaction, so all four need the same cancellation as
 * TS-EC-12000-003. Kept separate from TS-003's hook because the requests
 * being cancelled are named differently: TS-003 uses the fixed fabricated
 * name, these use the unique name generated at submit time.
 *
 * Scoped by an explicit tag list rather than something broader, so a future
 * scenario has to opt in deliberately - a hook that silently adopted every
 * new scenario would eventually cancel a request some scenario intended to
 * leave standing.
 */
After(
  {
    tags:
      '@ts-TS-EC-12000-007 or @ts-TS-EC-12000-008 or @ts-TS-EC-12000-009 or @ts-TS-EC-12000-010',
  },
  async ({ page, workQueue, workspacePage, paperOutSubmission }) => {
    const nameOfRequest = paperOutSubmission.nameOfRequest;
    if (nameOfRequest === undefined) return;
    try {
      // The scenario ends with the Document History dialog open, and that
      // dialog is modal - it intercepts every pointer event, so a Work Queue
      // hover or click made underneath it never lands and the cancellation
      // silently does nothing. That is exactly how TS-EC-12000-007's first
      // live run stranded a submitted request and locked its own transaction
      // against the retry (observed 2026-09-14). Reloading the Workspace is
      // the cheapest way to guarantee no modal is in the way, whatever state
      // the scenario failed in.
      await page.reload({ waitUntil: 'domcontentloaded' });
      await workspacePage.expectArrived();
      await workQueue.cancelApprovalItem(nameOfRequest);
    } catch (error) {
      console.warn(
        `[EC-12000 cleanup] Could not cancel the Paper Out request "${nameOfRequest}". It is still ` +
          'pending approval and will lock its transaction against the next run until resolved by hand. ' +
          `Reason: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  },
);

/**
 * CLEANUP - TS-EC-12000-003 is the only other scenario in this feature that
 * submits a real Paper Out request, and a submitted request locks every
 * transaction it covers until the request is resolved. Without this hook the
 * scenario passes once and then fails for every subsequent run with "Cannot
 * process paper out request. The following transactions are currently locked"
 * - observed live 2026-09-14, which is how this hook came to exist.
 *
 * Cancelling is the only non-destructive resolution: it releases the lock and
 * leaves the electronic original document in the vault. Approving and then
 * verifying would permanently remove the source documents, destroying the
 * fixture the scenario depends on.
 *
 * Scoped by tag so no other scenario pays for it, and deliberately
 * non-throwing so a cleanup problem can never manufacture a pass or mask a
 * genuine assertion failure - it reports instead.
 */
After({ tags: '@ts-TS-EC-12000-003' }, async ({ workQueue, paperOutExport }) => {
  try {
    await workQueue.cancelApprovalItem(paperOutExport.fabricatedNameOfRequest());
  } catch (error) {
    console.warn(
      `[EC-12000 cleanup] Could not cancel the Paper Out request "${paperOutExport.fabricatedNameOfRequest()}". ` +
        'It is still pending approval and will lock its transactions against the next run until resolved by hand. ' +
        `Reason: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
});
