import path from 'node:path';
import type { Page, TestInfo } from '@playwright/test';
import { startBrowserCoverage, stopBrowserCoverage } from '../utils/coverage.ts';

export interface CoverageFixtures {
  /**
   * Auto fixture. Captures browser V8 code coverage unless COVERAGE_ENABLED is
   * false, in which case it is a no-op and the run is unchanged.
   */
  browserCoverage: void;
}

export const coverageFixture = {
  browserCoverage: [
    async ({ page }: { page: Page }, use: () => Promise<void>, testInfo: TestInfo) => {
      const started = await startBrowserCoverage(page);
      await use();
      if (!started) return;
      await stopBrowserCoverage(page, {
        testTitle: testInfo.titlePath.join(' > '),
        testFile: path.relative(process.cwd(), testInfo.file).split(path.sep).join('/'),
      });
    },
    { auto: true },
  ] as [
    ({ page }: { page: Page }, use: () => Promise<void>, testInfo: TestInfo) => Promise<void>,
    { auto: boolean },
  ],
};
