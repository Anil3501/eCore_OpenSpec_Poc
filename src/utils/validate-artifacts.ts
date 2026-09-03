/**
 * Validation entry point used by the npm scripts.
 *
 * Usage:
 *   node src/utils/validate-artifacts.ts [requirements|workflow|rtm|defects|automation|all]
 *
 * Writes a machine-readable report to reports/validation/ and exits non-zero
 * when any check fails, so validation failures can never be silently ignored.
 */
import fs from 'node:fs';
import path from 'node:path';
import { runValidation, type CheckResult } from './semantic-rules.ts';
import { PROJECT_ROOT } from './artifact-io.ts';

type Scope = 'requirements' | 'workflow' | 'rtm' | 'defects' | 'automation' | 'all';

const SCOPES: Scope[] = ['requirements', 'workflow', 'rtm', 'defects', 'automation', 'all'];

function parseScope(value: string | undefined): Scope {
  if (value === undefined) return 'all';
  if ((SCOPES as string[]).includes(value)) return value as Scope;
  throw new Error(`Unknown validation scope "${value}". Expected one of: ${SCOPES.join(', ')}.`);
}

function render(results: CheckResult[]): string {
  const lines: string[] = [];
  for (const result of results) {
    const marker = result.status === 'PASS' ? 'PASS' : result.status === 'FAIL' ? 'FAIL' : 'SKIP';
    lines.push(`[${marker}] ${result.id} - ${result.title}`);
    for (const message of result.messages) {
      lines.push(`        ${message}`);
    }
  }
  return lines.join('\n');
}

function main(): void {
  const scope = parseScope(process.argv[2]);
  const results = runValidation(scope);

  const failed = results.filter((result) => result.status === 'FAIL');
  const skipped = results.filter((result) => result.status === 'SKIPPED');
  const passed = results.filter((result) => result.status === 'PASS');

  const report = {
    generatedAt: new Date().toISOString(),
    scope,
    summary: {
      total: results.length,
      passed: passed.length,
      failed: failed.length,
      skipped: skipped.length,
    },
    results,
  };

  const outputDir = path.join(PROJECT_ROOT, 'reports', 'validation');
  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(
    path.join(outputDir, `validation-${scope}.json`),
    `${JSON.stringify(report, null, 2)}\n`,
    'utf8',
  );

  console.log(render(results));
  console.log(
    `\nScope: ${scope} | passed: ${passed.length} | failed: ${failed.length} | skipped: ${skipped.length}`,
  );
  console.log(`Report written to reports/validation/validation-${scope}.json`);

  if (failed.length > 0) {
    process.exitCode = 1;
  }
}

main();
