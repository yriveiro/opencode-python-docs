import type { DocIndex } from "./types";

/**
 * Mapping from a keyword to relevant documentation types and sample entries.
 */
export interface KeywordMapping {
  keyword: string;
  types: string[];
  sampleEntries: string[];
  score: number;
}

/**
 * Enhanced search index with keyword-to-types mappings for type inference.
 */
export interface SearchIndex {
  version: string;
  generatedAt: string;
  totalEntries: number;
  typeStats: Record<string, number>;
  keywordMappings: KeywordMapping[];
}

/**
 * Result of type inference for a query.
 */
export interface TypeInferenceResult {
  query: string;
  inferredTypes: string[];
  confidence: number;
  matchingKeywords: string[];
  alternativeTypes: string[];
}

/**
 * Extract meaningful keywords from an entry name.
 * Filters out short words, numbers, and common noise words.
 * @internal Exported for testing only.
 */
export function extractKeywords(name: string): string[] {
  const normalized = name.toLowerCase();

  // Remove section numbers like "1.", "2.1.", etc.
  const withoutNumbers = normalized.replace(/^\d+(\.\d+)*\.?\s*/g, "");

  // Split on common separators and filter
  const keywords = withoutNumbers
    .split(/[\s\-_.()<>,:]+/)
    .filter((k) => k.length > 2)
    .filter(
      (k) => !["and", "the", "for", "with", "from", "using", "objects", "object"].includes(k),
    );

  return [...new Set(keywords)];
}

/**
 * Calculate statistics about each documentation type.
 */
function calculateTypeStats(index: DocIndex): Record<string, number> {
  const stats: Record<string, number> = {};
  for (const entry of index.entries) {
    stats[entry.type] = (stats[entry.type] || 0) + 1;
  }
  return stats;
}

/**
 * Build keyword mappings from index entries.
 * Maps each keyword to the types it appears in, ranked by frequency.
 */
function buildKeywordMappings(index: DocIndex): KeywordMapping[] {
  const keywordTypeMap = new Map<string, Map<string, number>>();
  const keywordEntryMap = new Map<string, string[]>();

  for (const entry of index.entries) {
    const keywords = extractKeywords(entry.name);

    for (const keyword of keywords) {
      let typeFreq = keywordTypeMap.get(keyword);
      let samples = keywordEntryMap.get(keyword);

      if (!typeFreq || !samples) {
        typeFreq = new Map();
        samples = [];
        keywordTypeMap.set(keyword, typeFreq);
        keywordEntryMap.set(keyword, samples);
      }

      typeFreq.set(entry.type, (typeFreq.get(entry.type) || 0) + 1);

      if (samples.length < 3) {
        samples.push(`${entry.name} (${entry.type})`);
      }
    }
  }

  const mappings: KeywordMapping[] = [];

  for (const [keyword, typeFreq] of keywordTypeMap) {
    const totalFreq = Array.from(typeFreq.values()).reduce((a, b) => a + b, 0);

    // Get top types (at least 2 occurrences, or 1 if that's all there is)
    const sortedTypes = Array.from(typeFreq.entries())
      .sort((a, b) => b[1] - a[1])
      .filter(([_, count]) => count >= 2 || typeFreq.size === 1)
      .slice(0, 5)
      .map(([type]) => type);

    if (sortedTypes.length > 0) {
      mappings.push({
        keyword,
        types: sortedTypes,
        sampleEntries: keywordEntryMap.get(keyword) || [],
        score: totalFreq,
      });
    }
  }

  // Sort by score (descending) for faster lookups
  return mappings.sort((a, b) => b.score - a.score);
}

/**
 * Creates a search index from a documentation index.
 * @param index - The documentation index to analyze
 * @param version - The Python version
 * @returns SearchIndex with keyword mappings for type inference
 */
export function createSearchIndex(index: DocIndex, version: string): SearchIndex {
  const typeStats = calculateTypeStats(index);
  const keywordMappings = buildKeywordMappings(index);

  return {
    version,
    generatedAt: new Date().toISOString(),
    totalEntries: index.entries.length,
    typeStats,
    keywordMappings,
  };
}

/**
 * Infer the most relevant documentation types for a search query.
 * @param query - The search query
 * @param searchIndex - The search index with keyword mappings
 * @returns Type inference result with suggested types and confidence
 */
export function inferTypesForQuery(query: string, searchIndex: SearchIndex): TypeInferenceResult {
  const queryLower = query.toLowerCase();
  const queryKeywords = extractKeywords(query);

  // Find matching keywords in our index
  const matchingMappings = searchIndex.keywordMappings.filter(
    (m) => queryLower.includes(m.keyword) || queryKeywords.includes(m.keyword),
  );

  // Score and rank types
  const typeScores = new Map<string, number>();
  const matchingKeywords: string[] = [];

  for (const mapping of matchingMappings) {
    matchingKeywords.push(mapping.keyword);
    for (const type of mapping.types) {
      const currentScore = typeScores.get(type) || 0;
      // Weight by keyword frequency in the documentation
      typeScores.set(type, currentScore + mapping.score);
    }
  }

  // Sort types by score
  const sortedTypes = Array.from(typeScores.entries()).sort((a, b) => b[1] - a[1]);

  // Top types are the primary recommendations
  const inferredTypes = sortedTypes.slice(0, 3).map(([type]) => type);

  // Alternative types are the next tier
  const alternativeTypes = sortedTypes.slice(3, 6).map(([type]) => type);

  // Calculate confidence based on keyword matches and scores
  const totalScore = sortedTypes.reduce((sum, [_, score]) => sum + score, 0);
  const confidence =
    matchingMappings.length > 0
      ? Math.min(100, matchingMappings.length * 10 + totalScore / 100)
      : 0;

  return {
    query,
    inferredTypes,
    confidence,
    matchingKeywords: matchingKeywords.slice(0, 5),
    alternativeTypes,
  };
}

/**
 * Get all available types from a search index.
 * @param searchIndex - The search index
 * @returns Array of types sorted by frequency
 */
export function getAvailableTypes(searchIndex: SearchIndex): string[] {
  return Object.entries(searchIndex.typeStats)
    .sort((a, b) => b[1] - a[1])
    .map(([type]) => type);
}
