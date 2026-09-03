/**
 * Playwright global setup for browser code coverage.
 *
 * Clears the raw captures written by the previous run so a report can never be
 * inflated by stale data. A no-op when coverage is disabled, so a run with
 * `COVERAGE_ENABLED=false` behaves exactly as it did before.
 */
import { clearRawCoverage } from './coverage.ts';
import { env } from './env.ts';

export default function coverageGlobalSetup(): void {
  if (!env.coverage.enabled) return;
  clearRawCoverage();
  console.log('[coverage] Cleared previous captures.');
}
