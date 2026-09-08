import { defineConfig, devices } from '@playwright/test';
import { defineBddConfig } from 'playwright-bdd';
import fs from 'node:fs';
import { env } from './src/utils/env.ts';

// Written by `npm run capture:session`, git-ignored, and read ONLY by the seed
// project below. Absent on a normal checkout, which is why it is optional.
const SESSION_STATE_PATH = '.auth/ecore-session.json';
const hasCapturedSession = fs.existsSync(SESSION_STATE_PATH);

/**
 * Playwright-BDD generation.
 *
 * Only APPROVED feature files are compiled into executable tests. Features that
 * are still under review live in `features/generated/` and are intentionally
 * excluded until Approval Gate 3 is recorded.
 */
const bddTestDir = defineBddConfig({
  features: ['features/approved/**/*.feature'],
  steps: ['steps/**/*.ts', 'src/fixtures/**/*.ts'],
  outputDir: '.features-gen',
});

export default defineConfig({
  // Manually authored technical tests and BDD-generated tests stay separate.
  outputDir: 'test-results',
  // Coverage is captured per test by an auto fixture; these two hooks clear the
  // previous captures and render the Istanbul report, so a single `npm test`
  // produces the execution report and the coverage report together.
  globalSetup: './src/utils/coverage-global-setup.ts',
  globalTeardown: './src/utils/coverage-global-teardown.ts',
  fullyParallel: true,
  workers: 1,
  forbidOnly: env.isCi,
  retries: 1,
  // Keep the maximum duration of one test attempt to 45 seconds. Individual
  // assertions retain Playwright's default 5-second expect timeout.
  timeout: 45_000,
  reporter: [
    ['list'],
    ['html', { outputFolder: 'reports/playwright-report', open: 'never' }],
    // Machine-readable execution record. Overwritten on every run and never a
    // substitute for a governed EXEC-* artifact, which is written deliberately.
    ['json', { outputFile: 'reports/execution/results.json' }],
  ],
  use: {
    // Empty base URL must not break scaffolding; it is required lazily instead.
    baseURL: env.baseUrl,
    channel: 'chrome',
    headless: env.headless,
    // `retain-on-failure`, not `on-first-retry`: retries are 0 locally, so a
    // failing local run would otherwise produce no trace at all and the bug
    // analyzer would have nothing to attach. Passing runs still write nothing.
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
  },
  projects: [
    {
      name: 'bdd',
      testDir: bddTestDir,
      use: { ...devices['Desktop Chrome'] },
    },
    // Optional project: enable when manually authored technical Playwright
    // tests under tests/ should be included in the run.
    // {
    //   name: 'technical',
    //   testDir: './tests',
    //   testIgnore: 'seed.spec.ts',
    //   use: { ...devices['Desktop Chrome'] },
    // },
    // Optional project: enable only when Playwright Planner / Generator
    // exploration needs the seed test and captured session.
    // {
    //   name: 'seed',
    //   testDir: './tests',
    //   testMatch: 'seed.spec.ts',
    //   use: {
    //     ...devices['Desktop Chrome'],
    //     ...(hasCapturedSession ? { storageState: SESSION_STATE_PATH } : {}),
    //   },
    // },
  ],
});
