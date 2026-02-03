import type { CacheManagerInterface } from "./cache";
import type { PythonVersion } from "./config";
import { CONFIG } from "./config";
import { htmlToMarkdown } from "./html-to-markdown";
import type { Logger } from "./logger";
import {
  createSearchIndex,
  getAvailableTypes,
  inferTypesForQuery,
  type SearchIndex,
  type TypeInferenceResult,
} from "./search-index";
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
  getSearchIndex(version: PythonVersion): Promise<SearchIndex>;
  getDoc(version: PythonVersion, path: string): Promise<FetchedDoc>;
  search(index: DocIndex, query: string, type?: string, limit?: number): DocIndex["entries"];
  searchWithFallback(
    index: DocIndex,
    searchIndex: SearchIndex,
    query: string,
    type?: string,
    limit?: number,
  ): Promise<{
    results: DocIndex["entries"];
    fallbackUsed: boolean;
    typeInference?: TypeInferenceResult;
  }>;
  suggestTypes(searchIndex: SearchIndex, query: string): TypeInferenceResult;
  getAvailableTypes(searchIndex: SearchIndex): string[];
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

    async getSearchIndex(version: PythonVersion): Promise<SearchIndex> {
      const searchIndexPath = cache.getSearchIndexPath(version);

      // Check if we have a valid cached search index
      if (cache.isValid(searchIndexPath, CONFIG.indexTtlMs)) {
        const cached = cache.read<SearchIndex>(searchIndexPath);
        if (cached) {
          await log.info(`Using cached search index for Python ${version}`);
          return cached;
        }
      }

      // Build search index from the main index
      await log.info(`Building search index for Python ${version}...`);
      const index = await this.getIndex(version);
      const searchIndex = createSearchIndex(index, version);

      // Cache the search index
      cache.write(searchIndexPath, searchIndex);
      await log.info(
        `Cached search index with ${searchIndex.keywordMappings.length} keyword mappings`,
      );

      return searchIndex;
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
        const typeMatch = !t || entry.type.toLowerCase() === t;

        if (nameMatch && typeMatch) {
          results.push(entry);
        }
      }

      return results;
    },

    async searchWithFallback(
      index: DocIndex,
      searchIndex: SearchIndex,
      query: string,
      type?: string,
      limit?: number,
    ): Promise<{
      results: DocIndex["entries"];
      fallbackUsed: boolean;
      typeInference?: TypeInferenceResult;
    }> {
      // Try the requested search first
      const results = this.search(index, query, type, limit);

      // If we have results or no type filter, return as-is
      if (results.length > 0 || !type) {
        return { results, fallbackUsed: false };
      }

      // No results with type filter - use type inference to suggest alternatives
      await log.info(`No results for "${query}" with type "${type}". Running type inference...`);

      const typeInference = inferTypesForQuery(query, searchIndex);

      // Try searching without the type filter
      const resultsNoFilter = this.search(index, query, undefined, limit);

      // Try searching with the most likely inferred types
      let resultsWithInferred: DocIndex["entries"] = [];
      for (const inferredType of typeInference.inferredTypes.slice(0, 2)) {
        const inferredResults = this.search(
          index,
          query,
          inferredType,
          Math.ceil((limit ?? CONFIG.defaultLimit) / 2),
        );
        resultsWithInferred = resultsWithInferred.concat(inferredResults);
      }

      // Combine results: prioritize inferred type matches, then no-filter matches
      const seen = new Set<string>();
      const combinedResults: DocIndex["entries"] = [];

      for (const entry of resultsWithInferred.concat(resultsNoFilter)) {
        if (!seen.has(entry.path)) {
          seen.add(entry.path);
          combinedResults.push(entry);
          if (combinedResults.length >= (limit ?? CONFIG.defaultLimit)) break;
        }
      }

      return {
        results: combinedResults,
        fallbackUsed: true,
        typeInference,
      };
    },

    suggestTypes(searchIndex: SearchIndex, query: string): TypeInferenceResult {
      return inferTypesForQuery(query, searchIndex);
    },

    getAvailableTypes(searchIndex: SearchIndex): string[] {
      return getAvailableTypes(searchIndex);
    },
  };
}
