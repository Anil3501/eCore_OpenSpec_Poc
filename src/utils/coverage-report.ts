/**
 * Converts raw browser V8 coverage into Istanbul reports.
 *
 * Usage:
 *   node src/utils/coverage-report.ts [--clean]
 *
 * Reads every capture written by `src/utils/coverage.ts`, converts it with
 * `v8-to-istanbul`, merges all tests into a single coverage map and renders
 * html / lcov / json reports into `reports/coverage/report/`.
 *
 * Governance boundary: the numbers produced here describe executed application
 * JavaScript. They are never merged into, and never substitute for, the
 * requirement coverage in `traceability/`.
 */
import fs from 'node:fs';
import path from 'node:path';
import v8toIstanbul from 'v8-to-istanbul';
// The istanbul packages are CommonJS. Node's ESM loader cannot always detect
// their named exports, so they are imported by default export and destructured.
import istanbulLibCoverage from 'istanbul-lib-coverage';
import istanbulLibReport from 'istanbul-lib-report';
import istanbulReports from 'istanbul-reports';
import {
  COVERAGE_REPORT_DIR,
  COVERAGE_SOURCE_DIR,
  clearRawCoverage,
  listRawCoverageFiles,
  type RawCoverageFile,
} from './coverage.ts';
import { PROJECT_ROOT } from './artifact-io.ts';

const { createCoverageMap } = istanbulLibCoverage;
const { createContext } = istanbulLibReport;
const { create: createReport } = istanbulReports;

/** Anything outside this set is replaced, so a URL can never escape the root. */
const UNSAFE_SEGMENT_CHARACTERS = /[^A-Za-z0-9._-]/g;

/**
 * Maps a script URL to a safe path inside `reports/coverage/sources/`.
 *
 * Every segment is sanitised and the resolved path is verified to stay under
 * the source root, so a hostile or malformed URL cannot cause a path traversal
 * write (OWASP A01).
 */
function sourcePathForUrl(url: string): string | undefined {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return undefined;
  }

  const segments = parsed.pathname
    .split('/')
    .filter((segment) => segment !== '' && segment !== '.' && segment !== '..')
    .map((segment) => segment.replace(UNSAFE_SEGMENT_CHARACTERS, '_').slice(0, 120))
    .filter((segment) => segment !== '');

  const host = parsed.hostname.replace(UNSAFE_SEGMENT_CHARACTERS, '_');
  if (host === '') return undefined;
  if (segments.length === 0) segments.push('index.js');

  const last = segments[segments.length - 1] as string;
  if (!last.includes('.')) segments[segments.length - 1] = `${last}.js`;

  const candidate = path.resolve(COVERAGE_SOURCE_DIR, host, ...segments);
  const root = path.resolve(COVERAGE_SOURCE_DIR);
  if (candidate !== root && !candidate.startsWith(root + path.sep)) return undefined;
  return candidate;
}

function readRawFile(absolutePath: string): RawCoverageFile | undefined {
  try {
    return JSON.parse(fs.readFileSync(absolutePath, 'utf8')) as RawCoverageFile;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[coverage] ignored unreadable capture ${path.basename(absolutePath)}: ${message}`);
    return undefined;
  }
}

export async function generateCoverageReport(): Promise<void> {
  const rawFiles = listRawCoverageFiles();

  if (rawFiles.length === 0) {
    console.log(
      '[coverage] No raw coverage found in reports/coverage/raw/.\n' +
        '[coverage] Run `npm run test:coverage` first. No report was written and no ' +
        'coverage figure is being reported.',
    );
    return;
  }

  const coverageMap = createCoverageMap({});
  let convertedScripts = 0;
  let skippedScripts = 0;
  const seenUrls = new Set<string>();

  for (const rawFile of rawFiles) {
    const capture = readRawFile(rawFile);
    if (capture === undefined) continue;

    for (const entry of capture.entries) {
      const scriptPath = sourcePathForUrl(entry.url);
      if (scriptPath === undefined) {
        skippedScripts += 1;
        continue;
      }

      // Materialise the source once so the HTML report can render real code.
      if (!seenUrls.has(entry.url)) {
        fs.mkdirSync(path.dirname(scriptPath), { recursive: true });
        fs.writeFileSync(scriptPath, entry.source, 'utf8');
        seenUrls.add(entry.url);
      }

      const converter = v8toIstanbul(scriptPath, 0, { source: entry.source });
      try {
        await converter.load();
        converter.applyCoverage(entry.functions);
        coverageMap.merge(converter.toIstanbul());
        convertedScripts += 1;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.warn(`[coverage] could not convert ${entry.url}: ${message}`);
        skippedScripts += 1;
      } finally {
        converter.destroy();
      }
    }
  }

  if (coverageMap.files().length === 0) {
    console.log('[coverage] No convertible scripts were captured. No report was written.');
    return;
  }

  fs.mkdirSync(COVERAGE_REPORT_DIR, { recursive: true });
  const context = createContext({
    dir: COVERAGE_REPORT_DIR,
    coverageMap,
    defaultSummarizer: 'nested',
  });

  createReport('html').execute(context);
  createReport('lcovonly', { file: 'lcov.info' }).execute(context);
  createReport('json', { file: 'coverage-final.json' }).execute(context);
  createReport('json-summary', { file: 'coverage-summary.json' }).execute(context);
  createReport('text-summary').execute(context);

  const reportDir = path.relative(PROJECT_ROOT, COVERAGE_REPORT_DIR).split(path.sep).join('/');
  console.log(
    `\n[coverage] captures: ${rawFiles.length} | scripts converted: ${convertedScripts} | ` +
      `scripts skipped: ${skippedScripts}`,
  );
  console.log(`[coverage] HTML report: ${reportDir}/index.html`);
  console.log('[coverage] This is application code coverage, not requirement coverage.');
}

async function main(): Promise<void> {
  if (process.argv.includes('--clean')) {
    clearRawCoverage();
    fs.rmSync(COVERAGE_REPORT_DIR, { recursive: true, force: true });
    console.log('[coverage] Cleared reports/coverage/.');
    return;
  }
  await generateCoverageReport();
}

// CLI entry point. Guarded so that importing this module - the Playwright
// global teardown does exactly that - never triggers the CLI. `import.meta` is
// deliberately avoided: this file is loaded both by Node's ESM type-stripping
// and by Playwright's own transform, which do not agree on module format.
if ((process.argv[1] ?? '').endsWith('coverage-report.ts')) {
  main().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
