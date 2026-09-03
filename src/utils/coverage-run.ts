/**
 * One-shot browser code-coverage run.
 *
 * Usage:
 *   node src/utils/coverage-run.ts
 *
 * Coverage is on by default, so a plain `npm test` already writes both reports.
 * This wrapper exists for the one case that cannot: forcing capture on when a
 * local `.env` has set `COVERAGE_ENABLED=false`. Clearing the raw captures and
 * rendering the report are handled by the Playwright global setup / teardown.
 */
import { spawnSync } from 'node:child_process';
import { PROJECT_ROOT } from './artifact-io.ts';

/** Only this fixed script name is ever executed - nothing is caller-supplied. */
const TEST_SCRIPT = 'test';

function runNpmScript(script: string, extraEnv: Record<string, string>): number {
  // The command is a single literal string with no interpolated user input, and
  // no args array, which avoids the unescaped-argument hazard of shell spawning.
  const result = spawnSync(`npm run ${script}`, {
    cwd: PROJECT_ROOT,
    stdio: 'inherit',
    shell: true,
    env: { ...process.env, ...extraEnv },
  });

  if (result.error !== undefined) {
    console.error(`[coverage] failed to start "npm run ${script}": ${result.error.message}`);
    return 1;
  }
  return result.status ?? 1;
}

function main(): void {
  console.log('[coverage] Running tests with COVERAGE_ENABLED=true.\n');

  const testStatus = runNpmScript(TEST_SCRIPT, { COVERAGE_ENABLED: 'true' });

  if (testStatus !== 0) {
    console.error(
      `\n[coverage] Test run exited with code ${testStatus}. ` +
        'The coverage report reflects only the scenarios that actually executed.',
    );
  }

  process.exitCode = testStatus;
}

main();
