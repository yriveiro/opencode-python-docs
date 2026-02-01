import { tool } from "@opencode-ai/plugin";
import { CONFIG, DEFAULT_VERSION, SUPPORTED_VERSIONS } from "./config";
import type { DocService } from "./doc-service";
import { formatDocument, formatSearchResults } from "./formatters";

/**
 * Creates the OpenCode tools for Python documentation access.
 * @param docService - Service for fetching and searching documentation.
 * @returns Object containing python_docs and fetch_python_doc tools.
 */
export function createTools(docService: DocService) {
  return {
    python_docs: tool({
      description: "Search Python docs (DevDocs).",
      args: {
        query: tool.schema.string(),
        version: tool.schema.enum(SUPPORTED_VERSIONS).optional(),
        type: tool.schema.string().optional(),
        limit: tool.schema.number().optional(),
      },
      async execute(args) {
        const version = args.version ?? DEFAULT_VERSION;
        const index = await docService.getIndex(version);
        const results = docService.search(index, args.query, args.type, args.limit);
        return formatSearchResults(results, args.query, version);
      },
    }),

    fetch_python_doc: tool({
      description: "Get Python doc page content as Markdown.",
      args: {
        path: tool.schema.string(),
        version: tool.schema.enum(SUPPORTED_VERSIONS).optional(),
        anchor: tool.schema.string().optional(),
        offset: tool.schema.number().optional(),
        limit: tool.schema.number().optional(),
      },
      async execute(args) {
        const version = args.version ?? DEFAULT_VERSION;
        const offset = args.offset ?? 0;
        const limit = args.limit ?? CONFIG.maxWindow;
        const doc = await docService.getDoc(version, args.path);
        return formatDocument(
          doc.markdown,
          doc.path,
          version,
          doc.fromCache,
          offset,
          limit,
          doc.anchorIndex,
          args.anchor,
        );
      },
    }),
  };
}
