# MCP

Local stdio MCP for Cursor (and similar hosts). Config: [`.cursor/mcp.json`](../.cursor/mcp.json). Server id: **`projectplaner`**.

## Tools

| Tool | Use |
|------|-----|
| `orient` | Once per session — rules, not a graph search |
| `search` | Relevance search; optional `relatedTo` / `type` |
| `next_work` | Eligible tasks by work score |
| `get_entity` | Compact entity + narrative |
| `list_entities` | Filtered list (not ranked) |
| `create_entity` / `update_entity` | Direct writes — blocked when matching CRUD preset is seeded |
| `create_relation` | Directed link |
| `run_workflow` | Start/resume by preset key or flow id |
| `packet_read` / `packet_write` | Handoff packets (`reason` required on write) |

Serialize Projectplaner tool calls (no parallel DB tools).

## Agent habits

1. `orient` once.
2. `search` or `next_work`.
3. `get_entity` (and `packet_read` when consuming a handoff) before broad code reading.
4. Writes always include `reason`. Prefer `run_workflow` for mutations.
5. End handoffs with `packet_write`.

Full session rules: [`../AGENTS.md`](../AGENTS.md). Implementation: `packages/mcp/src/server.ts`.

## Restart

Customize → MCPs → **projectplaner** → toggle off/on (or remove and re-add) after MCP/db code changes.
