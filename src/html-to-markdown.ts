import TurndownService from "turndown";
import { gfm } from "turndown-plugin-gfm";
import type { AnchorIndex } from "./types";

/** Result of converting HTML to Markdown. */
export interface HtmlToMarkdownResult {
  markdown: string;
  anchorIndex: AnchorIndex;
}

const turndown = new TurndownService({
  headingStyle: "atx",
  codeBlockStyle: "fenced",
  bulletListMarker: "-",
});

turndown.use(gfm);

turndown.addRule("pythonSig", {
  filter: (node) => node.nodeName === "DT" && node.classList?.contains("sig"),
  replacement: (content) => `\n**${content.trim()}**\n`,
});

turndown.remove(["script", "style", "nav", "footer", "header"]);

/**
 * Converts HTML documentation to Markdown format.
 * Strips comments and unwanted elements, normalizes whitespace,
 * and formats Python function signatures as bold text.
 * @param html - Raw HTML content from DevDocs.
 * @returns Markdown content and anchor index for navigation.
 */
export function htmlToMarkdown(html: string): HtmlToMarkdownResult {
  const cleanHtml = html.replace(/<!--[\s\S]*?-->/g, "");
  const markdown = turndown
    .turndown(cleanHtml)
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return {
    markdown,
    anchorIndex: {
      anchors: [],
      totalLength: markdown.length,
    },
  };
}
