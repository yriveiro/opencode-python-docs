# opencode-python-docs

OpenCode plugin for Python documentation lookup via DevDocs.

## Quick Start

Add to `~/.config/opencode/opencode.json`:

```json
{ "plugin": ["opencode-python-docs"] }
```

## Features

- **Search** Python stdlib, language reference, tutorials, and more
- **Fetch** full documentation as clean Markdown
- **Cache** with intelligent TTL-based garbage collection
- **Multiple versions** supported: 3.14, 3.13, 3.12, 3.11, 3.10, 3.9

## Tools

### `python_docs`

Search Python documentation index.

| Argument | Type | Description |
| ---------- | ------ | ------------- |
| `query` | string | Search query (e.g., 'asyncio', 'pathlib') |
| `version` | string? | Python version (default: 3.14) |
| `type` | string? | Filter by doc type |
| `limit` | number? | Max results (default: 20) |

**Example:**

```text
python_docs query="asyncio" version="3.12"
```

### `fetch_python_doc`

Fetch full documentation as Markdown.

| Argument | Type | Description |
| ---------- | ------ | ------------- |
| `path` | string | Doc path from search results |
| `version` | string? | Python version (default: 3.14) |
| `anchor` | string? | Jump to specific section by anchor ID |
| `offset` | number? | Character offset for pagination (default: 0) |
| `limit` | number? | Max characters to return (default: 12000) |

**Example:**

```text
fetch_python_doc path="library/asyncio"
```

**Pagination example:**

```text
# First chunk
fetch_python_doc path="library/asyncio" offset=0 limit=5000

# Continue reading
fetch_python_doc path="library/asyncio" offset=5000 limit=5000
```

## Caching

- **Index cache**: 24 hours TTL
- **Doc cache**: 7 days TTL
- **Location**: `~/.cache/opencode/python-docs/`
- **Garbage collection**: Runs on startup and server reconnect

## Development

```bash
git clone https://github.com/yriveiro/opencode-python-docs
cd opencode-python-docs
bun install
bun run build
```

### Scripts

| Command | Description |
| --------- | ------------- |
| `bun run build` | Build the plugin |
| `bun run typecheck` | Run TypeScript type checking |
| `bun run test` | Run tests |
| `bun run format` | Format code with Biome |
| `bun run lint` | Run Biome linter |
| `bun run check` | Run all checks (lint + format) |

## License

MIT
