import { homedir } from "node:os";
import { join } from "node:path";

/** Root directory for cached documentation files. */
export const CACHE_ROOT = join(homedir(), ".cache", "opencode", "python-docs");

/** Python versions available in DevDocs. */
export const SUPPORTED_VERSIONS = ["3.14", "3.13", "3.12", "3.11", "3.10", "3.9"] as const;

/** Union type of supported Python version strings. */
export type PythonVersion = (typeof SUPPORTED_VERSIONS)[number];

/** Default Python version used when not specified. */
export const DEFAULT_VERSION: PythonVersion = "3.14";

/** Plugin configuration constants. */
export const CONFIG = {
  baseUrl: "https://documents.devdocs.io",
  indexTtlMs: 24 * 60 * 60 * 1000,
  docTtlMs: 7 * 24 * 60 * 60 * 1000,
  fetchTimeoutMs: 30_000,
  maxWindow: 12_000,
  defaultLimit: 20,
} as const;
