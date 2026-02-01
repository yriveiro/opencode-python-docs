import { describe, expect, it } from "bun:test";

import {
  type AnchorIndex,
  type DocEntry,
  formatDocument,
  formatSearchResults,
} from "../src/testing";

describe("formatSearchResults", () => {
  it("should return no results message when empty", () => {
    const result = formatSearchResults([], "asyncio", "3.14");
    expect(result).toBe('No results found for "asyncio" in Python 3.14 docs.');
  });

  it("should format single result", () => {
    const results: DocEntry[] = [
      { name: "asyncio", path: "library/asyncio", type: "Asynchronous I/O" },
    ];
    const result = formatSearchResults(results, "asyncio", "3.14");

    expect(result).toContain('Found 1 result(s) for "asyncio"');
    expect(result).toContain("Python 3.14");
    expect(result).toContain("- asyncio [Asynchronous I/O] -> library/asyncio");
    expect(result).toContain("Use fetch_python_doc");
  });

  it("should format multiple results", () => {
    const results: DocEntry[] = [
      { name: "asyncio", path: "library/asyncio", type: "Asynchronous I/O" },
      {
        name: "asyncio.run",
        path: "library/asyncio#asyncio.run",
        type: "Asynchronous I/O",
      },
      {
        name: "asyncio.Task",
        path: "library/asyncio-task",
        type: "Asynchronous I/O",
      },
    ];
    const result = formatSearchResults(results, "asyncio", "3.12");

    expect(result).toContain('Found 3 result(s) for "asyncio"');
    expect(result).toContain("Python 3.12");
    expect(result).toContain("- asyncio [Asynchronous I/O] -> library/asyncio");
    expect(result).toContain("- asyncio.run [Asynchronous I/O] -> library/asyncio#asyncio.run");
  });

  it("should handle different versions", () => {
    const results: DocEntry[] = [
      {
        name: "pathlib",
        path: "library/pathlib",
        type: "File & Directory Access",
      },
    ];

    expect(formatSearchResults(results, "pathlib", "3.9")).toContain("Python 3.9");
    expect(formatSearchResults(results, "pathlib", "3.14")).toContain("Python 3.14");
  });
});

describe("formatDocument", () => {
  const emptyAnchorIndex: AnchorIndex = {
    anchors: [],
    totalLength: 0,
  };

  it("should include header with version and path", () => {
    const result = formatDocument(
      "# Test Content",
      "library/asyncio",
      "3.14",
      false,
      0,
      10000,
      emptyAnchorIndex,
    );

    expect(result).toContain("# Python 3.14: library/asyncio");
  });

  it("should show (fetched) for fresh content", () => {
    const result = formatDocument(
      "content",
      "library/asyncio",
      "3.14",
      false,
      0,
      10000,
      emptyAnchorIndex,
    );

    expect(result).toContain("(fetched)");
    expect(result).not.toContain("(cached)");
  });

  it("should show (cached) for cached content", () => {
    const result = formatDocument(
      "content",
      "library/asyncio",
      "3.14",
      true,
      0,
      10000,
      emptyAnchorIndex,
    );

    expect(result).toContain("(cached)");
    expect(result).not.toContain("(fetched)");
  });

  it("should include full content when under max length", () => {
    const content = "This is the full documentation content.";
    const anchorIndex: AnchorIndex = {
      anchors: [],
      totalLength: content.length,
    };
    const result = formatDocument(content, "library/test", "3.14", true, 0, 10000, anchorIndex);

    expect(result).toContain(content);
    expect(result).not.toContain("More content available");
  });

  it("should show pagination hint when content exceeds limit", () => {
    const content = "A".repeat(1000);
    const anchorIndex: AnchorIndex = {
      anchors: [],
      totalLength: content.length,
    };
    const result = formatDocument(content, "library/test", "3.14", true, 0, 100, anchorIndex);

    expect(result.length).toBeLessThan(content.length + 200);
    expect(result).toContain("More content available");
  });

  it("should include exactly limit characters of content", () => {
    const content = "ABCDEFGHIJ"; // 10 chars
    const anchorIndex: AnchorIndex = {
      anchors: [],
      totalLength: content.length,
    };
    const result = formatDocument(content, "library/test", "3.14", true, 0, 5, anchorIndex);

    expect(result).toContain("ABCDE");
    expect(result).not.toContain("FGHIJ");
  });

  it("should handle offset parameter", () => {
    const content = "ABCDEFGHIJ"; // 10 chars
    const anchorIndex: AnchorIndex = {
      anchors: [],
      totalLength: content.length,
    };
    const result = formatDocument(content, "library/test", "3.14", true, 5, 100, anchorIndex);

    expect(result).toContain("FGHIJ");
    expect(result).not.toContain("ABCDE");
  });

  it("should handle different Python versions", () => {
    const content = "test";
    expect(formatDocument(content, "lib/test", "3.9", true, 0, 100, emptyAnchorIndex)).toContain(
      "Python 3.9",
    );
    expect(formatDocument(content, "lib/test", "3.12", true, 0, 100, emptyAnchorIndex)).toContain(
      "Python 3.12",
    );
    expect(formatDocument(content, "lib/test", "3.14", true, 0, 100, emptyAnchorIndex)).toContain(
      "Python 3.14",
    );
  });

  it("should navigate to anchor when provided", () => {
    const content = `# Title

## Section 1

Content 1

## Section 2

Content 2`;

    const anchorIndex: AnchorIndex = {
      anchors: [
        {
          name: "section1",
          heading: "Section 1",
          level: 2,
          startOffset: 17,
          endOffset: 46,
          parentAnchor: null,
        },
        {
          name: "section2",
          heading: "Section 2",
          level: 2,
          startOffset: 46,
          endOffset: 76,
          parentAnchor: null,
        },
      ],
      totalLength: content.length,
    };

    const result = formatDocument(
      content,
      "library/test",
      "3.14",
      true,
      0,
      100,
      anchorIndex,
      "section1",
    );

    expect(result).toContain("**Section:** section1");
    expect(result).toContain("Content 1");
  });

  it("should show available anchors when requested anchor not found", () => {
    const content = "Some content here";
    const anchorIndex: AnchorIndex = {
      anchors: [
        {
          name: "anchor1",
          heading: "Anchor 1",
          level: 2,
          startOffset: 0,
          endOffset: 10,
          parentAnchor: null,
        },
        {
          name: "anchor2",
          heading: "Anchor 2",
          level: 2,
          startOffset: 10,
          endOffset: 20,
          parentAnchor: null,
        },
      ],
      totalLength: content.length,
    };

    const result = formatDocument(
      content,
      "library/test",
      "3.14",
      true,
      0,
      100,
      anchorIndex,
      "nonexistent",
    );

    expect(result).toContain('⚠️ **Anchor "nonexistent" not found.**');
    expect(result).toContain("Available anchors");
    expect(result).toContain("anchor1");
    expect(result).toContain("anchor2");
  });
});
