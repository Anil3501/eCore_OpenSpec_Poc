import fs from 'node:fs';
import path from 'node:path';

import { PROJECT_ROOT } from './artifact-io.ts';

/**
 * Resolves an installed CLI to its JavaScript entry point.
 *
 * Deliberately not the `node_modules/.bin` shim: Node refuses to execFile a
 * Windows `.cmd` without a shell, and this repository's path contains spaces,
 * so shelling out invites a quoting bug. Running the entry point with
 * `process.execPath` sidesteps both.
 *
 * Returns null when the package or its bin entry is absent, so a caller can
 * skip rather than fail - `npm run preflight` is what reports a missing CLI.
 */
export function resolveBinEntry(pkg: string, bin: string): string | null {
  const packageDir = path.join(PROJECT_ROOT, 'node_modules', ...pkg.split('/'));
  const manifestPath = path.join(packageDir, 'package.json');
  if (!fs.existsSync(manifestPath)) return null;

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as {
    bin?: string | Record<string, string>;
  };

  const relativeEntry =
    typeof manifest.bin === 'string' ? manifest.bin : (manifest.bin?.[bin] ?? null);
  if (!relativeEntry) return null;

  const entry = path.join(packageDir, relativeEntry);
  return fs.existsSync(entry) ? entry : null;
}
