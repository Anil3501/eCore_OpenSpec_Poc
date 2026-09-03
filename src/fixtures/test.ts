import { test as bddTest } from 'playwright-bdd';
import path from 'node:path';
import { env, type FrameworkEnvironment } from '../utils/env.ts';
import { startBrowserCoverage, stopBrowserCoverage } from '../utils/coverage.ts';
import { EcoreLoginPage, type FailureSignal } from '../pages/ecore-login.page.ts';
import { EcoreHomePage } from '../pages/ecore-home.page.ts';
import { EcoreNewTransactionPage } from '../pages/ecore-new-transaction.page.ts';
import { EcoreWorkspacePage } from '../pages/ecore-workspace.page.ts';
import { EcorePreferencesPage } from '../pages/ecore-preferences.page.ts';
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
  organizationLogin: OrganizationLoginService;
  signInResponseMemory: SignInResponseMemory;
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

  // eslint-disable-next-line no-empty-pattern
  organizationLogin: async ({}, use) => {
    await use(new OrganizationLoginService());
  },

  // eslint-disable-next-line no-empty-pattern
  signInResponseMemory: async ({}, use) => {
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
