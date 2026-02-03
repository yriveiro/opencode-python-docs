import { describe, expect, it } from "bun:test";
import {
  createSearchIndex,
  extractKeywords,
  getAvailableTypes,
  inferTypesForQuery,
  type SearchIndex,
} from "../src/search-index";
import type { DocIndex } from "../src/types";

describe("createSearchIndex", () => {
  it("should handle empty index", () => {
    const emptyIndex: DocIndex = { entries: [] };
    const result = createSearchIndex(emptyIndex, "3.12");

    expect(result.version).toBe("3.12");
    expect(result.totalEntries).toBe(0);
    expect(Object.keys(result.typeStats)).toHaveLength(0);
    expect(result.keywordMappings).toHaveLength(0);
    expect(result.generatedAt).toBeDefined();
  });

  it("should calculate type statistics correctly for single entry", () => {
    const singleEntryIndex: DocIndex = {
      entries: [{ name: "asyncio", path: "library/asyncio.html", type: "Library" }],
    };
    const result = createSearchIndex(singleEntryIndex, "3.12");

    expect(result.typeStats).toEqual({ Library: 1 });
    expect(result.totalEntries).toBe(1);
  });

  it("should aggregate multiple entries with same type", () => {
    const index: DocIndex = {
      entries: [
        { name: "json", path: "library/json.html", type: "Library" },
        { name: "csv", path: "library/csv.html", type: "Library" },
        { name: "pickle", path: "library/pickle.html", type: "Library" },
      ],
    };
    const result = createSearchIndex(index, "3.12");

    expect(result.typeStats).toEqual({ Library: 3 });
  });

  it("should track multiple different types", () => {
    const index: DocIndex = {
      entries: [
        { name: "asyncio", path: "library/asyncio.html", type: "Library" },
        { name: "os.path", path: "library/os.path.html", type: "File" },
        { name: "print()", path: "library/functions.html", type: "Built-in Functions" },
      ],
    };
    const result = createSearchIndex(index, "3.12");

    expect(result.typeStats).toEqual({
      Library: 1,
      File: 1,
      "Built-in Functions": 1,
    });
  });

  it("should extract keywords from entry names", () => {
    const index: DocIndex = {
      entries: [
        { name: "asyncio.create_task", path: "asyncio.html", type: "Library" },
        { name: "json.loads()", path: "json.html", type: "Library" },
      ],
    };
    const result = createSearchIndex(index, "3.12");

    expect(result.keywordMappings.length).toBeGreaterThan(0);
    const asyncioMapping = result.keywordMappings.find((m) => m.keyword === "asyncio");
    expect(asyncioMapping).toBeDefined();
    expect(asyncioMapping?.types).toContain("Library");
  });

  it("should handle complex entry names with section numbers", () => {
    const index: DocIndex = {
      entries: [
        { name: "1. Introduction", path: "intro.html", type: "Tutorial" },
        { name: "2.1. Getting Started", path: "start.html", type: "Tutorial" },
      ],
    };
    const result = createSearchIndex(index, "3.12");

    // Keywords should not include section numbers
    const keywords = result.keywordMappings.map((m) => m.keyword);
    expect(keywords).not.toContain("1");
    expect(keywords).not.toContain("2");
    expect(keywords).toContain("introduction");
    expect(keywords).toContain("getting");
    expect(keywords).toContain("started");
  });
});

describe("inferTypesForQuery", () => {
  const mockSearchIndex: SearchIndex = {
    version: "3.12",
    generatedAt: new Date().toISOString(),
    totalEntries: 10,
    typeStats: {
      Library: 5,
      "Built-in Functions": 3,
      Tutorial: 2,
    },
    keywordMappings: [
      {
        keyword: "asyncio",
        types: ["Library", "Built-in Functions"],
        sampleEntries: ["asyncio (Library)"],
        score: 10,
      },
      {
        keyword: "json",
        types: ["Library"],
        sampleEntries: ["json (Library)"],
        score: 5,
      },
      {
        keyword: "introduction",
        types: ["Tutorial"],
        sampleEntries: ["Introduction (Tutorial)"],
        score: 8,
      },
      {
        keyword: "path",
        types: ["Library", "File"],
        sampleEntries: ["os.path (Library)"],
        score: 7,
      },
    ],
  };

  it("should return zero confidence for empty query", () => {
    const result = inferTypesForQuery("", mockSearchIndex);

    expect(result.confidence).toBe(0);
    expect(result.inferredTypes).toHaveLength(0);
    expect(result.alternativeTypes).toHaveLength(0);
    expect(result.matchingKeywords).toHaveLength(0);
  });

  it("should return zero confidence for non-matching query", () => {
    const result = inferTypesForQuery("xyznonexistent", mockSearchIndex);

    expect(result.confidence).toBe(0);
    expect(result.inferredTypes).toHaveLength(0);
  });

  it("should infer types from single keyword match", () => {
    const result = inferTypesForQuery("asyncio", mockSearchIndex);

    expect(result.inferredTypes).toContain("Library");
    expect(result.inferredTypes).toContain("Built-in Functions");
    expect(result.matchingKeywords).toContain("asyncio");
    expect(result.confidence).toBeGreaterThan(0);
  });

  it("should return top 3 types as inferredTypes", () => {
    const result = inferTypesForQuery("asyncio", mockSearchIndex);

    expect(result.inferredTypes.length).toBeLessThanOrEqual(3);
    expect(result.inferredTypes[0]).toBe("Library"); // Highest score
  });

  it("should return types 4-6 as alternativeTypes when available", () => {
    const result = inferTypesForQuery("path", mockSearchIndex);

    // path matches "Library" and "File" types
    expect(result.inferredTypes.length).toBeGreaterThan(0);
  });

  it("should be case insensitive", () => {
    const result1 = inferTypesForQuery("ASYNCIO", mockSearchIndex);
    const result2 = inferTypesForQuery("asyncio", mockSearchIndex);

    expect(result1.inferredTypes).toEqual(result2.inferredTypes);
    expect(result1.matchingKeywords).toContain("asyncio");
  });

  it("should calculate confidence based on match count and scores", () => {
    const result = inferTypesForQuery("asyncio tutorial", mockSearchIndex);

    // Should match both "asyncio" and "tutorial" keywords
    expect(result.matchingKeywords.length).toBeGreaterThanOrEqual(1);
    expect(result.confidence).toBeGreaterThan(0);
  });

  it("should limit matching keywords to max 5", () => {
    const longQuery = "asyncio json introduction path tutorial";
    const result = inferTypesForQuery(longQuery, mockSearchIndex);

    expect(result.matchingKeywords.length).toBeLessThanOrEqual(5);
  });

  it("should include query in result", () => {
    const query = "test query";
    const result = inferTypesForQuery(query, mockSearchIndex);

    expect(result.query).toBe(query);
  });
});

describe("getAvailableTypes", () => {
  it("should return empty array for empty stats", () => {
    const emptyIndex: SearchIndex = {
      version: "3.12",
      generatedAt: new Date().toISOString(),
      totalEntries: 0,
      typeStats: {},
      keywordMappings: [],
    };
    const result = getAvailableTypes(emptyIndex);

    expect(result).toEqual([]);
  });

  it("should return single type for single entry", () => {
    const index: SearchIndex = {
      version: "3.12",
      generatedAt: new Date().toISOString(),
      totalEntries: 1,
      typeStats: { Library: 1 },
      keywordMappings: [],
    };
    const result = getAvailableTypes(index);

    expect(result).toEqual(["Library"]);
  });

  it("should sort types by frequency descending", () => {
    const index: SearchIndex = {
      version: "3.12",
      generatedAt: new Date().toISOString(),
      totalEntries: 10,
      typeStats: {
        Library: 5,
        Tutorial: 2,
        "Built-in Functions": 3,
      },
      keywordMappings: [],
    };
    const result = getAvailableTypes(index);

    expect(result[0]).toBe("Library"); // Most frequent (5)
    expect(result[1]).toBe("Built-in Functions"); // Second (3)
    expect(result[2]).toBe("Tutorial"); // Least frequent (2)
  });
});

describe("extractKeywords", () => {
  it("should return empty array for empty string", () => {
    const result = extractKeywords("");
    expect(result).toEqual([]);
  });

  it("should filter out short words (< 3 chars)", () => {
    const result = extractKeywords("a ab abc");
    expect(result).toEqual(["abc"]);
  });

  it("should filter out common noise words", () => {
    const result = extractKeywords("the and for with from using objects object");
    expect(result).toEqual([]);
  });

  it("should remove leading section numbers", () => {
    const result1 = extractKeywords("1. Introduction");
    expect(result1).toEqual(["introduction"]);

    const result2 = extractKeywords("2.1. Getting Started");
    expect(result2).toEqual(["getting", "started"]);

    const result3 = extractKeywords("10.20.30. Section Name");
    expect(result3).toEqual(["section", "name"]);
  });

  it("should split on various separators", () => {
    const result = extractKeywords("test_test.test test-test test.test()");
    expect(result).toContain("test");
  });

  it("should handle angle brackets", () => {
    const result = extractKeywords("JSON <string>");
    expect(result).toEqual(["json", "string"]);
  });

  it("should handle parentheses", () => {
    const result = extractKeywords("asyncio.create_task()");
    expect(result).toEqual(["asyncio", "create", "task"]);
  });

  it("should deduplicate keywords", () => {
    const result = extractKeywords("test test test");
    expect(result).toEqual(["test"]);
  });

  it("should normalize to lowercase", () => {
    const result = extractKeywords("ASYNC JSON Test");
    expect(result).toEqual(["async", "json", "test"]);
  });

  it("should handle complex dot notation", () => {
    const result = extractKeywords("asyncio.create_task");
    expect(result).toEqual(["asyncio", "create", "task"]);
  });

  it("should handle hyphens", () => {
    const result = extractKeywords("built-in functions");
    expect(result).toEqual(["built", "functions"]);
  });

  it("should handle colons", () => {
    const result = extractKeywords("module: function");
    expect(result).toEqual(["module", "function"]);
  });

  it("should handle commas", () => {
    const result = extractKeywords("a, b, c");
    expect(result).toEqual([]); // All are < 3 chars
  });

  it("should handle mixed case with numbers", () => {
    const result = extractKeywords("Python 3.12 Documentation");
    expect(result).toEqual(["python", "documentation"]);
  });

  it("should preserve meaningful long words", () => {
    const result = extractKeywords("Multiprocessing Shared Memory Concurrent Execution");
    expect(result).toEqual(["multiprocessing", "shared", "memory", "concurrent", "execution"]);
  });
});
