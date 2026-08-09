# Graph model

Aspects are meaning anchors. Features and Tasks attach to them. Decisions and questions sit beside process work and do **not** drive parent rollup.

## Entity kinds (common)

| Type | Role |
|------|------|
| **Aspect** | Theme / meaning anchor |
| **Feature** | Cohesive capability under aspects |
| **Task** | Executable work; must link to an Aspect or Feature |
| **Decision** | Resolved choice (`open` → `accepted` \| `rejected` → `archived`) |
| **Question** | Open question (`open` → `answered` → `archived`) |
| **Flow** | Workflow pack graph (seeded presets) |

## Relations

Directed. Do not duplicate reverse `contains` edges.

Common links:

- Feature/Task → Aspect/Feature via `implements` / `affects` / `supports` / `validates` / `investigates`
- Parent `contains` → child (outgoing on the parent)

**`relatedTo` in MCP/search** means entities with an **outgoing** link **to** that id — not “children of this parent.” Scope `next_work` to the leaf Aspect/Feature tasks actually implement/affect.

## Process status ladder

Aspect / Feature / Task:

`in_planning` → `planned` → `in_progress` → `done`  
plus terminal: `canceled`, `archived`

No first-class `blocked` / `review` column; use relations/tags for nuance.

## Parent status rollup

- Participants: Aspect / Feature / Task only.
- First-level process children per step, then recurse upward.
- Incomplete children ⇒ parent at least `in_progress`; never drop below `in_progress` once there; all participating children `done` ⇒ `done`.
- Triggers: process create or status change (repository), or preset `rollup_parent_status`.

See `packages/core/src/domain/status.ts` and `packages/db/src/rollup.ts`.
