/**
 * Usage: node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON src/utils/preflight.ts
 *
 * Verifies that everything a workflow stage needs is installed BEFORE a stage runs.
 *
 * The orchestrator's per-stage `requires` list names artifact paths only, so a missing CLI stays
 * invisible until the stage that shells out to it fails. OPENSPEC_GENERATION hit exactly that on
 * 2026-09-05: the OpenSpec CLI was not a dependency at all, so `npm install` on a fresh clone
 * installed nothing and the gap only surfaced at stage 6 of 17.
 *
 * Writes reports/validation/preflight.json and exits non-zero when a required check fails.
 * A WARN never fails the run: scaffolding and validation are designed to work without secrets.
 */

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

import { PROJECT_ROOT, readJson, toAbsolute } from './artifact-io.ts';
import { env } from './env.ts';
import { resolveBinEntry } from './node-bin.ts';

type CheckStatus = 'PASS' | 'FAIL' | 'WARN';

interface CheckResult {
  id: string;
  title: string;
  status: CheckStatus;
  details: string[];
  remedy: string | null;
}

const MINIMUM_NODE_MAJOR = 24;

/** Binaries a workflow stage shells out to, with the package that provides each one. */
const REQUIRED_BINARIES = [
  { bin: 'openspec', pkg: '@fission-ai/openspec', neededBy: 'OPENSPEC_GENERATION' },
  { bin: 'bddgen', pkg: 'playwright-bdd', neededBy: 'BDD_GENERATION' },
  { bin: 'playwright', pkg: '@playwright/test', neededBy: 'EXECUTION' },
];

function result(
  id: string,
  title: string,
  status: CheckStatus,
  details: string[],
  remedy: string | null = null,
): CheckResult {
  return { id, title, status, details, remedy };
}

/**
 * Resolves a CLI to its JavaScript entry point rather than the node_modules/.bin shim: Node
 * refuses to execFile a Windows .cmd without a shell, and this repo's path contains spaces.
 */
function checkNodeVersion(): CheckResult {
  const major = Number(process.versions.node.split('.')[0]);
  if (Number.isNaN(major) || major < MINIMUM_NODE_MAJOR) {
    return result(
      'NODE-VERSION',
      `Node ${MINIMUM_NODE_MAJOR}+ is the runtime`,
      'FAIL',
      [`Found Node ${process.versions.node}.`],
      `Install Node ${MINIMUM_NODE_MAJOR} or later. The framework relies on native TypeScript type-stripping.`,
    );
  }
  return result('NODE-VERSION', `Node ${MINIMUM_NODE_MAJOR}+ is the runtime`, 'PASS', [
    `Node ${process.versions.node}.`,
  ]);
}

function checkDependenciesInstalled(): CheckResult {
  const manifest = readJson<{
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  }>('package.json');

  const declared = [
    ...Object.keys(manifest.dependencies ?? {}),
    ...Object.keys(manifest.devDependencies ?? {}),
  ];

  const missing = declared.filter(
    (name) => !fs.existsSync(path.join(PROJECT_ROOT, 'node_modules', ...name.split('/'))),
  );

  if (missing.length > 0) {
    return result(
      'DEPENDENCIES-INSTALLED',
      'Every declared dependency is present in node_modules',
      'FAIL',
      [`${missing.length} of ${declared.length} declared package(s) not installed:`, ...missing],
      'Run `npm install`. If it fails with 403 from registry.npmjs.org, the corporate Artifactory registry is not configured.',
    );
  }

  return result(
    'DEPENDENCIES-INSTALLED',
    'Every declared dependency is present in node_modules',
    'PASS',
    [`${declared.length} declared package(s) installed.`],
  );
}

function checkBinaries(): CheckResult {
  const details: string[] = [];
  const failures: string[] = [];

  for (const { bin, pkg, neededBy } of REQUIRED_BINARIES) {
    const entry = resolveBinEntry(pkg, bin);
    if (!entry) {
      failures.push(`${bin} is not installed - expected it from ${pkg} (needed by ${neededBy}).`);
      continue;
    }
    try {
      const version = execFileSync(process.execPath, [entry, '--version'], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      })
        .trim()
        .split('\n')
        .pop();
      details.push(`${bin} ${version} from ${pkg} (${neededBy}).`);
    } catch {
      failures.push(`${bin} is installed but did not execute (needed by ${neededBy}).`);
    }
  }

  if (failures.length > 0) {
    return result(
      'CLI-BINARIES',
      'Every CLI a workflow stage shells out to is executable',
      'FAIL',
      [...failures, ...details],
      'Run `npm install`. A CLI a stage depends on must be a declared devDependency, never a global install: a global install does not inherit the project .npmrc.',
    );
  }

  return result(
    'CLI-BINARIES',
    'Every CLI a workflow stage shells out to is executable',
    'PASS',
    details,
  );
}

async function checkPlaywrightBrowsers(): Promise<CheckResult> {
  try {
    // Default-import: a named import from a CJS dependency typechecks and then throws at runtime.
    const playwright = await import('@playwright/test');
    const chromium =
      (playwright as { chromium?: { executablePath(): string } }).chromium ??
      (playwright as { default?: { chromium?: { executablePath(): string } } }).default?.chromium;

    if (!chromium) {
      return result(
        'PLAYWRIGHT-BROWSERS',
        'Playwright browser binaries are downloaded',
        'FAIL',
        ['Could not resolve the chromium entry point from @playwright/test.'],
        'Run `npm install`, then `npx playwright install`.',
      );
    }

    const executable = chromium.executablePath();
    if (!fs.existsSync(executable)) {
      return result(
        'PLAYWRIGHT-BROWSERS',
        'Playwright browser binaries are downloaded',
        'FAIL',
        ['Chromium is not downloaded. Tests and MCP exploration cannot run.'],
        'Run `npx playwright install`.',
      );
    }

    return result('PLAYWRIGHT-BROWSERS', 'Playwright browser binaries are downloaded', 'PASS', [
      'Chromium is present.',
    ]);
  } catch (error) {
    return result(
      'PLAYWRIGHT-BROWSERS',
      'Playwright browser binaries are downloaded',
      'FAIL',
      [`@playwright/test could not be loaded: ${(error as Error).message}`],
      'Run `npm install`, then `npx playwright install`.',
    );
  }
}

function checkEnvironment(): CheckResult {
  const configured = env.describe();
  const details = Object.entries(configured).map(([key, value]) => `${key}: ${String(value)}`);

  // Secrets are absent by design on a fresh clone, so this can only ever warn.
  const missing: string[] = [];
  const optionalChecks: Array<[string, () => unknown]> = [
    ['application sign-in (ECORE_*)', () => env.requireEcoreLogin()],
    ['Jira REST fallback (JIRA_*)', () => env.requireJiraConfig()],
  ];

  for (const [label, accessor] of optionalChecks) {
    try {
      accessor();
    } catch {
      missing.push(label);
    }
  }

  if (missing.length > 0) {
    return result(
      'ENVIRONMENT',
      'Environment configuration is present',
      'WARN',
      [...details, '', 'Not configured:', ...missing],
      'Copy .env.example to .env and fill in the listed groups. Artifact generation and validation work without them; executing against the application does not.',
    );
  }

  return result('ENVIRONMENT', 'Environment configuration is present', 'PASS', details);
}

function render(checks: CheckResult[]): void {
  const symbol: Record<CheckStatus, string> = { PASS: '[PASS]', FAIL: '[FAIL]', WARN: '[WARN]' };
  for (const check of checks) {
    console.log(`${symbol[check.status]} ${check.id} - ${check.title}`);
    for (const detail of check.details) {
      if (detail) console.log(`          ${detail}`);
    }
    if (check.remedy) console.log(`          -> ${check.remedy}`);
  }
}

async function main(): Promise<void> {
  const checks: CheckResult[] = [
    checkNodeVersion(),
    checkDependenciesInstalled(),
    checkBinaries(),
    await checkPlaywrightBrowsers(),
    checkEnvironment(),
  ];

  render(checks);

  const failed = checks.filter((check) => check.status === 'FAIL').length;
  const warned = checks.filter((check) => check.status === 'WARN').length;
  const passed = checks.filter((check) => check.status === 'PASS').length;

  const reportPath = toAbsolute('reports/validation/preflight.json');
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(
    reportPath,
    `${JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        node: process.versions.node,
        platform: process.platform,
        summary: { passed, failed, warned },
        checks,
      },
      null,
      2,
    )}\n`,
    'utf8',
  );

  console.log(`\npassed: ${passed} | failed: ${failed} | warned: ${warned}`);
  console.log('Report written to reports/validation/preflight.json');

  if (failed > 0) {
    console.log('\nThe framework is not ready. Fix the failures above before starting a workflow.');
    process.exitCode = 1;
  }
}

main().catch((error: unknown) => {
  console.error(`preflight failed to run: ${(error as Error).message}`);
  process.exitCode = 1;
});
