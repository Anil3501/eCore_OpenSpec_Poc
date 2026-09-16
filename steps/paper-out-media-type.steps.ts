import { expect } from '@playwright/test';
import { createBdd } from 'playwright-bdd';
import { test } from '../src/fixtures/test.ts';
import type { AcknowledgementModalComponent } from '../src/components/acknowledgement-modal.component.ts';
import type { EcoreHomePage } from '../src/pages/ecore-home.page.ts';
import type { EcoreWorkspacePage } from '../src/pages/ecore-workspace.page.ts';
import type { PaperOutRequestModalComponent } from '../src/components/paper-out-request-modal.component.ts';
import type { PaperOutExportService } from '../src/services/paper-out-export.service.ts';
import type { MediaType } from '../src/api/eo-request-export.client.ts';

/**
 * Step definitions for
 * features/approved/paper-out-export/paper-out-media-type.feature.
 *
 * TS-EC-12000-001 through -004, -007 through -016 and -018 are implemented
 * here. The remaining approved scenarios (TS-EC-12000-017, -019 and -020) are
 * deliberately left to steps/paper-out-media-type-blocked.steps.ts, where
 * each throws with the exact blocker that prevents it: BLOCKER-EC-12000-004
 * (still open for -017's pre-change fixture). TS-019 and -020 are
 * MANUAL_ONLY per the approved plan. Writing a locator or an assertion for
 * any of them here would mean guessing one - exactly what AGENTS.md forbids.
 * See features/generated/paper-out-export/TP-EC-12000-001-automation-design.md
 * and reports/validation/TP-EC-12000-001-{browser,api}-validation.json.
 *
 * TS-EC-12000-011 through -015 (HYBRID) were implemented once
 * BLOCKER-EC-12000-002 was resolved: `eoRequestExport`'s contract was
 * captured live against qa5 on 2026-09-15/16 (see
 * src/api/eo-request-export.client.ts and
 * reports/validation/TP-EC-12000-001-api-validation.json), and Gate 3 v4
 * (`APR-AD-EC-12000-004`) approved judging their AC exclusively through the
 * UI audit trail - the API call only ever seeds state, per AGENTS.md rule 4.
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
const { Given, When, Then, Before, After } = createBdd(test);

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
let secondaryOpenCancelCollectionName: string | undefined;

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
      // VALIDATED - confirmed live against qa5 on 2026-09-16: when a
      // collection's only transaction is locked (e.g. sitting at
      // Authorized/Verification), opening the Paper Out Request modal shows
      // a "Cannot process paper out request. The following transactions are
      // currently locked:" error, rendered inside a dialog that reuses the
      // exact same "Paper Out® Request" title as the real modal. expectOpen()
      // alone cannot tell the two apart, so a locked collection was
      // previously misidentified as eligible. Asserting the Media Type
      // section - present only on the real modal - is what actually proves
      // this collection is usable.
      await paperOutRequestModal.expectMediaTypeSectionShown();
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
 * Finds a second, distinct open-cancel-eligible collection for
 * TS-EC-12000-015, which needs two independent transaction/document targets:
 * a transaction-level export locks the document it targets, so re-using the
 * single collection `resolveOpenCancelCollectionName` already cached for a
 * document-level call against the very same document is rejected by the
 * application with DOCUMENT_LOCK_ERROR (confirmed live against qa5 on
 * 2026-09-15). Reuses the same open-cancel eligibility check, just applied to
 * whichever remaining collection differs from the primary one.
 */
async function resolveSecondaryOpenCancelCollectionName(
  homePage: EcoreHomePage,
  workspacePage: EcoreWorkspacePage,
  paperOutRequestModal: PaperOutRequestModalComponent,
  primaryCollectionName: string,
): Promise<string> {
  if (secondaryOpenCancelCollectionName !== undefined) return secondaryOpenCancelCollectionName;

  const names = await workspacePage.collectionNames();
  for (const name of names) {
    if (name === primaryCollectionName) continue;
    await workspacePage.openPaperOutRequestModal(name);
    try {
      await paperOutRequestModal.expectOpen();
      // VALIDATED - see the identical check and its 2026-09-16 evidence in
      // resolveOpenCancelCollectionName above: a locked-transaction
      // collection's error dialog shares expectOpen()'s title with the real
      // modal, so the Media Type section must also be confirmed.
      await paperOutRequestModal.expectMediaTypeSectionShown();
    } catch {
      await resetToWorkspace(homePage, workspacePage);
      continue;
    }
    await resetToWorkspace(homePage, workspacePage);
    secondaryOpenCancelCollectionName = name;
    return name;
  }
  throw new Error(
    'No collection other than ' +
      `"${primaryCollectionName}" currently opens the Paper Out Request modal, so TS-EC-12000-015 ` +
      'has no second, distinct target. Collections checked: ' +
      `${names.filter((n) => n !== primaryCollectionName).join(', ') || '(none found)'}.`,
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
      // VALIDATED - same 2026-09-16 finding as resolveOpenCancelCollectionName:
      // a collection with a locked transaction renders an error dialog under
      // the identical "Paper Out® Request" title, with no Media Type section
      // and no radios at all. Without this check, selectSaveAsElectronicFile()
      // below waits out its own ~30s actionability timeout per locked
      // collection before this catch ever runs - slow enough by itself to
      // exceed this scenario's test timeout. Confirming the Media Type
      // section first makes a locked collection fail in milliseconds instead.
      await paperOutRequestModal.expectMediaTypeSectionShown();
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

// --- TS-EC-12000-011 through -015 (eoRequestExport, HYBRID) ---
//
// These scenarios reach a transaction and/or document through the UI to
// capture its vault id, call eoRequestExport with that id (the only
// authoritative source of a real id - AGENTS.md forbids inventing one), and
// then judge the outcome exclusively through the same UI audit trail every
// other scenario in this feature uses (DocumentHistoryComponent). The API
// call never itself proves the AC, matching Gate 3 v4's approved design.
//
// A Paper Out event - transaction-level or document-level - is logged only
// in the DOCUMENT's history, never the transaction's (BLOCKER-EC-12000-004's
// resolution, 2026-09-14), so every "open ... audit trail entry" step below
// re-reaches the same document regardless of which level its API call
// targeted.

/**
 * These five scenarios chain more real network round trips than any other
 * scenario in this feature: a UI sign-in and navigation, `eoLogin` (observed
 * live against qa5 at ~12.5s on its own, via a throwaway diagnostic script
 * since removed - it was never part of the governed suite), the
 * `eoRequestExport` call itself, a second UI re-navigation to reopen the
 * document, and the Document History dialog. The framework default of 45s
 * (playwright.config.ts) was exceeded by the real first run on 2026-09-16.
 * Raising it only for these five scenarios - rather than globally - keeps
 * every faster scenario's timeout as a real regression signal.
 */
Before(
  {
    tags:
      '@ts-TS-EC-12000-011 or @ts-TS-EC-12000-012 or @ts-TS-EC-12000-013 or @ts-TS-EC-12000-014 or @ts-TS-EC-12000-015',
  },
  async () => {
    test.setTimeout(120_000);
  },
);


/**
 * Casts a Gherkin mediaType string to the API's own enum, refusing anything
 * that is not one of the two values `export-26.3.xsd` defines. Guards
 * against a future scenario silently binding to this step with a value the
 * client was never validated against.
 */
function toApiMediaType(value: string): MediaType {
  if (value === 'PrintToPaper' || value === 'SaveAsElectronicFile') return value;
  throw new Error(`Unsupported eoRequestExport mediaType "${value}". Only PrintToPaper and SaveAsElectronicFile are validated.`);
}

Given('eoRequestExport is available at the transaction level', async ({
  loginPage,
  homePage,
  organizationLogin,
  workspacePage,
  paperOutRequestModal,
  hybridExportContext,
}) => {
  await loginPage.open();
  await loginPage.chooseOrganizationSignIn();
  await loginPage.enterOrganizationDetails(organizationLogin.correctDetails());
  await loginPage.submit();
  await homePage.expectArrived();
  await homePage.activateDashboardIcon('Workspace');
  await workspacePage.expectArrived();
  const collectionName = await resolveOpenCancelCollectionName(homePage, workspacePage, paperOutRequestModal);
  await workspacePage.openCollection(collectionName);
  hybridExportContext.transactionId = await workspacePage.selectFirstTransaction();
});

Given('eoRequestExport is available at the document level', async ({
  loginPage,
  homePage,
  organizationLogin,
  workspacePage,
  paperOutRequestModal,
  hybridExportContext,
}) => {
  await loginPage.open();
  await loginPage.chooseOrganizationSignIn();
  await loginPage.enterOrganizationDetails(organizationLogin.correctDetails());
  await loginPage.submit();
  await homePage.expectArrived();
  await homePage.activateDashboardIcon('Workspace');
  await workspacePage.expectArrived();
  const collectionName = await resolveOpenCancelCollectionName(homePage, workspacePage, paperOutRequestModal);
  await workspacePage.openCollection(collectionName);
  // A document is only reachable through its transaction - see the identical
  // note on the "a document eligible for Paper Out" Given above.
  await workspacePage.selectFirstTransaction();
  hybridExportContext.documentId = await workspacePage.selectFirstDocumentId();
});

Given('eoRequestExport is available at both transaction and document level', async ({
  loginPage,
  homePage,
  organizationLogin,
  workspacePage,
  paperOutRequestModal,
  hybridExportContext,
}) => {
  await loginPage.open();
  await loginPage.chooseOrganizationSignIn();
  await loginPage.enterOrganizationDetails(organizationLogin.correctDetails());
  await loginPage.submit();
  await homePage.expectArrived();
  await homePage.activateDashboardIcon('Workspace');
  await workspacePage.expectArrived();
  // Two distinct collections are required here (see the doc comment on
  // resolveSecondaryOpenCancelCollectionName): the transaction-level call
  // locks the document it targets, so a document-level call against that
  // same document is rejected with DOCUMENT_LOCK_ERROR.
  const transactionCollectionName = await resolveOpenCancelCollectionName(homePage, workspacePage, paperOutRequestModal);
  await workspacePage.openCollection(transactionCollectionName);
  hybridExportContext.transactionId = await workspacePage.selectFirstTransaction();
  hybridExportContext.transactionCollectionName = transactionCollectionName;

  const documentCollectionName = await resolveSecondaryOpenCancelCollectionName(
    homePage,
    workspacePage,
    paperOutRequestModal,
    transactionCollectionName,
  );
  await resetToWorkspace(homePage, workspacePage);
  await workspacePage.openCollection(documentCollectionName);
  // A document is only reachable through its transaction - see the identical
  // note on the "a document eligible for Paper Out" Given above.
  await workspacePage.selectFirstTransaction();
  hybridExportContext.documentId = await workspacePage.selectFirstDocumentId();
  hybridExportContext.documentCollectionName = documentCollectionName;
});

When('I call eoRequestExport at the transaction level with mediaType {string}', async ({
  eoExportApi,
  paperOutExport,
  hybridExportContext,
  $tags,
}, mediaType: string) => {
  const transactionId = hybridExportContext.transactionId;
  expect(transactionId, 'No transaction id was captured by a preceding Given step.').toBeDefined();
  const batchName = paperOutExport.uniqueNameOfRequest(testScenarioLabel($tags));
  await eoExportApi.requestExport({
    level: 'transaction',
    id: transactionId as string,
    batchName,
    mediaType: toApiMediaType(mediaType),
  });
  hybridExportContext.transactionBatchName = batchName;
});

When('I call eoRequestExport at the document level with mediaType {string}', async ({
  eoExportApi,
  paperOutExport,
  hybridExportContext,
  $tags,
}, mediaType: string) => {
  const documentId = hybridExportContext.documentId;
  expect(documentId, 'No document id was captured by a preceding Given step.').toBeDefined();
  const batchName = paperOutExport.uniqueNameOfRequest(testScenarioLabel($tags));
  await eoExportApi.requestExport({
    level: 'document',
    id: documentId as string,
    batchName,
    mediaType: toApiMediaType(mediaType),
  });
  hybridExportContext.documentBatchName = batchName;
});

When('I call eoRequestExport without a mediaType element at transaction level', async ({
  eoExportApi,
  paperOutExport,
  hybridExportContext,
  $tags,
}) => {
  const transactionId = hybridExportContext.transactionId;
  expect(transactionId, 'No transaction id was captured by a preceding Given step.').toBeDefined();
  const batchName = paperOutExport.uniqueNameOfRequest(testScenarioLabel($tags));
  await eoExportApi.requestExport({ level: 'transaction', id: transactionId as string, batchName });
  hybridExportContext.transactionBatchName = batchName;
});

When('I call eoRequestExport without a mediaType element at document level', async ({
  eoExportApi,
  paperOutExport,
  hybridExportContext,
  $tags,
}) => {
  const documentId = hybridExportContext.documentId;
  expect(documentId, 'No document id was captured by a preceding Given step.').toBeDefined();
  const batchName = paperOutExport.uniqueNameOfRequest(testScenarioLabel($tags));
  await eoExportApi.requestExport({ level: 'document', id: documentId as string, batchName });
  hybridExportContext.documentBatchName = batchName;
});

/**
 * Re-reaches a document whose id was captured by the scenario's Given step,
 * so the Submitted Paper Out event(s) just created via the API can be read
 * from the UI audit trail.
 *
 * Submitting via the API does not reload the browser's Workspace results
 * table itself, but the table may still be showing whatever it did before
 * the Given step's own selections, and the document history dialog can only
 * be opened from a currently-rendered document row - re-navigating from the
 * cached collection is therefore necessary, not defensive duplication,
 * mirroring the identical re-navigation the UI-submission Then step performs.
 */
async function reopenAuditTrailDocumentInCollection(
  homePage: EcoreHomePage,
  workspacePage: EcoreWorkspacePage,
  collectionName: string,
): Promise<void> {
  await resetToWorkspace(homePage, workspacePage);
  await workspacePage.openCollection(collectionName);
  await workspacePage.selectFirstTransaction();
  await workspacePage.selectFirstDocument();
  await workspacePage.openDocumentHistory();
}

When("I open the transaction's Submitted Paper Out audit trail entry", async ({
  homePage,
  workspacePage,
  paperOutRequestModal,
  documentHistory,
}) => {
  const collectionName = await resolveOpenCancelCollectionName(homePage, workspacePage, paperOutRequestModal);
  await reopenAuditTrailDocumentInCollection(homePage, workspacePage, collectionName);
  await documentHistory.expectOpen();
});

When("I open the document's Submitted Paper Out audit trail entry", async ({
  homePage,
  workspacePage,
  paperOutRequestModal,
  documentHistory,
}) => {
  const collectionName = await resolveOpenCancelCollectionName(homePage, workspacePage, paperOutRequestModal);
  await reopenAuditTrailDocumentInCollection(homePage, workspacePage, collectionName);
  await documentHistory.expectOpen();
});

When('I open the Submitted Paper Out audit trail entry for both', async ({
  homePage,
  workspacePage,
  documentHistory,
  hybridExportContext,
}) => {
  // TS-EC-12000-015 targets two distinct documents (see the Given step and
  // resolveSecondaryOpenCancelCollectionName), so both audit trail entries
  // are reached and confirmed open in turn.
  const transactionCollectionName = hybridExportContext.transactionCollectionName;
  const documentCollectionName = hybridExportContext.documentCollectionName;
  expect(transactionCollectionName, 'No transaction-level collection was captured by the Given step.').toBeDefined();
  expect(documentCollectionName, 'No document-level collection was captured by the Given step.').toBeDefined();

  await reopenAuditTrailDocumentInCollection(homePage, workspacePage, transactionCollectionName as string);
  await documentHistory.expectOpen();

  await reopenAuditTrailDocumentInCollection(homePage, workspacePage, documentCollectionName as string);
  await documentHistory.expectOpen();
});

Then('the API call succeeds', async ({ hybridExportContext }) => {
  // eoRequestExport() throws on any non-"ok" response (see
  // EoRequestExportClient.requestExport), so reaching this step at all is
  // already proof the call succeeded. The batch name recorded by the When
  // step is asserted here as the concrete, checkable evidence of that.
  const succeeded = hybridExportContext.transactionBatchName ?? hybridExportContext.documentBatchName;
  expect(succeeded, 'No eoRequestExport call recorded a batch name - the preceding When step did not run.').toBeDefined();
});

Then('both API calls succeed', async ({ hybridExportContext }) => {
  expect(
    hybridExportContext.transactionBatchName,
    'The transaction-level eoRequestExport call recorded no batch name.',
  ).toBeDefined();
  expect(
    hybridExportContext.documentBatchName,
    'The document-level eoRequestExport call recorded no batch name.',
  ).toBeDefined();
});

Then("the Media Type is recorded as {string} in the audit trail's Additional Information", async ({
  documentHistory,
  paperOutExport,
  hybridExportContext,
}, mediaType: string) => {
  const nameOfRequest = hybridExportContext.transactionBatchName ?? hybridExportContext.documentBatchName;
  expect(nameOfRequest, 'No eoRequestExport call recorded a batch name to look up.').toBeDefined();
  const recorded = await documentHistory.recordedMediaType(nameOfRequest as string);
  expect(recorded).toBe(paperOutExport.recordedMediaTypeValueFor(mediaType));
});

Then('the Media Type is recorded as {string} in both audit trail entries', async ({
  homePage,
  workspacePage,
  documentHistory,
  paperOutExport,
  hybridExportContext,
}, mediaType: string) => {
  const expected = paperOutExport.recordedMediaTypeValueFor(mediaType);
  const transactionCollectionName = hybridExportContext.transactionCollectionName;
  const documentCollectionName = hybridExportContext.documentCollectionName;
  expect(hybridExportContext.transactionBatchName, 'The transaction-level call recorded no batch name.').toBeDefined();
  expect(hybridExportContext.documentBatchName, 'The document-level call recorded no batch name.').toBeDefined();
  expect(transactionCollectionName, 'No transaction-level collection was captured by the Given step.').toBeDefined();
  expect(documentCollectionName, 'No document-level collection was captured by the Given step.').toBeDefined();

  // Both entries live in different documents (see the Given step), so each
  // is re-reached in turn rather than assumed still visible from the
  // preceding When step's own navigation.
  await reopenAuditTrailDocumentInCollection(homePage, workspacePage, transactionCollectionName as string);
  const transactionRecorded = await documentHistory.recordedMediaType(hybridExportContext.transactionBatchName as string);
  expect(transactionRecorded).toBe(expected);

  await reopenAuditTrailDocumentInCollection(homePage, workspacePage, documentCollectionName as string);
  const documentRecorded = await documentHistory.recordedMediaType(hybridExportContext.documentBatchName as string);
  expect(documentRecorded).toBe(expected);
});

/**
 * CLEANUP - TS-EC-12000-011 through -015 each call eoRequestExport for real,
 * creating a real Work Queue item exactly as a UI submission would, and Gate
 * 3 v4 approved the same reversible mechanism used elsewhere in this file:
 * `workQueue.cancelApprovalItem(batchName)`. TS-EC-12000-015 creates two
 * items (one per level) and both must be cancelled independently.
 *
 * Reloads the Workspace first for the same reason the
 * TS-EC-12000-007..-010 hook does: the scenario ends with the Document
 * History dialog open, which is modal and would intercept every pointer
 * event a Work Queue interaction needs.
 */
After(
  {
    tags:
      '@ts-TS-EC-12000-011 or @ts-TS-EC-12000-012 or @ts-TS-EC-12000-013 or @ts-TS-EC-12000-014 or @ts-TS-EC-12000-015',
  },
  async ({ page, workQueue, workspacePage, hybridExportContext }) => {
    const names = [hybridExportContext.transactionBatchName, hybridExportContext.documentBatchName].filter(
      (name): name is string => name !== undefined,
    );
    if (names.length === 0) return;
    try {
      await page.reload({ waitUntil: 'domcontentloaded' });
      await workspacePage.expectArrived();
    } catch (error) {
      console.warn(
        `[EC-12000 cleanup] Could not reload the Workspace before cancelling: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
    for (const name of names) {
      try {
        await workQueue.cancelApprovalItem(name);
      } catch (error) {
        console.warn(
          `[EC-12000 cleanup] Could not cancel the Paper Out request "${name}". It is still pending approval ` +
            `and will lock its transaction against the next run until resolved by hand. Reason: ${
              error instanceof Error ? error.message : String(error)
            }`,
        );
      }
    }
  },
);
