import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";

import { CacheManager, type CacheManagerInterface } from "../src/testing";

describe("CacheManager", () => {
  let testCacheDir: string;
  let cache: CacheManagerInterface;

  beforeEach(() => {
    testCacheDir = `${tmpdir()}/python-docs-test-${Date.now()}`;
    cache = CacheManager(testCacheDir);
  });

  afterEach(() => {
    if (existsSync(testCacheDir)) {
      rmSync(testCacheDir, { recursive: true, force: true });
    }
  });

  describe("getIndexPath", () => {
    it("should return a path for the version", () => {
      const path = cache.getIndexPath("3.12");
      expect(path).toContain("python-3.12");
      expect(path).toEndWith(".json");
    });

    it("should handle different versions", () => {
      expect(cache.getIndexPath("3.14")).toContain("python-3.14");
      expect(cache.getIndexPath("3.9")).toContain("python-3.9");
    });
  });

  describe("getDocPath", () => {
    it("should return a path for the doc", () => {
      const path = cache.getDocPath("3.12", "library/asyncio");
      expect(path).toContain("docs");
      expect(path).toContain("3.12");
      expect(path).toEndWith(".json");
    });

    it("should return same path for same input", () => {
      const path1 = cache.getDocPath("3.12", "library/asyncio");
      const path2 = cache.getDocPath("3.12", "library/asyncio");
      expect(path1).toBe(path2);
    });

    it("should return different paths for different docs", () => {
      const path1 = cache.getDocPath("3.12", "library/asyncio");
      const path2 = cache.getDocPath("3.12", "library/pathlib");
      expect(path1).not.toBe(path2);
    });
  });

  describe("isValid", () => {
    it("should return false for non-existent file", () => {
      expect(cache.isValid("/nonexistent/path", 1000)).toBe(false);
    });
  });

  describe("read", () => {
    it("should return null for non-existent file", () => {
      expect(cache.read("/nonexistent/path")).toBeNull();
    });

    it("should read written data", () => {
      const testData = { key: "value", count: 42 };
      const testPath = cache.getDocPath("3.12", "test");
      cache.write(testPath, testData);
      const result = cache.read<typeof testData>(testPath);
      expect(result).toEqual(testData);
    });
  });

  describe("write", () => {
    it("should write data to file", () => {
      const testData = { key: "value" };
      const testPath = cache.getDocPath("3.12", "test-write");
      cache.write(testPath, testData);
      expect(existsSync(testPath)).toBe(true);
    });
  });

  describe("runGarbageCollection", () => {
    it("should return zero stats for empty cache", () => {
      const stats = cache.runGarbageCollection(1000, 1000);
      expect(stats.scanned).toBe(0);
      expect(stats.deleted).toBe(0);
      expect(stats.errors).toBe(0);
    });
  });
});
