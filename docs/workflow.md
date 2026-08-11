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
| `author_workflow` | Two LLM steps: text `outline` → `graphJson` (Workflow Step Graph v2) |

Prefer `run_workflow` over raw `create_entity` / `update_entity` when a matching mutation preset is seeded.

### Authoring (`author_workflow` + Generate)

- **Preset** `author_workflow`: Start → Outline as text → Compile to JSON → End. Bag writes `outline` (plain text) then `graphJson` (JSON string). Both are visible in Story / bag inspector when you run the flow.
- **UI Generate** (Describe): when `PROJECTPLANER_LLM_*` is set, uses the same two-turn path (`outline` then compile) and returns `{ graph, outline, graphJson, source: "llm_two_turn" }`. Without LLM, deterministic scaffold only.
- Typed LLM writes: `outputContracts` / `pending_llm.outputs` carry `BagShape`; resume validates `llmWrites` against those shapes.

## Bag ports vs bindings

Port **contracts** (types) are authored in presets/code. The UI only **binds** bag keys onto those ports.

| Layer | Fields | Who edits |
|-------|--------|-----------|
| Port contracts | `inputs` / `outputContracts` (port id → required + `BagShape`) | Presets / code — not the inspector |
| Bindings | `inputBindings` / `writeBindings` (port id → bag key) | Inspector (PropPicker / write section) |
| Derived legacy | `reads` / `writes` | Synced from binding values on parse/save |

- **Inputs (UI):** one row per declared input port; pick which upstream **bag key** feeds it.
- **Writes (UI):** bind declared **output ports** to bag keys (default bag key = port id). Writes register keys for downstream. `+` adds an unbound output; remove clears registration.
- **Compat:** omitted bindings ⇒ **identity** (port id = bag key). Old graphs keep running.
- **No separate “update bag” node** — write bindings are the bag write API.
- **Shapes** use `BagShape`, including `union` (e.g. `string\|null` via `nullable()`).
- **`required: false`** = key may be **absent**. **`null` inside a union** = key may be **present** with null.
- **Runtime (strict for work nodes):** validate each input port against its bound bag key; validate write-bound outputs after successful writes / LLM resume. Control nodes only when they declare `inputs`.
- **LLM:** `inputKeys` / `outputSchema` / `llmWrites` are **port ids**; the runner resolves to bag keys via bindings.
- **Nullability:** branch/gate only when upstream is `T\|null` and downstream input rejects null. If the consumer accepts `T\|null`, wire directly.
- Editor warnings (`warnShapeMismatches`) flag nullable→non-null mismatches (“add a null check or widen the input”).

After changing preset graphs in the repo, refresh the living SQLite seed:

```bash
pnpm plan presets-ensure --force
# or PROJECTPLANER_PRESETS_FORCE=1
```

## Runtime

- Steps: start → context / map / branch / write / llm / … → end.
- **Write** actions include `create_entity`, `update_entity`, `rollup_parent_status`.
- **LLM** nodes pause as `pending_llm`. Resume with `{ runId, llmWrites }` (Cursor, Codex, or `apps/agent`).
- Instructions may use bag templates (`{{title}}`, `{{@reads}}`, `{{@shapes}}`); the runner fills them before returning `pending_llm`.
- LLM nodes have optional `systemPrompt` (chat system) and `instructions` (chat user / task). Blank or missing `systemPrompt` uses `DEFAULT_WORKFLOW_LLM_SYSTEM_PROMPT` at run. Both fields are template-filled and returned on `pending_llm`.

## Dev reseeding

```bash
pnpm plan presets-ensure --force
# or PROJECTPLANER_PRESETS_FORCE=1
```

Terminal two-turn author demo (prints outline text, then graph JSON):

```bash
pnpm plan author-demo --brief "Search aspects, LLM picks one, end"
# optional: --title "..."  --outline-only  --json
```

Optional live LLM checks (Ollama etc.; not in default `pnpm test`):

```bash
pnpm test:llm
```

Code: `packages/core/src/workflow/`, `packages/db/src/workflow-runtime.ts`, `packages/db/src/presets.ts`.

## Diagram view (read-only)

In the flow editor toolbar, **Diagram** replaces the React Flow canvas with a Mermaid flowchart of the current graph (branch → diamond, start/end → stadium). Palette and inspector hide while open. Use **Copy source** to paste into docs. Converter: `renderWorkflowMermaid` in `@projectplaner/core`.
