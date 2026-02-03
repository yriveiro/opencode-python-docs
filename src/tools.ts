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
      description: `Search Python docs with automatic type inference. If no results match your query, the tool automatically infers the best documentation types and retries. Returns: path [type] -> document_path. To get full documentation content for a path, use fetch_python_doc - do NOT use WebFetch. Available types include: "Language Reference", "Basics", "Python/C API", "Built-in Functions", "Library", "Tutorial", etc. You do not need to specify a type - the tool handles type inference automatically.`,
      args: {
        query: tool.schema.string(),
        version: tool.schema.enum(SUPPORTED_VERSIONS).optional(),
        type: tool.schema.string().optional(),
        limit: tool.schema.number().optional(),
      },
      async execute(args) {
        const version = args.version ?? DEFAULT_VERSION;
        const index = await docService.getIndex(version);
        const searchIndex = await docService.getSearchIndex(version);

        // Use the enhanced search with fallback
        const { results, fallbackUsed, typeInference } = await docService.searchWithFallback(
          index,
          searchIndex,
          args.query,
          args.type,
          args.limit,
        );

        return formatSearchResults(results, args.query, version, fallbackUsed, typeInference);
      },
    }),

    fetch_python_doc: tool({
      description: `Fetch Python documentation content from DevDocs (mirrors official Python docs). Use this to retrieve full documentation for paths returned by python_docs. Do NOT use WebFetch - this tool provides the same content already converted to Markdown with proper formatting and anchor navigation support.`,
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

    suggest_python_doc_types: tool({
      description: `Preview which documentation types would be searched for a query. This is an optional debugging/exploration tool - python_docs already performs automatic type inference. Use this only if you want to see type inference details before searching, or if you want to understand why certain results were returned.`,
      args: {
        query: tool.schema.string(),
        version: tool.schema.enum(SUPPORTED_VERSIONS).optional(),
      },
      async execute(args) {
        const version = args.version ?? DEFAULT_VERSION;
        const searchIndex = await docService.getSearchIndex(version);
        const inference = docService.suggestTypes(searchIndex, args.query);

        const lines: string[] = [`Type suggestions for "${args.query}" in Python ${version}:`, ""];

        if (inference.inferredTypes.length > 0) {
          lines.push("Recommended types (highest confidence):");
          lines.push(
            ...inference.inferredTypes.map(
              (t) => `  - ${t} (confidence: ${Math.round(inference.confidence)}%)`,
            ),
          );
        }

        if (inference.alternativeTypes.length > 0) {
          lines.push("");
          lines.push("Alternative types:");
          lines.push(...inference.alternativeTypes.map((t) => `  - ${t}`));
        }

        if (inference.matchingKeywords.length > 0) {
          lines.push("");
          lines.push(`Matching keywords: ${inference.matchingKeywords.join(", ")}`);
        }

        if (inference.inferredTypes.length === 0) {
          lines.push("No type suggestions available for this query.");
          lines.push("Try searching without a type filter.");
        }

        lines.push("");
        lines.push("Example usage:");
        lines.push(
          `python_docs(query="${args.query}", type="${inference.inferredTypes[0] || "Language Reference"}")`,
        );

        return lines.join("\n");
      },
    }),
  };
}
