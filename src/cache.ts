import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";

/** Interface for cache operations, enabling dependency injection in tests. */
export interface CacheManagerInterface {
  getIndexPath(version: string): string;
  getDocPath(version: string, docPath: string): string;
  isValid(path: string, ttlMs: number): boolean;
  read<T>(path: string): T | null;
  write<T>(path: string, data: T): void;
  runGarbageCollection(
    indexTtlMs: number,
    docTtlMs: number,
  ): { scanned: number; deleted: number; errors: number };
}

function hash(input: string): string {
  return createHash("sha1").update(input).digest("hex");
}

/**
 * Creates a file-based cache manager for storing documentation.
 * Uses SHA-1 hashes for document filenames to handle arbitrary paths.
 * @param cacheRoot - Root directory for all cached files.
 * @returns A CacheManagerInterface implementation.
 */
export function CacheManager(cacheRoot: string): CacheManagerInterface {
  if (!existsSync(cacheRoot)) {
    mkdirSync(cacheRoot, { recursive: true });
  }

  return {
    getIndexPath(version: string): string {
      return join(cacheRoot, `python-${version}.json`);
    },

    getDocPath(version: string, docPath: string): string {
      return join(cacheRoot, "docs", version, `${hash(docPath)}.json`);
    },

    isValid(path: string, ttlMs: number): boolean {
      try {
        return Date.now() - statSync(path).mtimeMs < ttlMs;
      } catch {
        return false;
      }
    },

    read<T>(path: string): T | null {
      try {
        return JSON.parse(readFileSync(path, "utf-8")) as T;
      } catch {
        return null;
      }
    },

    write<T>(path: string, data: T): void {
      const dir = dirname(path);
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }
      writeFileSync(path, JSON.stringify(data));
    },

    runGarbageCollection(
      indexTtlMs: number,
      docTtlMs: number,
    ): { scanned: number; deleted: number; errors: number } {
      let scanned = 0;
      let deleted = 0;
      let errors = 0;

      const tryDelete = (filePath: string, ttl: number) => {
        scanned++;
        if (!this.isValid(filePath, ttl)) {
          try {
            unlinkSync(filePath);
            deleted++;
          } catch {
            errors++;
          }
        }
      };

      if (existsSync(cacheRoot)) {
        try {
          for (const file of readdirSync(cacheRoot)) {
            if (file.endsWith(".json")) {
              tryDelete(join(cacheRoot, file), indexTtlMs);
            }
          }
        } catch {
          errors++;
        }
      }

      const docsRoot = join(cacheRoot, "docs");
      if (existsSync(docsRoot)) {
        try {
          for (const version of readdirSync(docsRoot)) {
            const versionDir = join(docsRoot, version);
            try {
              for (const doc of readdirSync(versionDir)) {
                tryDelete(join(versionDir, doc), docTtlMs);
              }
            } catch {
              errors++;
            }
          }
        } catch {
          errors++;
        }
      }

      return { scanned, deleted, errors };
    },
  };
}
