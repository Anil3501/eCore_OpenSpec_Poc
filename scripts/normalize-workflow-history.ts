/**
 * Usage: node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/normalize-workflow-history.ts [--dry-run]
 *
 * ONE-TIME MIGRATION, authorised by the repository owner on 2026-09-04 (option D).
 *
 * workflow/history/*.jsonl is append-only evidence and has never had a schema, a Zod
 * model or a validator. As a result it drifted into six different field vocabularies
 * across two stories, and nine events in WF-ETA-411-R1.0 were written truncated.
 * This script rewrites every history file into one canonical event shape.
 *
 * It deliberately breaks the append-only rule, which is why it is a script and not an
 * inline command: the change is reviewable, re-runnable and reports exactly what it did.
 * It also writes into workflow/, which the framework-tooling convention normally forbids
 * for tooling. Both deviations are intentional and scoped to this migration.
 *
 * Two honesty constraints are enforced in code, not left to discipline:
 *
 *   1. Truncated events cannot be repaired. Their tail was already lost in the only
 *      commit that contains them, so no wording is invented. Whatever scalar fields
 *      survive ahead of the cut are salvaged, the partial text is kept verbatim, and
 *      the event is flagged truncated:true with an explicit marker in notes.
 *   2. status and outputs are copied when present and omitted when absent. A missing
 *      status is never guessed - an invented gate status would be worse than no status.
 *
 * The pre-migration bytes of every file are written to the JSON report so the original
 * is recoverable from this repository even if the change is committed.
 */
import fs from 'node:fs';
import path from 'node:path';
import { PROJECT_ROOT, toAbsolute, toRelative } from '../src/utils/artifact-io.ts';

const HISTORY_DIR = 'workflow/history';
const REPORT_PATH = 'reports/validation/history-normalization.json';

interface CanonicalEvent {
  eventId: string;
  workflowId: string;
  occurredAt: string;
  actor: string | null;
  event: string;
  stage: string | null;
  status?: string;
  outputs?: string[];
  delegatedTo?: string;
  errorCode?: string;
  notes: string;
  truncated?: true;
}

interface FileOutcome {
  file: string;
  totalLines: number;
  parsedNormally: number;
  salvagedFromTruncated: number;
  generatedEventIds: number;
  derivedWorkflowIds: number;
  originalLines: string[];
}

function firstString(source: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === 'string' && value.length > 0) return value;
  }
  return null;
}

function capture(raw: string, pattern: RegExp): string | null {
  const match = raw.match(pattern);
  return match ? match[1] : null;
}

/** Pulls the scalar fields that sit ahead of the cut in a truncated line. */
function salvageTruncated(raw: string, workflowId: string): Omit<CanonicalEvent, 'eventId'> {
  const occurredAt = capture(raw, /"(?:occurredAt|timestamp|at)":"([^"]+)"/);
  const stage = capture(raw, /"stage":"([^"]+)"/);
  const event = capture(raw, /"event":"([^"]+)"/);
  const actor = capture(raw, /"(?:actor|agent)":"([^"]+)"/);
  const status = capture(raw, /"status":"([^"]+)"/);

  let outputs: string[] | undefined;
  const outputsRaw = capture(raw, /"outputs":(\[[^\]]*\])/);
  if (outputsRaw) {
    try {
      outputs = JSON.parse(outputsRaw) as string[];
    } catch {
      outputs = undefined;
    }
  }

  const partial = capture(raw, /"(?:notes|note|details|detail)":"([\s\S]*)$/) ?? '';
  const cleaned = partial.replace(/\\"/g, '"').replace(/"$/, '');
  const marker =
    ' [TRUNCATED: this event was written cut off on 2026-09-01 and is truncated in the only ' +
    'commit that contains it. The remaining text is unrecoverable and has NOT been reconstructed.]';

  const salvaged: Omit<CanonicalEvent, 'eventId'> = {
    workflowId,
    occurredAt: occurredAt ?? '',
    actor,
    event: event ?? 'UNKNOWN',
    stage,
    notes: cleaned + marker,
    truncated: true,
  };
  if (status) salvaged.status = status;
  if (outputs) salvaged.outputs = outputs;
  return salvaged;
}

function toCanonical(parsed: Record<string, unknown>, workflowId: string): Omit<CanonicalEvent, 'eventId'> {
  const canonical: Omit<CanonicalEvent, 'eventId'> = {
    workflowId: firstString(parsed, ['workflowId']) ?? workflowId,
    occurredAt: firstString(parsed, ['occurredAt', 'timestamp', 'at']) ?? '',
    actor: firstString(parsed, ['actor', 'agent']),
    event: firstString(parsed, ['event']) ?? 'UNKNOWN',
    stage: firstString(parsed, ['stage']),
    notes: firstString(parsed, ['notes', 'note', 'details', 'detail']) ?? '',
  };

  const status = firstString(parsed, ['status']);
  if (status) canonical.status = status;

  if (Array.isArray(parsed.outputs)) {
    canonical.outputs = (parsed.outputs as unknown[]).filter((o): o is string => typeof o === 'string');
  }

  const delegatedTo = firstString(parsed, ['delegatedTo']);
  if (delegatedTo) canonical.delegatedTo = delegatedTo;

  const errorCode = firstString(parsed, ['errorCode']);
  if (errorCode) canonical.errorCode = errorCode;

  return canonical;
}

function orderKeys(event: CanonicalEvent): Record<string, unknown> {
  const ordered: Record<string, unknown> = {
    eventId: event.eventId,
    workflowId: event.workflowId,
    occurredAt: event.occurredAt,
    actor: event.actor,
    event: event.event,
    stage: event.stage,
  };
  if (event.status !== undefined) ordered.status = event.status;
  if (event.outputs !== undefined) ordered.outputs = event.outputs;
  if (event.delegatedTo !== undefined) ordered.delegatedTo = event.delegatedTo;
  if (event.errorCode !== undefined) ordered.errorCode = event.errorCode;
  ordered.notes = event.notes;
  if (event.truncated !== undefined) ordered.truncated = event.truncated;
  return ordered;
}

function normalizeFile(relativePath: string, dryRun: boolean): FileOutcome {
  const absolute = toAbsolute(relativePath);
  const workflowId = path.basename(relativePath).replace(/\.history\.jsonl$/, '');
  const originalLines = fs.readFileSync(absolute, 'utf8').split(/\r?\n/).filter((l) => l.trim().length > 0);

  const staged: Array<{ event: Omit<CanonicalEvent, 'eventId'>; existingId: string | null }> = [];
  let parsedNormally = 0;
  let salvagedFromTruncated = 0;

  for (const line of originalLines) {
    let parsed: Record<string, unknown> | null = null;
    try {
      parsed = JSON.parse(line) as Record<string, unknown>;
    } catch {
      parsed = null;
    }

    if (parsed) {
      parsedNormally++;
      staged.push({ event: toCanonical(parsed, workflowId), existingId: firstString(parsed, ['eventId']) });
    } else {
      salvagedFromTruncated++;
      staged.push({ event: salvageTruncated(line, workflowId), existingId: capture(line, /"eventId":"([^"]+)"/) });
    }
  }

  const used = new Set<string>();
  for (const item of staged) {
    if (item.existingId) used.add(item.existingId);
  }

  let generatedEventIds = 0;
  let derivedWorkflowIds = 0;
  const events: CanonicalEvent[] = [];

  for (let i = 0; i < staged.length; i++) {
    const item = staged[i];
    let eventId = item.existingId;
    if (!eventId) {
      let n = i + 1;
      while (used.has(`EVT-${workflowId}-${String(n).padStart(3, '0')}`)) n++;
      eventId = `EVT-${workflowId}-${String(n).padStart(3, '0')}`;
      used.add(eventId);
      generatedEventIds++;
    }
    if (item.event.workflowId === workflowId) derivedWorkflowIds++;
    events.push({ eventId, ...item.event });
  }

  if (!dryRun) {
    const body = events.map((e) => JSON.stringify(orderKeys(e))).join('\n') + '\n';
    fs.writeFileSync(absolute, body, 'utf8');
  }

  return {
    file: relativePath,
    totalLines: originalLines.length,
    parsedNormally,
    salvagedFromTruncated,
    generatedEventIds,
    derivedWorkflowIds,
    originalLines,
  };
}

function main(): void {
  const dryRun = process.argv.includes('--dry-run');
  const dir = toAbsolute(HISTORY_DIR);

  if (!fs.existsSync(dir)) {
    console.error(`History directory not found: ${HISTORY_DIR}`);
    process.exitCode = 1;
    return;
  }

  const files = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.history.jsonl'))
    .map((f) => `${HISTORY_DIR}/${f}`);

  console.log(dryRun ? 'DRY RUN - no file will be written\n' : 'Normalizing workflow history\n');

  const outcomes: FileOutcome[] = [];
  for (const file of files) {
    const outcome = normalizeFile(file, dryRun);
    outcomes.push(outcome);
    console.log(`${outcome.file}`);
    console.log(`  events                 : ${outcome.totalLines}`);
    console.log(`  parsed normally        : ${outcome.parsedNormally}`);
    console.log(`  salvaged from truncated: ${outcome.salvagedFromTruncated}`);
    console.log(`  eventIds generated     : ${outcome.generatedEventIds}`);
    console.log('');
  }

  // A migration that leaves the file unparseable is worse than no migration.
  let verificationFailures = 0;
  if (!dryRun) {
    for (const outcome of outcomes) {
      const lines = fs.readFileSync(toAbsolute(outcome.file), 'utf8').split(/\r?\n/).filter((l) => l.trim().length > 0);
      for (const line of lines) {
        try {
          JSON.parse(line);
        } catch {
          verificationFailures++;
        }
      }
      if (lines.length !== outcome.totalLines) {
        console.error(`${outcome.file}: event count changed ${outcome.totalLines} -> ${lines.length}`);
        verificationFailures++;
      }
    }
    console.log(
      verificationFailures === 0
        ? 'Verification: every rewritten line parses and no event was lost.'
        : `Verification FAILED with ${verificationFailures} problem(s).`,
    );
  }

  const report = {
    generatedAt: new Date().toISOString(),
    migration: 'normalize-workflow-history',
    dryRun,
    authorisedBy: 'repository owner, 2026-09-04, option D',
    canonicalShape: ['eventId', 'workflowId', 'occurredAt', 'actor', 'event', 'stage', 'status?', 'outputs?', 'delegatedTo?', 'errorCode?', 'notes', 'truncated?'],
    note: 'originalLines holds the pre-migration bytes of every file so the previous content stays recoverable from this repository.',
    verificationFailures,
    files: outcomes,
  };
  fs.mkdirSync(path.dirname(toAbsolute(REPORT_PATH)), { recursive: true });
  fs.writeFileSync(toAbsolute(REPORT_PATH), JSON.stringify(report, null, 2), 'utf8');
  console.log(`\nReport written to ${toRelative(toAbsolute(REPORT_PATH))}`);

  if (verificationFailures > 0) process.exitCode = 1;
}

main();
