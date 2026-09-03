/**
 * Playwright global teardown for browser code coverage.
 *
 * Renders the Istanbul report from whatever was captured during the run, so the
 * execution report and the coverage report are produced by the same command.
 *
 * Instrumentation must never fail a run: a reporting problem is a warning and
 * never changes the suite's exit code, and a failing suite still gets a report
 * describing the scenarios that did execute.
 */
import { generateCoverageReport } from './coverage-report.ts';
import { env } from './env.ts';

export default async function coverageGlobalTeardown(): Promise<void> {
  if (!env.coverage.enabled) return;
  try {
    await generateCoverageReport();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[coverage] Report generation failed: ${message}`);
  }
}
