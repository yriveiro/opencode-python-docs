import { describe, expect, it, mock } from "bun:test";
import type { CachedDoc, CacheManagerInterface, Logger } from "../src/testing";
import { createDocService } from "../src/testing";

describe("DocService", () => {
  const mockCache: CacheManagerInterface = {
    getIndexPath: mock(() => "/mock/index.json"),
    getDocPath: mock(() => "/mock/doc.json"),
    isValid: mock(),
    read: mock(),
    write: mock(),
    runGarbageCollection: mock(() => ({ scanned: 0, deleted: 0, errors: 0 })),
  };

  const mockLogger: Logger = {
    info: mock(),
    error: mock(),
  };

  const docService = createDocService(mockCache, mockLogger);

  describe("getIndex", () => {
    it("should return cached index if valid", async () => {
      const cachedIndex = { entries: [] };
      mockCache.isValid.mockReturnValue(true);
      mockCache.read.mockReturnValue(cachedIndex);

      const result = await docService.getIndex("3.12");

      expect(result).toEqual(cachedIndex);
      expect(mockCache.isValid).toHaveBeenCalledWith("/mock/index.json", expect.any(Number));
      expect(mockCache.read).toHaveBeenCalledWith("/mock/index.json");
    });

    it("should fetch and cache index if invalid", async () => {
      const fetchedIndex = { entries: [{ name: "test", path: "test.html", type: "module" }] };
      mockCache.isValid.mockReturnValue(false);
      global.fetch = mock(() =>
        Promise.resolve({
          ok: true,
          text: () => Promise.resolve(JSON.stringify(fetchedIndex)),
        } as Response),
      );

      const result = await docService.getIndex("3.12");

      expect(result).toEqual(fetchedIndex);
      expect(mockCache.write).toHaveBeenCalledWith("/mock/index.json", fetchedIndex);
    });
  });

  describe("getDoc", () => {
    it("should return cached doc if valid and has anchorIndex", async () => {
      const cachedDoc: CachedDoc = {
        markdown: "# test",
        anchorIndex: [],
        fetchedAt: Date.now(),
      };
      mockCache.isValid.mockReturnValue(true);
      mockCache.read.mockReturnValue(cachedDoc);

      const result = await docService.getDoc("3.12", "test");

      expect(result).toEqual({ ...cachedDoc, fromCache: true, path: "test" });
      expect(mockCache.isValid).toHaveBeenCalledWith("/mock/doc.json", expect.any(Number));
      expect(mockCache.read).toHaveBeenCalledWith("/mock/doc.json");
    });

    it("should refetch if cache is invalid", async () => {
      mockCache.isValid.mockReturnValue(false);
      global.fetch = mock(() =>
        Promise.resolve({
          ok: true,
          text: () => Promise.resolve("<html><body>test</body></html>"),
        } as Response),
      );

      const result = await docService.getDoc("3.12", "test");

      expect(result.fromCache).toBe(false);
      expect(result.path).toBe("test");
      expect(result.markdown).toBeDefined();
      expect(result.anchorIndex).toBeDefined();
      expect(mockCache.write).toHaveBeenCalled();
    });

    it("should refetch if cached doc lacks anchorIndex", async () => {
      const cachedDocWithoutAnchorIndex = {
        markdown: "# test",
        fetchedAt: Date.now(),
        // no anchorIndex
      };
      mockCache.isValid.mockReturnValue(true);
      mockCache.read.mockReturnValue(cachedDocWithoutAnchorIndex);
      global.fetch = mock(() =>
        Promise.resolve({
          ok: true,
          text: () => Promise.resolve("<html><body>test</body></html>"),
        } as Response),
      );

      const result = await docService.getDoc("3.12", "test");

      expect(result.fromCache).toBe(false);
      expect(result.path).toBe("test");
      expect(result.markdown).toBeDefined();
      expect(result.anchorIndex).toBeDefined();
      expect(mockCache.write).toHaveBeenCalled();
    });
  });
});
