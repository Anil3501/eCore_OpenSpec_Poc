import { test as bddTest } from 'playwright-bdd';
import { request as playwrightRequest, type APIRequestContext } from '@playwright/test';
import path from 'node:path';
import { env, type FrameworkEnvironment } from '../utils/env.ts';
import { startBrowserCoverage, stopBrowserCoverage } from '../utils/coverage.ts';
import { EcoreLoginPage, type FailureSignal } from '../pages/ecore-login.page.ts';
import { EcoreHomePage } from '../pages/ecore-home.page.ts';
import { EcoreNewTransactionPage } from '../pages/ecore-new-transaction.page.ts';
import { EcoreWorkspacePage } from '../pages/ecore-workspace.page.ts';
import { EcorePreferencesPage } from '../pages/ecore-preferences.page.ts';
import { EcoreOrganizationPage } from '../pages/ecore-organization.page.ts';
import { EcoreVaultPage } from '../pages/ecore-vault.page.ts';
import { NavigationMenuComponent } from '../components/navigation-menu.component.ts';
import { CommandCenterComponent } from '../components/command-center.component.ts';
import { PaperOutRequestModalComponent } from '../components/paper-out-request-modal.component.ts';
import { AcknowledgementModalComponent } from '../components/acknowledgement-modal.component.ts';
import { WorkQueueComponent } from '../components/work-queue.component.ts';
import { VerifyPaperOutModalComponent } from '../components/verify-paper-out-modal.component.ts';
import { DocumentHistoryComponent } from '../components/document-history.component.ts';
import { OrganizationLoginService } from '../services/organization-login.service.ts';
import { PaperOutExportService } from '../services/paper-out-export.service.ts';
import { EoRequestExportClient } from '../api/eo-request-export.client.ts';

/**
 * Scenario-scoped scratch space.
 *
 * `AC-ETA-351-008` asserts a relationship between two separate sign-in
 * responses, which no single attempt can demonstrate. The scenario needs
 * somewhere to hold the first response while it produces the second, and a
 * fixture keeps that state out of module scope where it would leak between
 * scenarios.
 */
export interface SignInResponseMemory {
  remembered?: FailureSignal;
}

/**
 * What one navigation attempt reached.
 *
 * Every ETA-411 navigation scenario walks a table of modules in a When step and
 * judges the walk in a Then step. Arrival has to be checked while the browser is
 * still on the destination, so the When makes the check and records the result
 * here, and the Then asserts over the record. Without this the Then would
 * either be hollow - asserting nothing while the When did the real work - or
 * would have to re-walk the table and report a pass for a second journey rather
 * than the one the scenario described.
 */
export interface NavigationOutcome {
  module: string;
  arrived: boolean;
  /** The failure as the assertion reported it. Empty when the arrival held. */
  detail: string;
}

/**
 * What TS-EC-12000-018's When step read from the Verify Paper Out modal.
 *
 * The scenario reads a label in its When and judges it in its Then. Holding
 * the reading here keeps the Then asserting over the *same* observation the
 * When made, rather than quietly taking a second reading of its own - which
 * would make the Then pass even if the When had never looked.
 */
export interface VerifyModalReading {
  lastCheckboxLabel?: string;
}

/**
 * The text of the Paper Out package downloaded for TS-EC-12000-016.
 *
 * A single download answers all three of AC-EC-12000-016's questions (the
 * Submitted event, the Authorized event and the activity history report), so
 * the When step that triggers the download caches its text here and every
 * Then step reads the same cached text rather than re-downloading it.
 */
export interface DocumentActivityReport {
  text?: string;
}

/**
 * The Name of Request a scenario submitted its Paper Out under.
 *
 * The audit-trail scenarios generate a unique name at submit time so the
 * Submitted Paper Out event they later read is unambiguously their own, and
 * the cleanup hook needs that same name to cancel the right request. Holding
 * it in a fixture keeps the When, the Then and the After hook all referring
 * to one value instead of each regenerating one.
 */
export interface PaperOutSubmission {
  nameOfRequest?: string;
}

/**
 * The transaction/document reached for TS-EC-12000-011 through -015 and the
 * unique batch name(s) their eoRequestExport call(s) create.
 *
 * These scenarios reach a transaction and/or document through the UI to
 * capture its vault id (`transactionId`/`documentId`), call eoRequestExport
 * with that id, and then re-navigate to the same document to read its
 * Submitted Paper Out event by batch name. TS-EC-12000-015 makes two calls
 * against two distinct documents (one transaction-level, one document-level -
 * see `transactionCollectionName`/`documentCollectionName` below for why),
 * so it needs two independent batch names rather than the single name every
 * other scenario in this feature uses - see `PaperOutSubmission`, which
 * cannot hold both without one silently overwriting the other.
 */
export interface HybridExportContext {
  transactionId?: string;
  documentId?: string;
  transactionBatchName?: string;
  documentBatchName?: string;
  /**
   * The Collections-accordion name each id above was reached through.
   * TS-EC-12000-015 targets two distinct transactions/documents: a
   * transaction-level export locks its own document, so a second
   * document-level export against that same document is rejected by the
   * application with DOCUMENT_LOCK_ERROR (confirmed live against qa5 on
   * 2026-09-15), and each must be re-opened from its own collection to read
   * its audit trail.
   */
  transactionCollectionName?: string;
  documentCollectionName?: string;
}

/**
 * Shared framework fixtures.
 *
 * Reuses Playwright's built-in `page` fixture and playwright-bdd's `test`.
 * It never creates its own browser, context or page, and it never hard-codes a
 * credential - credentials are resolved lazily through the typed env loader.
 *
 * Story-specific page objects, components and services are registered here by
 * the IMPLEMENTATION stage of the workflow. Until a story is implemented this
 * file carries only the story-agnostic core.
 */
export interface FrameworkFixtures {
  environment: FrameworkEnvironment;
  /**
   * Auto fixture. Captures browser V8 code coverage unless COVERAGE_ENABLED is
   * false, in which case it is a no-op and the run is unchanged.
   */
  browserCoverage: void;
  loginPage: EcoreLoginPage;
  homePage: EcoreHomePage;
  /**
   * ETA-411 destinations. Each one is only ever asked whether the browser
   * arrived there; none of them models what the page can subsequently do.
   */
  newTransactionPage: EcoreNewTransactionPage;
  workspacePage: EcoreWorkspacePage;
  preferencesPage: EcorePreferencesPage;
  organizationPage: EcoreOrganizationPage;
  vaultPage: EcoreVaultPage;
  /**
   * The shared banner. Both live on every module page rather than on Home, so
   * they are components: TS-ETA-411-006 activates the Command Center from five
   * different modules and TS-ETA-411-003 reaches Home from another one.
   */
  navigationMenu: NavigationMenuComponent;
  commandCenter: CommandCenterComponent;
  /**
   * EC-12000 Paper Out modals. Components rather than page objects: both
   * overlay whichever page opened them (collection, transaction or document),
   * confirmed identical at all three levels live against qa5 on 2026-09-11.
   */
  paperOutRequestModal: PaperOutRequestModalComponent;
  acknowledgementModal: AcknowledgementModalComponent;
  workQueue: WorkQueueComponent;
  /**
   * The Verify Paper Out modal (TS-EC-12000-018). Read-only by design - see
   * the component's own note on why it never presses Verify.
   */
  verifyPaperOutModal: VerifyPaperOutModalComponent;
  /**
   * The Document History dialog - the only surface that records a Paper Out
   * and its Media Type. The transaction history records no Paper Out event at
   * all; see the component for the evidence.
   */
  documentHistory: DocumentHistoryComponent;
  verifyModalReading: VerifyModalReading;
  documentActivityReport: DocumentActivityReport;
  paperOutSubmission: PaperOutSubmission;
  organizationLogin: OrganizationLoginService;
  paperOutExport: PaperOutExportService;
  signInResponseMemory: SignInResponseMemory;
  navigationOutcomes: NavigationOutcome[];
  /**
   * API request context for @interface-api and @interface-hybrid scenarios.
   *
   * Created lazily: a UI-only scenario never touches it, so a repository with no
   * API_BASE_URL configured still runs exactly as it does today.
   */
  apiRequest: APIRequestContext;
  /**
   * EC-12000's TS-EC-12000-011 through -015 (HYBRID). A dedicated
   * APIRequestContext against ECORE_API_BASE_URL, distinct from `apiRequest`
   * (which targets the generic API_BASE_URL/SESSION_COOKIE config) - eoLogin
   * uses its own account and session, never the browser's UI session. Created
   * lazily and already authenticated via eoLogin() by the time a step
   * receives it.
   */
  eoExportApi: EoRequestExportClient;
  hybridExportContext: HybridExportContext;
}

export const test = bddTest.extend<FrameworkFixtures>({
  // eslint-disable-next-line no-empty-pattern
  environment: async ({}, use) => {
    await use(env);
  },

  loginPage: async ({ page }, use) => {
    await use(new EcoreLoginPage(page));
  },

  homePage: async ({ page }, use) => {
    await use(new EcoreHomePage(page));
  },

  newTransactionPage: async ({ page }, use) => {
    await use(new EcoreNewTransactionPage(page));
  },

  workspacePage: async ({ page }, use) => {
    await use(new EcoreWorkspacePage(page));
  },

  preferencesPage: async ({ page }, use) => {
    await use(new EcorePreferencesPage(page));
  },

  organizationPage: async ({ page }, use) => {
    await use(new EcoreOrganizationPage(page));
  },

  vaultPage: async ({ page }, use) => {
    await use(new EcoreVaultPage(page));
  },

  navigationMenu: async ({ page }, use) => {
    await use(new NavigationMenuComponent(page));
  },

  commandCenter: async ({ page }, use) => {
    await use(new CommandCenterComponent(page));
  },

  paperOutRequestModal: async ({ page }, use) => {
    await use(new PaperOutRequestModalComponent(page));
  },

  acknowledgementModal: async ({ page }, use) => {
    await use(new AcknowledgementModalComponent(page));
  },

  workQueue: async ({ page }, use) => {
    await use(new WorkQueueComponent(page));
  },

  verifyPaperOutModal: async ({ page }, use) => {
    await use(new VerifyPaperOutModalComponent(page));
  },

  documentHistory: async ({ page }, use) => {
    await use(new DocumentHistoryComponent(page));
  },

  // eslint-disable-next-line no-empty-pattern
  verifyModalReading: async ({}, use) => {
    await use({});
  },

  // eslint-disable-next-line no-empty-pattern
  documentActivityReport: async ({}, use) => {
    await use({});
  },

  // eslint-disable-next-line no-empty-pattern
  paperOutSubmission: async ({}, use) => {
    await use({});
  },

  // eslint-disable-next-line no-empty-pattern
  organizationLogin: async ({}, use) => {
    await use(new OrganizationLoginService());
  },

  // eslint-disable-next-line no-empty-pattern
  paperOutExport: async ({}, use) => {
    await use(new PaperOutExportService());
  },

  // eslint-disable-next-line no-empty-pattern
  signInResponseMemory: async ({}, use) => {
    await use({});
  },

  // eslint-disable-next-line no-empty-pattern
  navigationOutcomes: async ({}, use) => {
    await use([]);
  },

  apiRequest: async ({ context }, use) => {
    const api = env.requireApiConfig();
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (api.authMode === 'BEARER') headers.Authorization = `Bearer ${api.authToken}`;
    if (api.authMode === 'BASIC') headers.Authorization = `Basic ${api.authToken}`;

    // SESSION_COOKIE reuses the browser's storage state, which is what lets a
    // hybrid scenario seed over the API and then assert in the signed-in UI.
    const storageState = api.authMode === 'SESSION_COOKIE' ? await context.storageState() : undefined;

    const apiContext = await playwrightRequest.newContext({
      baseURL: api.baseUrl,
      extraHTTPHeaders: headers,
      storageState,
    });
    await use(apiContext);
    await apiContext.dispose();
  },

  // eslint-disable-next-line no-empty-pattern
  eoExportApi: async ({}, use) => {
    const config = env.requireEoApiConfig();
    const apiContext = await playwrightRequest.newContext({ baseURL: config.baseUrl });
    const client = new EoRequestExportClient(apiContext);
    await client.login();
    await use(client);
    await apiContext.dispose();
  },

  // eslint-disable-next-line no-empty-pattern
  hybridExportContext: async ({}, use) => {
    await use({});
  },

  browserCoverage: [
    async ({ page }, use, testInfo) => {
      const started = await startBrowserCoverage(page);
      await use();
      if (!started) return;
      await stopBrowserCoverage(page, {
        testTitle: testInfo.titlePath.join(' > '),
        testFile: path.relative(process.cwd(), testInfo.file).split(path.sep).join('/'),
      });
    },
    { auto: true },
  ],
});


export { expect } from '@playwright/test';
