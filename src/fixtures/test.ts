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
import { OrganizationLoginService } from '../services/organization-login.service.ts';

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
  organizationLogin: OrganizationLoginService;
  signInResponseMemory: SignInResponseMemory;
  navigationOutcomes: NavigationOutcome[];
  /**
   * API request context for @interface-api and @interface-hybrid scenarios.
   *
   * Created lazily: a UI-only scenario never touches it, so a repository with no
   * API_BASE_URL configured still runs exactly as it does today.
   */
  apiRequest: APIRequestContext;
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

  // eslint-disable-next-line no-empty-pattern
  organizationLogin: async ({}, use) => {
    await use(new OrganizationLoginService());
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
