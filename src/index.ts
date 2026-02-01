import type { Plugin } from "@opencode-ai/plugin";
import { CacheManager } from "./cache";
import { CACHE_ROOT, CONFIG } from "./config";
import { createDocService } from "./doc-service";
import { createLogger } from "./logger";
import { createTools } from "./tools";

const PythonDocsPlugin: Plugin = async (ctx) => {
  const log = createLogger(ctx);
  const cache = CacheManager(CACHE_ROOT);
  const docService = createDocService(cache, log);

  cache.runGarbageCollection(CONFIG.indexTtlMs, CONFIG.docTtlMs);

  return {
    event: async ({ event }) => {
      if (event.type === "server.connected") {
        cache.runGarbageCollection(CONFIG.indexTtlMs, CONFIG.docTtlMs);
      }
    },
    tool: createTools(docService),
  };
};

export default PythonDocsPlugin;
