import type { CacheManagerInterface } from "./cache";
import type { PythonVersion } from "./config";
import { CONFIG } from "./config";
import { htmlToMarkdown } from "./html-to-markdown";
import type { Logger } from "./logger";
import type { CachedDoc, DocIndex, FetchedDoc } from "./types";

async function fetchWithTimeout(url: string, log: Logger): Promise<string> {
  await log.info(`Fetching: ${url}`);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CONFIG.fetchTimeoutMs);

  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } catch (err) {
    await log.error(`Fetch failed: ${url} → ${err}`);
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

/** Service for fetching and searching Python documentation. */
export interface DocService {
  getIndex(version: PythonVersion): Promise<DocIndex>;
  getDoc(version: PythonVersion, path: string): Promise<FetchedDoc>;
  search(index: DocIndex, query: string, type?: string, limit?: number): DocIndex["entries"];
}

/**
 * Creates a documentation service with caching and search capabilities.
 * @param cache - Cache manager for storing fetched documentation.
 * @param log - Logger for tracking fetch operations.
 * @returns DocService implementation.
 */
export function createDocService(cache: CacheManagerInterface, log: Logger): DocService {
  return {
    async getIndex(version: PythonVersion): Promise<DocIndex> {
      const indexPath = cache.getIndexPath(version);

      if (cache.isValid(indexPath, CONFIG.indexTtlMs)) {
        const cached = cache.read<DocIndex>(indexPath);
        if (cached) return cached;
      }

      const text = await fetchWithTimeout(`${CONFIG.baseUrl}/python~${version}/index.json`, log);
      const index = JSON.parse(text) as DocIndex;
      cache.write(indexPath, index);
      return index;
    },

    async getDoc(version: PythonVersion, path: string): Promise<FetchedDoc> {
      const normalizedPath = path.endsWith(".html") ? path.slice(0, -5) : path;
      const docPath = cache.getDocPath(version, normalizedPath);

      if (cache.isValid(docPath, CONFIG.docTtlMs)) {
        const cached = cache.read<CachedDoc>(docPath);
        // Ensure cached data has anchorIndex (older cache entries may not)
        if (cached?.anchorIndex) {
          return { ...cached, fromCache: true, path: normalizedPath };
        }
      }

      const html = await fetchWithTimeout(
        `${CONFIG.baseUrl}/python~${version}/${normalizedPath}.html`,
        log,
      );

      const { markdown, anchorIndex } = htmlToMarkdown(html);
      const payload: CachedDoc = {
        markdown,
        anchorIndex,
        fetchedAt: Date.now(),
      };
      cache.write(docPath, payload);

      return { ...payload, fromCache: false, path: normalizedPath };
    },

    search(index: DocIndex, query: string, type?: string, limit?: number): DocIndex["entries"] {
      const maxResults = limit ?? CONFIG.defaultLimit;
      const q = query.toLowerCase();
      const t = type?.toLowerCase();
      const results: DocIndex["entries"] = [];

      for (const entry of index.entries) {
        if (results.length >= maxResults) break;

        const nameMatch = entry.name.toLowerCase().includes(q);
        const typeMatch = !t || entry.type.toLowerCase().includes(t);

        if (nameMatch && typeMatch) {
          results.push(entry);
        }
      }

      return results;
    },
  };
}
