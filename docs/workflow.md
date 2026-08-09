# Workflows

Executable step graphs live as **Flow** entities. Core owns schema + runner; db persists runs and seeds presets; web edits graphs; agents start/resume via MCP or HTTP.

## Presets (seeded)

Examples:

| Key | Purpose |
|-----|---------|
| `ensure_aspect` | Search then reuse-or-create Aspect (LLM pause) |
| `create_*` / `update_*` / `delete_*` | Aspect/Feature/Task CRUD (`delete_*` = archive) |
| `next_work` | Pick eligible task |
| `onboarding` | Session onboarding pack |
| `rollup_parent_status` | Derive parent process status and recurse |

Prefer `run_workflow` over raw `create_entity` / `update_entity` when a matching mutation preset is seeded.

## Runtime

- Steps: start → context / map / branch / write / llm / … → end.
- **Write** actions include `create_entity`, `update_entity`, `rollup_parent_status`.
- **LLM** nodes pause as `pending_llm`. Resume with `{ runId, llmWrites }` (Cursor, Codex, or `apps/agent`).
- Instructions may use bag templates (`{{title}}`, `{{@reads}}`, `{{@shapes}}`); the runner fills them before returning `pending_llm`.

## Dev reseeding

```bash
pnpm plan presets-ensure --force
# or PROJECTPLANER_PRESETS_FORCE=1
```

Code: `packages/core/src/workflow/`, `packages/db/src/workflow-runtime.ts`, `packages/db/src/presets.ts`.

## Diagram view (read-only)

In the flow editor toolbar, **Diagram** replaces the React Flow canvas with a Mermaid flowchart of the current graph (branch → diamond, start/end → stadium). Palette and inspector hide while open. Use **Copy source** to paste into docs. Converter: `renderWorkflowMermaid` in `@projectplaner/core`.
