/**
 * Deterministic triage of Playwright failures for the bug-analyzer agent.
 *
 * Usage:
 *   node src/utils/failure-triage.ts
 *
 * Reads the Playwright JSON reporter output (reports/execution/results.json),
 * extracts every failed or timed-out result together with its traceability tags
 * and attachments, classifies the failure signal, copies the evidence out of the
 * volatile test-results/ directory, and writes a machine-readable report to
 * reports/validation/failure-triage.json.
 *
 * This tool makes no judgement about business behaviour. It reports observable
 * signals only. The bug-analyzer agent decides what to do with them.
 *
 * Exit code is 1 when at least one failure is found, so a red run cannot be
 * silently ignored by a caller that only checks the exit status.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { PROJECT_ROOT, exists, listFiles, readJson, toAbsolute, toRelative } from './artifact-io.ts';

const RESULTS_PATH = 'reports/execution/results.json';
const EVIDENCE_ROOT = 'reports/defects';
const DEFECTS_DIR = 'defects';
const REPORT_PATH = 'reports/validation/failure-triage.json';

export type FailureClassification =
  | 'LOCATOR_SUSPECT'
  | 'APPLICATION_DEFECT'
  | 'AMBIGUOUS'
  | 'ENVIRONMENT_BLOCKER';

/**
 * Signals that the test never reached the application at all: DNS, TLS, proxy,
 * refused connections, or missing configuration.
 *
 * These outrank every other signal. A host that does not resolve is a VPN or
 * configuration problem, not a defect in the product - filing it as a bug would
 * waste a developer's time and erode trust in every other bug the framework
 * files. An environment blocker is never healed and never reported; the
 * workflow halts and a human is told exactly what is unreachable.
 */
const ENVIRONMENT_SIGNALS: { id: string; pattern: RegExp }[] = [
  { id: 'DNS_FAILURE', pattern: /err_name_not_resolved|enotfound|eai_again/i },
  { id: 'CONNECTION_REFUSED', pattern: /err_connection_refused|econnrefused/i },
  { id: 'CONNECTION_UNAVAILABLE', pattern: /err_(internet_disconnected|connection_(timed_out|reset|closed|aborted))/i },
  { id: 'PROXY_FAILURE', pattern: /err_(proxy_connection_failed|tunnel_connection_failed)/i },
  { id: 'TLS_FAILURE', pattern: /err_cert_|err_ssl_|unable to verify the first certificate/i },
  { id: 'MISSING_CONFIGURATION', pattern: /missing configuration for|is not set\. browser execution is blocked/i },
];

/**
 * Signals that the test could not find or interact with an element. These are
 * candidates for the governed locator healer before anything is reported.
 */
const LOCATOR_SIGNALS: { id: string; pattern: RegExp }[] = [
  { id: 'STRICT_MODE_VIOLATION', pattern: /strict mode violation/i },
  { id: 'MULTIPLE_ELEMENTS', pattern: /resolved to \d+ elements?/i },
  { id: 'WAITING_FOR_LOCATOR', pattern: /waiting for (locator|getby)/i },
  { id: 'DETACHED_FROM_DOM', pattern: /(is not attached to the dom|element was detached)/i },
  { id: 'ELEMENT_NOT_INTERACTABLE', pattern: /element is not (visible|enabled|stable|editable)/i },
  { id: 'LOCATOR_TIMEOUT', pattern: /timeout .*exceeded[\s\S]*?(locator|getby)/i },
  { id: 'NO_ELEMENT_FOUND', pattern: /(no element|element\(s\) not found|not found in the dom)/i },
];

/**
 * Signals that the application behaved differently from the approved criterion.
 * These never go to the healer - healing them would hide a real defect.
 */
const APPLICATION_SIGNALS: { id: string; pattern: RegExp }[] = [
  { id: 'VALUE_MISMATCH', pattern: /expected\s+.*\n?received/i },
  { id: 'ASSERTION_MISMATCH', pattern: /to(equal|be|havetext|havevalue|havecount)\b[\s\S]*expected/i },
  { id: 'NETWORK_ERROR', pattern: /net::err_/i },
  { id: 'NAVIGATION_FAILED', pattern: /page\.goto|navigation (failed|timeout)/i },
  { id: 'HTTP_ERROR_STATUS', pattern: /\b(status(code)?\s*[:=]?\s*)?(4\d{2}|5\d{2})\b.*(response|request|http)/i },
  { id: 'UNCAUGHT_APP_EXCEPTION', pattern: /(uncaught (typeerror|referenceerror|error)|page crashed)/i },
];

interface TagSet {
  release: string | null;
  capability: string | null;
  requirementId: string | null;
  acId: string | null;
  testPlanId: string | null;
  testScenarioId: string | null;
  jiraStoryId: string | null;
}

interface EvidenceFile {
  name: string;
  contentType: string;
  sourcePath: string;
  preservedPath: string;
}

export interface TriageFinding {
  proposedDefectId: string | null;
  fingerprint: string;
  classification: FailureClassification;
  matchedSignals: string[];
  classificationRationale: string;
  specTitle: string;
  featureFile: string;
  projectName: string;
  status: string;
  retryIndex: number;
  durationSeconds: number;
  errorMessage: string;
  errorStack: string | null;
  tags: TagSet;
  evidence: EvidenceFile[];
  reproductionCommand: string;
}

/** Strips ANSI colour codes that Playwright embeds in error messages. */
function stripAnsi(value: string): string {
  // eslint-disable-next-line no-control-regex
  return value.replace(/\u001B\[[0-9;]*m/g, '');
}

/**
 * Reduces an error message to a stable signature so that the same defect
 * produces the same fingerprint across runs. Volatile detail - timings, ids,
 * absolute paths, line numbers - is removed.
 */
function normalizeErrorSignature(message: string): string {
  return stripAnsi(message)
    .replace(/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/gi, '<uuid>')
    .replace(/\d{4}-\d{2}-\d{2}T[\d:.]+Z?/g, '<timestamp>')
    .replace(/[A-Za-z]:\\[^\s:]+/g, '<path>')
    .replace(/\/(?:[\w.-]+\/)+[\w.-]+/g, '<path>')
    .replace(/\d+/g, '#')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
    .slice(0, 400);
}

function fingerprintOf(tags: TagSet, capability: string, signature: string): string {
  const material = [
    capability,
    tags.acId ?? 'no-ac',
    tags.testScenarioId ?? 'no-ts',
    signature,
  ].join('|');
  return crypto.createHash('sha256').update(material, 'utf8').digest('hex');
}

function classify(errorText: string): {
  classification: FailureClassification;
  matchedSignals: string[];
  rationale: string;
} {
  const locator = LOCATOR_SIGNALS.filter((signal) => signal.pattern.test(errorText)).map((s) => s.id);
  const application = APPLICATION_SIGNALS.filter((signal) => signal.pattern.test(errorText)).map(
    (s) => s.id,
  );
  const environment = ENVIRONMENT_SIGNALS.filter((signal) => signal.pattern.test(errorText)).map(
    (s) => s.id,
  );

  // Checked first and unconditionally: if the application was never reached,
  // nothing can be concluded about its behaviour.
  if (environment.length > 0) {
    return {
      classification: 'ENVIRONMENT_BLOCKER',
      matchedSignals: environment,
      rationale:
        `Matched environment signal(s): ${environment.join(', ')}. ` +
        'The application under test was never reached, so this failure proves nothing about it. ' +
        'Halt and tell a human what is unreachable. Never heal it and never file it as a bug.',
    };
  }

  if (locator.length > 0 && application.length === 0) {
    return {
      classification: 'LOCATOR_SUSPECT',
      matchedSignals: locator,
      rationale: `Matched locator signal(s): ${locator.join(', ')}. No application-behaviour signal matched.`,
    };
  }
  if (application.length > 0 && locator.length === 0) {
    return {
      classification: 'APPLICATION_DEFECT',
      matchedSignals: application,
      rationale: `Matched application signal(s): ${application.join(', ')}. No locator signal matched.`,
    };
  }
  const matched = [...locator, ...application];
  return {
    classification: 'AMBIGUOUS',
    matchedSignals: matched,
    rationale:
      matched.length === 0
        ? 'No known signal matched. Routed to healing first so a real defect is never masked by a stale locator.'
        : `Both locator (${locator.join(', ')}) and application (${application.join(', ')}) signals matched. Routed to healing first.`,
  };
}

function readTag(tags: string[], prefix: string): string | null {
  for (const raw of tags) {
    const tag = raw.startsWith('@') ? raw.slice(1) : raw;
    if (tag.startsWith(prefix)) return tag.slice(prefix.length);
  }
  return null;
}

function collectTags(rawTags: string[]): TagSet {
  const acId = readTag(rawTags, 'ac-');
  const storyFromAc = acId ? /^AC-([A-Z][A-Z0-9]+-\d+)-\d{3}$/.exec(acId) : null;
  return {
    release: readTag(rawTags, 'release-'),
    capability: readTag(rawTags, 'capability-'),
    requirementId: readTag(rawTags, 'req-'),
    acId,
    testPlanId: readTag(rawTags, 'tp-'),
    testScenarioId: readTag(rawTags, 'ts-'),
    jiraStoryId: storyFromAc ? (storyFromAc[1] ?? null) : null,
  };
}

interface RawAttachment {
  name?: string;
  contentType?: string;
  path?: string;
}

interface RawError {
  message?: string;
  stack?: string;
}

interface RawResult {
  status?: string;
  duration?: number;
  retry?: number;
  errors?: RawError[];
  error?: RawError;
  attachments?: RawAttachment[];
}

interface RawTest {
  projectName?: string;
  results?: RawResult[];
}

interface RawSpec {
  title?: string;
  file?: string;
  tags?: string[];
  tests?: RawTest[];
}

interface RawSuite {
  title?: string;
  file?: string;
  specs?: RawSpec[];
  suites?: RawSuite[];
}

interface RawReport {
  suites?: RawSuite[];
}

/** Walks the arbitrarily nested Playwright suite tree and yields every spec. */
function collectSpecs(suites: RawSuite[] | undefined, file: string): { spec: RawSpec; file: string }[] {
  const collected: { spec: RawSpec; file: string }[] = [];
  for (const suite of suites ?? []) {
    const suiteFile = suite.file ?? file;
    for (const spec of suite.specs ?? []) {
      collected.push({ spec, file: spec.file ?? suiteFile });
    }
    collected.push(...collectSpecs(suite.suites, suiteFile));
  }
  return collected;
}

/**
 * Maps a fingerprint to an already-allocated defect id so repeated triage runs
 * stay idempotent, and allocates the next free id per story otherwise.
 */
function buildDefectIdAllocator(): (fingerprint: string, jiraStoryId: string | null) => string | null {
  const byFingerprint = new Map<string, string>();
  const highestPerStory = new Map<string, number>();

  for (const file of listFiles(DEFECTS_DIR, '.json')) {
    if (file.endsWith('.schema.json')) continue;
    let defect: { defectId?: string; fingerprint?: string; jiraStoryId?: string };
    try {
      defect = readJson(file);
    } catch {
      continue;
    }
    if (!defect.defectId) continue;
    if (defect.fingerprint) byFingerprint.set(defect.fingerprint, defect.defectId);
    const parsed = /^DEF-(.+)-(\d{3})$/.exec(defect.defectId);
    if (parsed && parsed[1] && parsed[2]) {
      const current = highestPerStory.get(parsed[1]) ?? 0;
      highestPerStory.set(parsed[1], Math.max(current, Number(parsed[2])));
    }
  }

  return (fingerprint, jiraStoryId) => {
    const known = byFingerprint.get(fingerprint);
    if (known) return known;
    if (!jiraStoryId) return null;
    const next = (highestPerStory.get(jiraStoryId) ?? 0) + 1;
    highestPerStory.set(jiraStoryId, next);
    const allocated = `DEF-${jiraStoryId}-${String(next).padStart(3, '0')}`;
    byFingerprint.set(fingerprint, allocated);
    return allocated;
  };
}

/**
 * Copies an attachment out of test-results/, which the next `npm test` wipes,
 * into reports/defects/<defectId>/ so the evidence outlives the run.
 */
function preserveEvidence(
  attachments: RawAttachment[],
  defectId: string | null,
  fingerprint: string,
): EvidenceFile[] {
  const folder = defectId ?? `unassigned-${fingerprint.slice(0, 12)}`;
  const targetDir = path.join(PROJECT_ROOT, EVIDENCE_ROOT, folder);
  const preserved: EvidenceFile[] = [];

  for (const attachment of attachments) {
    if (!attachment.path) continue;
    const sourceAbsolute = toAbsolute(attachment.path);
    if (!fs.existsSync(sourceAbsolute)) continue;

    fs.mkdirSync(targetDir, { recursive: true });
    // Never trust a reporter-supplied path segment as a destination name.
    const safeName = path.basename(sourceAbsolute).replace(/[^\w.-]/g, '_');
    const destination = path.join(targetDir, safeName);
    fs.copyFileSync(sourceAbsolute, destination);

    preserved.push({
      name: attachment.name ?? safeName,
      contentType: attachment.contentType ?? 'application/octet-stream',
      sourcePath: toRelative(sourceAbsolute),
      preservedPath: toRelative(destination),
    });
  }
  return preserved;
}

export function triage(): TriageFinding[] {
  if (!exists(RESULTS_PATH)) {
    throw new Error(
      `${RESULTS_PATH} was not found. Run "npm test" first so the JSON reporter writes an execution record.`,
    );
  }

  const report = readJson<RawReport>(RESULTS_PATH);
  const allocateDefectId = buildDefectIdAllocator();
  const findings: TriageFinding[] = [];

  for (const { spec, file } of collectSpecs(report.suites, '')) {
    const tags = collectTags(spec.tags ?? []);

    for (const test of spec.tests ?? []) {
      for (const result of test.results ?? []) {
        if (result.status !== 'failed' && result.status !== 'timedOut') continue;

        // The JSON reporter emits `errors` (plural); some versions and some
        // hand-built fixtures carry only the singular `error`. Read both, or a
        // real failure silently classifies as AMBIGUOUS with no signals.
        const errors = result.errors ?? (result.error ? [result.error] : []);
        const errorMessage = stripAnsi(errors.map((error) => error.message ?? '').join('\n')).trim();
        const errorStack = errors.find((error) => error.stack)?.stack ?? null;
        const errorText = `${errorMessage}\n${errorStack ?? ''}`;

        const { classification, matchedSignals, rationale } = classify(errorText);
        const capability = tags.capability ?? 'unknown-capability';
        const fingerprint = fingerprintOf(tags, capability, normalizeErrorSignature(errorMessage));
        const proposedDefectId = allocateDefectId(fingerprint, tags.jiraStoryId);

        findings.push({
          proposedDefectId,
          fingerprint,
          classification,
          matchedSignals,
          classificationRationale: rationale,
          specTitle: spec.title ?? '(untitled scenario)',
          featureFile: file,
          projectName: test.projectName ?? 'unknown',
          status: result.status,
          retryIndex: result.retry ?? 0,
          durationSeconds: Math.round(((result.duration ?? 0) / 1000) * 10) / 10,
          errorMessage,
          errorStack,
          tags,
          evidence: preserveEvidence(result.attachments ?? [], proposedDefectId, fingerprint),
          reproductionCommand: tags.testScenarioId
            ? `npx playwright test --project=${test.projectName ?? 'bdd'} --grep "@ts-${tags.testScenarioId}"`
            : `npx playwright test --project=${test.projectName ?? 'bdd'}`,
        });
      }
    }
  }

  return findings;
}

function render(findings: TriageFinding[]): string {
  if (findings.length === 0) return 'No failed or timed-out results found. Nothing to triage.';

  const lines: string[] = [];
  for (const finding of findings) {
    lines.push(`[${finding.classification}] ${finding.proposedDefectId ?? '(no defect id)'} - ${finding.specTitle}`);
    lines.push(`        ac: ${finding.tags.acId ?? 'unknown'} | ts: ${finding.tags.testScenarioId ?? 'unknown'}`);
    lines.push(`        signals: ${finding.matchedSignals.join(', ') || 'none'}`);
    lines.push(`        evidence: ${finding.evidence.length} file(s) preserved`);
    lines.push(`        repro: ${finding.reproductionCommand}`);
  }
  return lines.join('\n');
}

function main(): void {
  const findings = triage();

  const byClassification = {
    LOCATOR_SUSPECT: findings.filter((f) => f.classification === 'LOCATOR_SUSPECT').length,
    APPLICATION_DEFECT: findings.filter((f) => f.classification === 'APPLICATION_DEFECT').length,
    AMBIGUOUS: findings.filter((f) => f.classification === 'AMBIGUOUS').length,
    ENVIRONMENT_BLOCKER: findings.filter((f) => f.classification === 'ENVIRONMENT_BLOCKER').length,
  };

  const report = {
    generatedAt: new Date().toISOString(),
    source: RESULTS_PATH,
    summary: { totalFailures: findings.length, ...byClassification },
    findings,
  };

  const outputAbsolute = path.join(PROJECT_ROOT, REPORT_PATH);
  fs.mkdirSync(path.dirname(outputAbsolute), { recursive: true });
  fs.writeFileSync(outputAbsolute, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

  console.log(render(findings));
  console.log(
    `\nFailures: ${findings.length} | locator-suspect: ${byClassification.LOCATOR_SUSPECT} | application: ${byClassification.APPLICATION_DEFECT} | ambiguous: ${byClassification.AMBIGUOUS} | environment: ${byClassification.ENVIRONMENT_BLOCKER}`,
  );

  if (byClassification.ENVIRONMENT_BLOCKER > 0) {
    console.log(
      `\nBLOCKED: ${byClassification.ENVIRONMENT_BLOCKER} failure(s) never reached the application ` +
        '(DNS, TLS, proxy, refused connection or missing configuration).\n' +
        'These prove nothing about the product. Do NOT heal them and do NOT file them as bugs - ' +
        'restore access and re-run. Fix the environment first, then re-triage.',
    );
  }

  console.log(`Report written to ${REPORT_PATH}`);

  if (findings.length > 0) {
    process.exitCode = 1;
  }
}

main();
