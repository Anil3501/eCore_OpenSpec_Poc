import { test as bddTest } from 'playwright-bdd';
import { env, type FrameworkEnvironment } from '../utils/env.ts';
import { coverageFixture, type CoverageFixtures } from './coverage.fixture.ts';
import {
  accountAccessFixture,
  type AccountAccessFixtures,
  type SignInResponseMemory,
} from './account-access.fixture.ts';
import {
  homeNavigationFixture,
  type HomeNavigationFixtures,
  type NavigationOutcome,
} from './home-navigation.fixture.ts';
import {
  paperOutExportFixture,
  type PaperOutExportFixtures,
  type VerifyModalReading,
  type DocumentActivityReport,
  type PaperOutSubmission,
} from './paper-out-export.fixture.ts';
import { apiFixture, type ApiFixtures, type HybridExportContext } from './api.fixture.ts';

export type { SignInResponseMemory };
export type { NavigationOutcome };
export type { VerifyModalReading, DocumentActivityReport, PaperOutSubmission };
export type { HybridExportContext };

/**
 * Shared framework fixtures.
 *
 * Composed from capability slices (`account-access`, `home-navigation`,
 * `paper-out-export`, `api`, `coverage`).
 * Reuses Playwright's built-in `page` fixture and playwright-bdd's `test`.
 * It never creates its own browser, context or page, and it never hard-codes a
 * credential - credentials are resolved lazily through the typed env loader.
 */
export interface FrameworkFixtures
  extends AccountAccessFixtures,
    HomeNavigationFixtures,
    PaperOutExportFixtures,
    ApiFixtures,
    CoverageFixtures {
  environment: FrameworkEnvironment;
}

export const test = bddTest
  .extend<{ environment: FrameworkEnvironment }>({
    // eslint-disable-next-line no-empty-pattern
    environment: async ({}, use) => {
      await use(env);
    },
  })
  .extend<CoverageFixtures>(coverageFixture)
  .extend<AccountAccessFixtures>(accountAccessFixture)
  .extend<HomeNavigationFixtures>(homeNavigationFixture)
  .extend<PaperOutExportFixtures>(paperOutExportFixture)
  .extend<ApiFixtures>(apiFixture);

export { expect } from '@playwright/test';
