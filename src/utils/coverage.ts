/**
 * Browser V8 code-coverage capture.
 *
 * Records which JavaScript of the *application under test* a scenario actually
 * executed. The raw V8 output is written to `reports/coverage/raw/` and is
 * converted to Istanbul format later by `coverage-report.ts`, so the capture
 * path stays cheap and never blocks a test.
 *
 * Governance boundary: this is CODE coverage. It is never evidence that an
 * acceptance criterion is covered. Requirement coverage lives exclusively in
 * `traceability/capabilities/<capability>.coverage.json` and is computed from
 * RTM data alone.
 *
 * Capture is Chromium-only, because the V8 coverage API is exposed through the
 * Chrome DevTools Protocol. It is on by default and is disabled by setting
 * `COVERAGE_ENABLED=false`; when disabled or unsupported every function here is
 * a no-op, so the run behaves exactly as it would without coverage.
 */
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { Page } from '@playwright/test';
import { env } from './env.ts';
import { PROJECT_ROOT } from './artifact-io.ts';

export const COVERAGE_ROOT = path.join(PROJECT_ROOT, 'reports', 'coverage');
/** Raw, per-test V8 output. Regenerated on every coverage run. */
export const COVERAGE_RAW_DIR = path.join(COVERAGE_ROOT, 'raw');
/** Application sources materialised from the browser, for the HTML report. */
export const COVERAGE_SOURCE_DIR = path.join(COVERAGE_ROOT, 'sources');
/** Rendered Istanbul reports (html, lcov, json). */
export const COVERAGE_REPORT_DIR = path.join(COVERAGE_ROOT, 'report');

export interface V8CoverageRange {
  startOffset: number;
  endOffset: number;
  count: number;
}

export interface V8FunctionCoverage {
  functionName: string;
  ranges: V8CoverageRange[];
  isBlockCoverage: boolean;
}

export interface RawCoverageEntry {
  url: string;
  source: string;
  functions: V8FunctionCoverage[];
}

export interface RawCoverageFile {
  collectedAt: string;
  /** Full test title path, for traceability of the raw capture only. */
  testTitle: string;
  /** Repository-relative spec path. */
  testFile: string;
  entries: RawCoverageEntry[];
}

export interface CoverageTestContext {
  testTitle: string;
  testFile: string;
}

/** True when the page is driven by Chromium, the only engine exposing V8 coverage. */
function isChromium(page: Page): boolean {
  return page.context().browser()?.browserType().name() === 'chromium';
}

/**
 * Keeps first-party application scripts and drops inline / extension / blob
 * scripts, which have no stable identity across runs.
 */
function shouldIncludeScript(url: string): boolean {
  if (url === '') return false;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false;
  if (env.coverage.includeThirdParty) return true;
  if (env.baseUrl === undefined) return true;
  try {
    return new URL(env.baseUrl).origin === parsed.origin;
  } catch {
    return true;
  }
}

/**
 * Starts V8 coverage for a page.
 *
 * `resetOnNavigation` is disabled so that coverage accumulates across the
 * multi-page navigations a business flow performs.
 *
 * @returns true when capture actually started, false when it was skipped.
 */
export async function startBrowserCoverage(page: Page): Promise<boolean> {
  if (!env.coverage.enabled) return false;
  if (!isChromium(page)) return false;
  await page.coverage.startJSCoverage({
    resetOnNavigation: false,
    reportAnonymousScripts: false,
  });
  return true;
}

/**
 * Stops V8 coverage and persists the filtered raw output.
 *
 * Never throws into a test: a coverage problem must not turn a passing
 * scenario into a failing one, nor mask a real failure.
 */
export async function stopBrowserCoverage(
  page: Page,
  context: CoverageTestContext,
): Promise<void> {
  if (!env.coverage.enabled) return;
  if (page.isClosed()) return;
  try {
    const collected = await page.coverage.stopJSCoverage();
    const entries: RawCoverageEntry[] = collected
      .filter((entry) => shouldIncludeScript(entry.url) && typeof entry.source === 'string')
      .map((entry) => ({
        url: entry.url,
        source: entry.source as string,
        functions: entry.functions as V8FunctionCoverage[],
      }));

    if (entries.length === 0) return;

    const payload: RawCoverageFile = {
      collectedAt: new Date().toISOString(),
      testTitle: context.testTitle,
      testFile: context.testFile,
      entries,
    };

    await fs.promises.mkdir(COVERAGE_RAW_DIR, { recursive: true });
    // The file name is a UUID, never a test title, so no caller-controlled
    // string can ever influence the written path.
    await fs.promises.writeFile(
      path.join(COVERAGE_RAW_DIR, `coverage-${randomUUID()}.json`),
      JSON.stringify(payload),
      'utf8',
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[coverage] capture skipped for "${context.testTitle}": ${message}`);
  }
}

/** Removes raw captures and materialised sources from a previous run. */
export function clearRawCoverage(): void {
  fs.rmSync(COVERAGE_RAW_DIR, { recursive: true, force: true });
  fs.rmSync(COVERAGE_SOURCE_DIR, { recursive: true, force: true });
}

/** Absolute paths of every raw capture file, sorted for deterministic merging. */
export function listRawCoverageFiles(): string[] {
  if (!fs.existsSync(COVERAGE_RAW_DIR)) return [];
  return fs
    .readdirSync(COVERAGE_RAW_DIR, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
    .map((entry) => path.join(COVERAGE_RAW_DIR, entry.name))
    .sort();
}
