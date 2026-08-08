# Rebuild notes

Date: 2026-08-08

## What we did

1. Frozen living graph → `full-plan.json` (+ `.local/*.db` backups).
2. Curated `seed-plan.json` via `build-seed.mts` (keep/drop/merge + narrative backfill).
3. Replaced living PLAN entities/relations with `pnpm plan import --from ../../docs/plan-archive/seed-plan.json`.

## Counts

| | Before | After |
|--|-------:|------:|
| Entities | 147 | 117 |
| Relations | 195 | 168 |
| References | 27 | 3 (contracts only) |
| Tasks | 69 | 65 |
| Aspects | 19 | 18 |

## Dropped

- 6 smoke leftovers (3× MCP smoke task, parenting smoke aspect, smoke question, PLAN-25 verify leftover)
- 24 orientation/handoff packet references
- PLAN-29 route smoke tests **kept** (real product test work)

## Merged / retargeted

- **Graph spine:** `Full Entity Graph Navigation` (FEAT-13) primary; `Graph Navigation` (FEAT-1) marked implemented and linked `related_to` the full-entity feature
- Scoped graph aspects (`node_graph_view`, `node_tab_graph`) linked `affects` from FEAT-13
- Stable IDs retained for survivors

## Narrative

- Every kept entity has `metadata.narrative.reason` with `updatedBy: "rebuild"`
- Existing reasons preserved when present; otherwise invented from title/summary/status
- Open tasks/features get a short `proposal` where useful
- Stripped `metadata.legacy` (dual-write breadcrumb); canonical type is `entity.type`

## Verification

- MCP `search "agent orientation"` returns compact entities with `narrative.reason`
- MCP `get_entity node_agent_orientation` shows rebuild narrative
- `list_entities` query `MCP smoke` → empty
- `pnpm --filter @projectplaner/mcp test` and `smoke:protocol` pass

## Restore

```bash
# From curated seed
pnpm plan import --from ../../docs/plan-archive/seed-plan.json

# From pre-rebuild dump (re-run build-seed if you need a fresh seed)
pnpm plan import --from ../../docs/plan-archive/full-plan.json
```

Binary backups (gitignored): `docs/plan-archive/.local/projectplaner.pre-rebuild.db`, `projectplaner.pre-import.db`.
