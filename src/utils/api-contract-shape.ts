import { createHash } from 'node:crypto';

/**
 * Shape fingerprinting for API response contracts.
 *
 * A HUMAN_APPROVED contract is ratified once and then never re-checked, so if
 * the provider changes the response six months later nothing notices: the test
 * either fails for a reason nobody can trace back to the contract, or keeps
 * passing against an assertion that has quietly stopped meaning anything. An
 * OpenAPI contract does not have this problem because the document itself is
 * diffable. A human decision is not, unless we record what was decided.
 *
 * The fingerprint deliberately covers keys and types and never values. Values
 * change legitimately on every run - ids, timestamps, row counts - so hashing
 * them would cry drift constantly and be switched off within a week. A key
 * appearing, vanishing or changing type is the change worth a human's time.
 */

/** Canonical, order-independent description of a value's shape. */
function describeShape(value: unknown): string {
  if (value === null) return 'null';
  if (Array.isArray(value)) {
    // Element shapes are deduped and sorted so row count is not part of the
    // fingerprint: three rows and three hundred describe the same contract.
    const inner = [...new Set(value.map(describeShape))].sort();
    return `[${inner.join('|')}]`;
  }
  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .map(([key, item]) => `${key}:${describeShape(item)}`)
      .sort();
    return `{${entries.join(',')}}`;
  }
  return typeof value;
}

export function describeResponseShape(body: unknown): string {
  return describeShape(body);
}

/** Stable sha256 over the shape description. Safe to store in a test plan. */
export function computeResponseShapeHash(body: unknown): string {
  return createHash('sha256').update(describeShape(body)).digest('hex');
}

function flatten(value: unknown, path: string, out: Map<string, string>): void {
  const record = (type: string): void => {
    const existing = out.get(path);
    if (existing === undefined || existing === type) {
      out.set(path, type);
      return;
    }
    out.set(path, [...new Set([...existing.split('|'), type])].sort().join('|'));
  };

  if (Array.isArray(value)) {
    record('array');
    for (const item of value) flatten(item, `${path}[]`, out);
    return;
  }
  if (value !== null && typeof value === 'object') {
    record('object');
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      flatten(item, `${path}.${key}`, out);
    }
    return;
  }
  record(value === null ? 'null' : typeof value);
}

/**
 * Human-readable drift, so a warning names the field that moved rather than
 * only reporting that two hashes differ. A diff nobody can act on gets ignored.
 */
export function diffResponseShapes(approved: unknown, observed: unknown): string[] {
  const before = new Map<string, string>();
  const after = new Map<string, string>();
  flatten(approved, '$', before);
  flatten(observed, '$', after);

  const differences: string[] = [];
  for (const [path, type] of before) {
    const now = after.get(path);
    if (now === undefined) differences.push(`${path}: removed (was ${type})`);
    else if (now !== type) differences.push(`${path}: type changed ${type} -> ${now}`);
  }
  for (const [path, type] of after) {
    if (!before.has(path)) differences.push(`${path}: added (${type})`);
  }
  return differences.sort();
}
