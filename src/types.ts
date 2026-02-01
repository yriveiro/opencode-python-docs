/** A single documentation entry from the DevDocs index. */
export interface DocEntry {
  name: string;
  path: string;
  type: string;
}

/** The full documentation index for a Python version. */
export interface DocIndex {
  entries: DocEntry[];
}

/** An anchor point within a document, representing a heading with an ID. */
export interface Anchor {
  name: string;
  heading: string;
  level: number;
  startOffset: number;
  endOffset: number;
  parentAnchor: string | null;
}

/** Index of all anchors in a document with total content length. */
export interface AnchorIndex {
  anchors: Anchor[];
  totalLength: number;
}

/** Cached document data stored on disk. */
export interface CachedDoc {
  markdown: string;
  anchorIndex: AnchorIndex;
  fetchedAt: number;
}

/** Result of fetching a document, includes cache status and normalized path. */
export interface FetchedDoc extends CachedDoc {
  fromCache: boolean;
  path: string;
}

/** Log levels supported by the OpenCode plugin API. */
export type LogLevel = "debug" | "info" | "warn" | "error";
