import fs from 'node:fs';
import path from 'node:path';

export const PROJECT_ROOT = process.cwd();

export function toAbsolute(relativePath: string): string {
  return path.isAbsolute(relativePath) ? relativePath : path.join(PROJECT_ROOT, relativePath);
}

export function toRelative(absolutePath: string): string {
  return path.relative(PROJECT_ROOT, absolutePath).split(path.sep).join('/');
}

export function exists(relativePath: string): boolean {
  return fs.existsSync(toAbsolute(relativePath));
}

export function readJson<T = unknown>(relativePath: string): T {
  const absolute = toAbsolute(relativePath);
  const raw = fs.readFileSync(absolute, 'utf8');
  try {
    return JSON.parse(raw) as T;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`${toRelative(absolute)} is not valid JSON: ${message}`);
  }
}

/** Lists files with the given extension directly inside a directory (non-recursive). */
export function listFiles(relativeDir: string, extension: string): string[] {
  const absolute = toAbsolute(relativeDir);
  if (!fs.existsSync(absolute)) return [];
  return fs
    .readdirSync(absolute, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(extension))
    .map((entry) => `${relativeDir}/${entry.name}`)
    .sort();
}

/** Lists files with the given extension recursively inside a directory. */
export function listFilesRecursive(relativeDir: string, extension: string): string[] {
  const absolute = toAbsolute(relativeDir);
  if (!fs.existsSync(absolute)) return [];
  const results: string[] = [];
  const walk = (dir: string, relative: string): void => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const nextAbsolute = path.join(dir, entry.name);
      const nextRelative = `${relative}/${entry.name}`;
      if (entry.isDirectory()) {
        walk(nextAbsolute, nextRelative);
      } else if (entry.name.endsWith(extension)) {
        results.push(nextRelative);
      }
    }
  };
  walk(absolute, relativeDir);
  return results.sort();
}

export function readText(relativePath: string): string {
  return fs.readFileSync(toAbsolute(relativePath), 'utf8');
}
