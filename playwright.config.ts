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
  forbidOnly: env.isCi,
  retries: env.isCi ? 1 : 0,
  // Raised from Playwright's 30s default on measured evidence, not on a guess.
  // On qa1, a single sign-in plus one navigation to the Workspace page took
  // 27.3s (ETA-411 TS-004, 2026-09-01), leaving TS-006 - which signs in,
  // navigates to Workspace, and then returns Home - no room to finish inside
  // 30s. It timed out with the browser already correctly back on the Home page.
  //
  // This buys wall-clock only. Every individual assertion keeps the 5s expect
  // timeout, so a genuinely missing element still fails fast rather than
  // hanging for 90s. What this does NOT do is make the application faster: the
  // Workspace page really does take 15-25s to render on this environment. That
  // is a real observation, recorded here rather than hidden by the larger
  // number. ETA-411 has no performance criterion, so no test asserts on it.
  timeout: 90_000,
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
    {
      name: 'technical',
      testDir: './tests',
      testIgnore: 'seed.spec.ts',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      // Playwright-generated seed used by the Playwright Planner / Generator.
      // Lives at tests/seed.spec.ts, the path the Playwright agents expect.
      name: 'seed',
      testDir: './tests',
      testMatch: 'seed.spec.ts',
      use: {
        ...devices['Desktop Chrome'],
        // Exploration through Playwright MCP needs an authenticated browser,
        // but every value passed to an MCP tool is recorded in the agent
        // transcript, so signing in through MCP would leak a live password.
        // The seed project therefore resumes a session captured out-of-band.
        // Deliberately scoped to `seed`: `bdd` and `technical` must always
        // exercise the real sign-in, never a pre-authenticated shortcut.
        ...(hasCapturedSession ? { storageState: SESSION_STATE_PATH } : {}),
      },
    },
  ],
});
