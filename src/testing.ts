/**
 * Internal exports for testing purposes.
 * This file is NOT the plugin entry point and should NOT be imported by external consumers.
 * Only use these imports in test files.
 */

export { CacheManager, type CacheManagerInterface } from "./cache";
export {
  CACHE_ROOT,
  CONFIG,
  DEFAULT_VERSION,
  type PythonVersion,
  SUPPORTED_VERSIONS,
} from "./config";
export { createDocService, type DocService } from "./doc-service";
export { formatDocument, formatSearchResults } from "./formatters";
export { htmlToMarkdown } from "./html-to-markdown";
export { createLogger, type Logger } from "./logger";
export { createTools } from "./tools";
export type {
  Anchor,
  AnchorIndex,
  CachedDoc,
  DocEntry,
  DocIndex,
  FetchedDoc,
} from "./types";
