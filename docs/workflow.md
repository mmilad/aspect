# Workflows

Executable step graphs live as **Flow** entities. Core owns schema + runner; db persists runs and seeds presets; web edits graphs; agents start/resume via MCP or HTTP.

Schema version **4**: pin-and-variable graphs (`graph.variables` present). Mutation packs still run as **legacy bag graphs** (no `variables` array) until a later convert.

## Presets (seeded)

| Key | Purpose |
|-----|---------|
| `create_*` / `update_*` / `delete_*` | Aspect/Feature/Task CRUD (`delete_*` = archive) |
| `rollup_parent_status` | Derive parent process status and recurse |
| `create_step` | Pin-variable proof graph: interpret instructions → create one node → QA |
| `create_workflow` | Plan a sequential spine (min 2, unique titles, no max), run create_step per item, assemble a chained fragment |
| `thinking` | Bounded decide/validate loop (may drainLlm in Run) |
| `goal_planning` | plan.v1 classify/expand/Thinking nest. **Do not drainLlm** — start pauses; poll `runId`. Optional `targetTaskId`: on halt, seal `bag.plan` onto a Reference (`metadata.kind: plan.v1`) the Task `references`. |
| `assistant_turn` | Session standing snapshot first, then last-N message window, then Turn A (`assistant_context_v1` pack with `topicChanged`) and Turn B (plain-text reply). Decision between A and B is later. May drainLlm. `/api/assistant/turn` drains this pack and merges `contextPack` + `reply` into the assistant session document. |

Prefer `run_workflow` over raw `create_entity` / `update_entity` when a matching mutation preset is seeded.

**Parked (not seeded):** `ensure_aspect`, `author_workflow`, `next_work`, `onboarding`. Graphs remain in-repo; `listWorkflowPresets()` used by `ensureWorkflowPresets` omits them.

### Authoring UI Generate

- **UI Generate** (Describe): when `PROJECTPLANER_LLM_*` is set, uses a two-turn path (`outline` then compile) and returns `{ graph, outline, graphJson, source: "llm_two_turn" }`. Without LLM, deterministic scaffold only.
- Typed LLM writes: `outputContracts` / `pending_llm.outputs` carry `BagShape`; resume validates `llmWrites` against those shapes.

## Variables and data pins

Authoring is **Start inputs, End outputs, named locals (Get/Set), and data wires**. Authors do not bind ambient bag keys. The runner keeps an internal pin/local frame.

`graph.variables` (v4):

| Role | Unreal analogue | Pins |
|------|-----------------|------|
| `input` | Function inputs | **Start** data outputs |
| `output` | Return values | **End** data inputs (wire in to return) |
| `local` | My Blueprint locals | **Get** (pure, data out) / **Set** (exec in/out + data in `value`) |

MCP/HTTP `bag` is the **input variable map** (same JSON field). No `goal` unless declared as an input.

Work/control **data pins** come from `inputs` / `outputContracts` (port contracts). Exec stays `in:{pin}` / `out:{pin}`; data uses `data:in:{port}` / `data:out:{port}`. Edges with `kind: "data"` are skipped on the exec walk. Get is not an exec target.

Shapes color data wires: string/pink, bool/red, number/green, object/blue, array/cyan, any/gray. The editor only allows same-type data wires (`any`/`unknown` to `any`/`unknown`, not string to `any`). Runtime assignability stays permissive.

**LLM:** templates and `pending_llm.reads` are **incoming pin ids**. `llmWrites` keys are **output pin ids**; resume stores them on that node’s output pins.

**Legacy bag graphs** (no `variables`): identity `inputBindings` / `writeBindings` still apply. Mutation presets stay on this path.

## Exec wires and reroutes

`next` / `route` / `error` edges are the **execution track** (what runs next). The editor draws them as one thick exec spline; branch True/False labels stay on pins. `depends_on` stays a dashed join edge.

Reroutes are **waypoints on the edge** (`waypoints: [{x,y}]` in flow coordinates) for **exec** wires. Double-click an exec wire to add a knob; drag to move; Delete/Backspace removes a selected knob.

**Data** wires use a real **reroute node** (Unreal-style knot). Double-click a data wire to insert one; drag from the knot to fan the same value out to more inputs. Deleting the knot splices the remaining wires. The runner treats reroutes as pass-through; Story/Mermaid may still show them as tiny nodes.

**Format** (toolbar) runs `layoutWorkflowGraph`: exec spine left-to-right, false/error loops below, data knots after their source. Clears exec waypoints. Save after if you want it persisted.

After changing preset graphs in the repo, refresh the living SQLite seed:

```bash
pnpm plan presets-ensure --force
# or PROJECTPLANER_PRESETS_FORCE=1
```

## Runtime

- Steps: start → work/control along **exec** edges → end. Data edges feed pins; they do not change the cursor.
- **Query** is one work node (`query.op`): get/list/search/next_work/neighborhood, in-bag filter, and writes. Data pins infer from the catalog when op or entity type changes; authors remap bag keys only.
- **Write** actions include `create_entity`, `update_entity`, `rollup_parent_status`.
- **assemble_fragment** is a deterministic work node: it stitches `create_step` drafts into a start→end graph (`workflowDraft`). Later steps that read an earlier write are wired to that writer, not back to start. It does not call an LLM.
- **create_workflow** planning is multi-step: `workflow_step_list_v1` requires at least two unique work-node instructions (no start/end, sequential spine only, no maximum). The list is this layer’s spine, not an unrolled nested runtime. `push` accumulates `stepDrafts` across the foreach loop. Duplicate titles fail at assemble.
- **LLM** nodes pause as `pending_llm`. Resume with `{ runId, llmWrites }` (Cursor, Codex, or `apps/agent`).
- **assistant_turn** is a user preset: `assistant_session` writes `prior*` standing fields first, `assistant_window` writes `recentTurns`, Turn A emits `contextPack` (`assistant_context_v1`, including `topicChanged` vs `priorCurrentTopic`), Turn B replies as text from the pack + message. A decision node can later sit between A and B. `/api/assistant/turn` drains the run and persists `contextPack` as the next standing picture plus the reply.
- Instructions may use pin templates (`{{stepInstructions}}`, `{{@reads}}`, `{{@shapes}}`); the runner fills them before returning `pending_llm`.
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

Live `create_workflow` (plan steps → create_step → assemble), using the same LLM env:

```bash
pnpm plan create-workflow-demo --brief "Halve currentValue, then triple that result."
# optional: --bag-shape '{"currentValue":"number"}' --allowed-types math --json
# save the JSON yourself (the demo does not persist a Flow):
#   pnpm plan create-workflow-demo --brief "..." --allowed-types math > draft.json
```

Progress and LLM turns go to stderr. Stdout is always JSON (`draft` on success, plus `stepDrafts` / `turns` / `message` on failure). Persistence is a later step.

Needs `PROJECTPLANER_LLM_BASE_URL` and `PROJECTPLANER_LLM_MODEL` (Ollama example is in `.env.example`).

Optional live LLM checks (Ollama etc.; not in default `pnpm test`):

```bash
pnpm test:llm
```

Code: `packages/core/src/workflow/`, `packages/db/src/workflow-runtime.ts`, `packages/db/src/presets.ts`.

## Diagram view (read-only)

In the flow editor toolbar, **Diagram** replaces the React Flow canvas with a Mermaid flowchart of the current graph (branch → diamond, start/end → stadium). Palette and inspector hide while open. Use **Copy source** to paste into docs. Converter: `renderWorkflowMermaid` in `@projectplaner/core`. Data edges are omitted from Mermaid.
