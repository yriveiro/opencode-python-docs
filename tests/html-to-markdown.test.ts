import { describe, expect, it } from "bun:test";

import { htmlToMarkdown } from "../src/testing";

describe("htmlToMarkdown", () => {
  describe("basic HTML conversion", () => {
    it("should convert headings", () => {
      const html = "<h1>Title</h1><h2>Subtitle</h2>";
      const { markdown } = htmlToMarkdown(html);

      expect(markdown).toContain("# Title");
      expect(markdown).toContain("## Subtitle");
    });

    it("should convert paragraphs", () => {
      const html = "<p>First paragraph.</p><p>Second paragraph.</p>";
      const { markdown } = htmlToMarkdown(html);

      expect(markdown).toContain("First paragraph.");
      expect(markdown).toContain("Second paragraph.");
    });

    it("should convert links", () => {
      const html = '<a href="https://example.com">Example</a>';
      const { markdown } = htmlToMarkdown(html);

      expect(markdown).toContain("[Example](https://example.com)");
    });

    it("should convert bold and italic", () => {
      const html = "<strong>bold</strong> and <em>italic</em>";
      const { markdown } = htmlToMarkdown(html);

      expect(markdown).toContain("**bold**");
      expect(markdown).toContain("_italic_");
    });

    it("should convert unordered lists", () => {
      const html = "<ul><li>Item 1</li><li>Item 2</li></ul>";
      const { markdown } = htmlToMarkdown(html);

      // Turndown adds extra spaces for list items
      expect(markdown).toContain("Item 1");
      expect(markdown).toContain("Item 2");
      expect(markdown).toContain("-");
    });

    it("should convert ordered lists", () => {
      const html = "<ol><li>First</li><li>Second</li></ol>";
      const { markdown } = htmlToMarkdown(html);

      expect(markdown).toContain("1.");
      expect(markdown).toContain("First");
    });

    it("should convert code blocks", () => {
      const html = "<pre><code>def hello():\n    print('Hello')</code></pre>";
      const { markdown } = htmlToMarkdown(html);

      expect(markdown).toContain("```");
      expect(markdown).toContain("def hello():");
    });

    it("should convert inline code", () => {
      const html = "Use the <code>asyncio</code> module.";
      const { markdown } = htmlToMarkdown(html);

      expect(markdown).toContain("`asyncio`");
    });
  });

  describe("HTML stripping", () => {
    it("should strip script tags", () => {
      const html = "<p>Content</p><script>alert('xss')</script>";
      const { markdown } = htmlToMarkdown(html);

      expect(markdown).toContain("Content");
      expect(markdown).not.toContain("script");
      expect(markdown).not.toContain("alert");
    });

    it("should strip style tags", () => {
      const html = "<p>Content</p><style>.red { color: red; }</style>";
      const { markdown } = htmlToMarkdown(html);

      expect(markdown).toContain("Content");
      expect(markdown).not.toContain("style");
      expect(markdown).not.toContain("color");
    });

    it("should strip nav tags", () => {
      const html = "<nav>Navigation</nav><p>Content</p>";
      const { markdown } = htmlToMarkdown(html);

      expect(markdown).toContain("Content");
      expect(markdown).not.toContain("Navigation");
    });

    it("should strip footer tags", () => {
      const html = "<p>Content</p><footer>Footer info</footer>";
      const { markdown } = htmlToMarkdown(html);

      expect(markdown).toContain("Content");
      expect(markdown).not.toContain("Footer info");
    });

    it("should strip header tags", () => {
      const html = "<header>Header</header><p>Content</p>";
      const { markdown } = htmlToMarkdown(html);

      expect(markdown).toContain("Content");
      expect(markdown).not.toContain("Header");
    });

    it("should strip HTML comments", () => {
      const html = "<p>Content</p><!-- This is a comment -->";
      const { markdown } = htmlToMarkdown(html);

      expect(markdown).toContain("Content");
      expect(markdown).not.toContain("comment");
    });
  });

  describe("whitespace normalization", () => {
    it("should collapse multiple newlines", () => {
      const html = "<p>First</p>\n\n\n\n<p>Second</p>";
      const { markdown } = htmlToMarkdown(html);

      // Should not have more than 2 consecutive newlines
      expect(markdown).not.toMatch(/\n{3,}/);
    });

    it("should trim leading and trailing whitespace", () => {
      const html = "   <p>Content</p>   ";
      const { markdown } = htmlToMarkdown(html);

      expect(markdown).not.toMatch(/^\s/);
      expect(markdown).not.toMatch(/\s$/);
    });
  });

  describe("GFM features", () => {
    it("should convert tables", () => {
      const html = `
        <table>
          <thead>
            <tr><th>Name</th><th>Type</th></tr>
          </thead>
          <tbody>
            <tr><td>asyncio</td><td>module</td></tr>
          </tbody>
        </table>
      `;
      const { markdown } = htmlToMarkdown(html);

      expect(markdown).toContain("Name");
      expect(markdown).toContain("Type");
      expect(markdown).toContain("|");
    });

    it("should convert strikethrough", () => {
      const html = "<del>deprecated</del>";
      const { markdown } = htmlToMarkdown(html);

      // GFM uses ~ for strikethrough (single or double)
      expect(markdown).toContain("~deprecated~");
    });
  });

  describe("Python signature handling", () => {
    it("should format Python signatures with bold", () => {
      const html = '<dt class="sig">asyncio.run(coro)</dt>';
      const { markdown } = htmlToMarkdown(html);

      expect(markdown).toContain("**asyncio.run(coro)**");
    });
  });

  describe("anchor index generation", () => {
    it("should generate empty anchor index (anchor tracking removed)", () => {
      const html = "<p>Simple paragraph.</p>";
      const { anchorIndex } = htmlToMarkdown(html);

      // Anchor tracking has been removed for simplicity
      expect(anchorIndex.anchors).toHaveLength(0);
      expect(anchorIndex.totalLength).toBeGreaterThan(0);
    });

    it("should return correct totalLength", () => {
      const html = "<p>Test content.</p>";
      const { markdown, anchorIndex } = htmlToMarkdown(html);

      expect(anchorIndex.totalLength).toBe(markdown.length);
    });
  });
});
