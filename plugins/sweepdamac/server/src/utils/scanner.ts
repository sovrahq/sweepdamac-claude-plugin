import { statSync, readdirSync, existsSync } from "node:fs";
import { join, basename } from "node:path";
import { homedir } from "node:os";

export interface FileEntry {
  path: string;
  size: number;
  lastAccessed: Date;
  lastModified: Date;
  isDirectory: boolean;
}

export function home(): string {
  return homedir();
}

export function expandPath(p: string): string {
  if (p.startsWith("~")) return join(homedir(), p.slice(1));
  return p;
}

export function exists(p: string): boolean {
  return existsSync(expandPath(p));
}

export function dirSize(dir: string): number {
  let total = 0;
  try {
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = join(dir, entry.name);
      try {
        if (entry.isDirectory()) {
          total += dirSize(full);
        } else {
          total += statSync(full).size;
        }
      } catch {
        // skip inaccessible
      }
    }
  } catch {
    // skip inaccessible
  }
  return total;
}

export function scanDirectory(
  dir: string,
  opts: {
    minSizeMb?: number;
    olderThanDays?: number;
    maxDepth?: number;
    currentDepth?: number;
  } = {}
): FileEntry[] {
  const results: FileEntry[] = [];
  const resolvedDir = expandPath(dir);
  const depth = opts.currentDepth ?? 0;
  const maxDepth = opts.maxDepth ?? 20;

  if (depth > maxDepth) return results;
  if (!existsSync(resolvedDir)) return results;

  try {
    const entries = readdirSync(resolvedDir, { withFileTypes: true });
    for (const entry of entries) {
      const full = join(resolvedDir, entry.name);
      try {
        const stat = statSync(full);
        const size = entry.isDirectory() ? dirSize(full) : stat.size;
        const sizeMb = size / (1024 * 1024);
        const ageDays =
          (Date.now() - stat.atimeMs) / (1000 * 60 * 60 * 24);

        if (opts.minSizeMb && sizeMb < opts.minSizeMb) continue;
        if (opts.olderThanDays && ageDays < opts.olderThanDays) continue;

        results.push({
          path: full,
          size,
          lastAccessed: stat.atime,
          lastModified: stat.mtime,
          isDirectory: entry.isDirectory(),
        });
      } catch {
        // skip inaccessible
      }
    }
  } catch {
    // skip inaccessible
  }

  return results;
}

export function listSubdirs(dir: string): { name: string; size: number }[] {
  const resolvedDir = expandPath(dir);
  if (!existsSync(resolvedDir)) return [];
  const results: { name: string; size: number }[] = [];
  try {
    const entries = readdirSync(resolvedDir, { withFileTypes: true });
    for (const entry of entries) {
      const full = join(resolvedDir, entry.name);
      try {
        const size = entry.isDirectory()
          ? dirSize(full)
          : statSync(full).size;
        results.push({ name: entry.name, size });
      } catch {
        // skip
      }
    }
  } catch {
    // skip
  }
  return results.sort((a, b) => b.size - a.size);
}

export function findFilesByPattern(
  dir: string,
  pattern: RegExp,
  maxDepth = 5,
  currentDepth = 0
): string[] {
  const results: string[] = [];
  const resolvedDir = expandPath(dir);
  if (currentDepth > maxDepth || !existsSync(resolvedDir)) return results;

  try {
    const entries = readdirSync(resolvedDir, { withFileTypes: true });
    for (const entry of entries) {
      const full = join(resolvedDir, entry.name);
      if (pattern.test(entry.name)) {
        results.push(full);
      }
      if (entry.isDirectory()) {
        results.push(
          ...findFilesByPattern(full, pattern, maxDepth, currentDepth + 1)
        );
      }
    }
  } catch {
    // skip
  }
  return results;
}
