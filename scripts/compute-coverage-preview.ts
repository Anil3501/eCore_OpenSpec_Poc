/**
 * Coverage preview: recomputes a capability's coverage measures directly from
 * its RTM, using the exact same computeCoverage() function SEM-COVERAGE uses
 * to validate traceability/capabilities/<capability>.coverage.json. This
 * exists so those numbers never again have to be hand-derived (and
 * hand-miscalculated) before being copied into the governed coverage file.
 *
 * This is a read-only preview tool: it never writes into traceability/,
 * workflow/, requirements/, test-plans/ or features/. It writes only to
 * reports/, per .github/instructions/framework-tooling.instructions.md.
 *
 * Usage:
 *   node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/compute-coverage-preview.ts <capability>
 *
 * Example:
 *   node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/compute-coverage-preview.ts paper-out-export
 */
import fs from 'node:fs';
import path from 'node:path';
import { computeCoverage, rtmSchema, type Rtm } from '../src/models/rtm.model.ts';
import { PROJECT_ROOT, toAbsolute, toRelative, readJson } from '../src/utils/artifact-io.ts';

function rtmPathFor(capability: string): string {
  return `traceability/capabilities/${capability}.rtm.json`;
}

function loadRtm(capability: string): Rtm {
  const relativePath = rtmPathFor(capability);
  if (!fs.existsSync(toAbsolute(relativePath))) {
    throw new Error(
      `No RTM found for capability "${capability}" at ${relativePath}. ` +
        'Check the capability name against traceability/capabilities/.',
    );
  }
  const raw = readJson<unknown>(relativePath);
  const parsed = rtmSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(
      `${relativePath} does not match the RTM schema: ${parsed.error.issues
        .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
        .join('; ')}`,
    );
  }
  return parsed.data;
}

function render(capability: string, rtmVersion: number, computed: ReturnType<typeof computeCoverage>): string {
  const lines: string[] = [];
  lines.push(`Coverage preview for "${capability}" (source RTM version ${rtmVersion})`);
  lines.push(`  totals.approvedAcs:                          ${computed.totals.approvedAcs}`);
  lines.push(`  totals.approvedAcsLinkedToApprovedScenarios:  ${computed.totals.approvedAcsLinkedToApprovedScenarios}`);
  lines.push(`  totals.approvedAcsLinkedToExecutableAutomation: ${computed.totals.approvedAcsLinkedToExecutableAutomation}`);
  lines.push(`  totals.automatedAcsExecuted:                  ${computed.totals.automatedAcsExecuted}`);
  lines.push(`  totals.executedAcsPassed:                     ${computed.totals.executedAcsPassed}`);
  lines.push(`  acDesignCoveragePct:       ${computed.acDesignCoveragePct}`);
  lines.push(`  automationCoveragePct:     ${computed.automationCoveragePct}`);
  lines.push(`  executionCoveragePct:      ${computed.executionCoveragePct}`);
  lines.push(`  passCoveragePct:           ${computed.passCoveragePct}`);
  lines.push('  byInterface:');
  for (const [interfaceType, interfaceCoverage] of Object.entries(computed.byInterface)) {
    lines.push(`    ${interfaceType}: ${JSON.stringify(interfaceCoverage)}`);
  }
  lines.push('');
  lines.push(
    'This is a preview only. Copy these values into ' +
      `traceability/capabilities/${capability}.coverage.json by hand, then run ` +
      '`npm run validate:rtm` (or `npm run validate:artifacts`) as usual - this script never ' +
      'writes to traceability/.',
  );
  return lines.join('\n');
}

function main(): void {
  const capability = process.argv[2];
  if (capability === undefined || capability.trim() === '') {
    console.error(
      'Usage: node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/compute-coverage-preview.ts <capability>',
    );
    process.exitCode = 1;
    return;
  }

  try {
    const rtm = loadRtm(capability);
    const computed = computeCoverage(rtm);

    console.log(render(capability, rtm.artifactVersion, computed));

    const reportRelativePath = `reports/validation/coverage-preview-${capability}.json`;
    const reportAbsolutePath = toAbsolute(reportRelativePath);
    // Guard against a capability argument that could escape reports/ (e.g. "../../etc").
    const reportsRoot = toAbsolute('reports/validation');
    if (!reportAbsolutePath.startsWith(reportsRoot + path.sep) && reportAbsolutePath !== reportsRoot) {
      throw new Error(`Refusing to write outside reports/validation/: ${toRelative(reportAbsolutePath)}`);
    }
    fs.mkdirSync(path.dirname(reportAbsolutePath), { recursive: true });
    fs.writeFileSync(
      reportAbsolutePath,
      JSON.stringify(
        {
          capability,
          sourceRtm: { path: rtmPathFor(capability), version: rtm.artifactVersion },
          computedAt: new Date().toISOString(),
          totals: computed.totals,
          coverage: {
            acDesignCoveragePct: computed.acDesignCoveragePct,
            automationCoveragePct: computed.automationCoveragePct,
            executionCoveragePct: computed.executionCoveragePct,
            passCoveragePct: computed.passCoveragePct,
            byInterface: computed.byInterface,
          },
          note:
            'Preview only, generated from computeCoverage() in src/models/rtm.model.ts - the same ' +
            'function SEM-COVERAGE validates against. Never written automatically into ' +
            'traceability/; copy by hand into the governed coverage.json.',
        },
        null,
        2,
      ) + '\n',
    );
    console.log(`\nReport written to ${toRelative(reportAbsolutePath)} (relative to ${PROJECT_ROOT})`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}

main();
