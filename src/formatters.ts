import type { AnchorIndex, DocEntry } from "./types";

/**
 * Formats search results into a human-readable string.
 * @param results - Matched documentation entries.
 * @param query - The original search query.
 * @param version - Python version searched.
 * @returns Formatted string listing results or a no-results message.
 */
export function formatSearchResults(results: DocEntry[], query: string, version: string): string {
  if (!results.length) {
    return `No results found for "${query}" in Python ${version} docs.`;
  }

  return [
    `Found ${results.length} result(s) for "${query}" in Python ${version} docs.`,
    "",
    ...results.map((r) => `- ${r.name} [${r.type}] -> ${r.path}`),
    "",
    "Use fetch_python_doc with the path to get the full documentation.",
  ].join("\n");
}

/**
 * Formats a documentation page for display with pagination support.
 * Handles anchor navigation when specified, showing the relevant section
 * or listing available anchors if not found.
 * @param markdown - Full markdown content of the page.
 * @param path - Documentation path.
 * @param version - Python version.
 * @param fromCache - Whether content was served from cache.
 * @param offset - Character offset for pagination.
 * @param limit - Maximum characters to return.
 * @param anchorIndex - Index of anchors in the document.
 * @param anchor - Optional anchor to navigate to.
 * @returns Formatted document string with header and pagination hints.
 */
export function formatDocument(
  markdown: string,
  path: string,
  version: string,
  fromCache: boolean,
  offset: number,
  limit: number,
  anchorIndex: AnchorIndex,
  anchor?: string,
): string {
  const header = `# Python ${version}: ${path} ${fromCache ? "(cached)" : "(fetched)"}\n\n`;

  if (anchor) {
    const found = anchorIndex.anchors.find((a) => a.name === anchor);
    if (found) {
      return `${header}**Section:** ${anchor}\n\n${markdown.slice(found.startOffset, found.endOffset)}`;
    }

    const available = anchorIndex.anchors.map((a) => `  - ${a.name}: ${a.heading}`).join("\n");
    return (
      `${header}⚠️ **Anchor "${anchor}" not found.**\n\n` +
      `Available anchors:\n${available || "  (none)"}\n\n` +
      markdown.slice(offset, offset + limit)
    );
  }

  const end = Math.min(offset + limit, markdown.length);
  const content = markdown.slice(offset, end);

  if (end < anchorIndex.totalLength) {
    return `${header}${content}\n\n---\nMore content available. Use offset=${end} to continue reading.`;
  }

  return `${header}${content}`;
}
