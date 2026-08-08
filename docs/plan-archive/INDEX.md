# Index — keep / drop / merge

## Pre-rebuild counts

| Type | Count |
|------|------:|
| aspect | 19 |
| decision | 7 |
| feature | 18 |
| flow | 4 |
| project | 1 |
| question | 2 |
| reference | 27 |
| task | 69 |
| **total entities** | **147** |
| relations | 195 |

## Target (seed) counts

| Type | Count |
|------|------:|
| aspect | 18 |
| decision | 7 |
| feature | 18 |
| flow | 4 |
| project | 1 |
| question | 1 |
| reference | 3 |
| task | 65 |
| **total entities** | **117** |
| relations | 168 |

## Drop

### Smoke leftovers
- `task_fcc49276-c710-496c-8f75-d798eae24d8f` (task PLAN-25) — Smoke verify add-task on generic aspect
- `aspect_c5f1b401-82d7-4d86-98e4-cb7ff8d66499` (aspect) — Should smoke test create-entity parenting
- `question_6596aab0-f158-48df-81e4-034dd3761619` (question) — Smoke metadata-file question
- `task_9d5639c1-3f2f-46d3-b3a7-9dff39dc4c4a` (task PLAN-67) — MCP smoke task
- `task_637809fe-24db-4680-8896-ac75b412e4eb` (task PLAN-68) — MCP smoke task
- `task_9be14eab-925e-4759-bc17-226be3369e5d` (task PLAN-69) — MCP smoke task

### Orientation / handoff packet references (24)
- `reference_8dbe9b6e-0b86-4e6a-97de-90805f4615cf` — Handoff for PLAN-30
- `reference_e475fcfe-0cc6-4aab-9065-0e00e7660654` — Handoff for PLAN-31
- `reference_8af7d1d5-fa5c-4997-bd17-cec22da81156` — Handoff for PLAN-32
- `reference_49d166ea-7e8f-43f7-8676-749180a053c9` — Handoff for PLAN-33
- `reference_88eb9b13-5850-4d25-943c-29193ab2aa3c` — Handoff for PLAN-34
- `reference_5deab902-ccf3-472a-afec-a875d7dab42d` — Orientation Packet for PLAN-32
- `reference_849740cc-b454-4155-9d0d-a3f1c44592b8` — Orientation Packet for PLAN-13
- `reference_6d80de17-6520-4523-8ff2-a616cfe21d92` — Orientation Packet for PLAN-14
- `reference_7fdb068f-0a8a-49da-88e7-df567ff3c4e4` — Orientation Packet for PLAN-17
- `reference_21c35554-607f-456a-bcf6-65d4fbf1ab6d` — Handoff for Postgres pgvector evaluation
- `reference_054f2b49-7313-4ebb-8384-640b8d8c474f` — Handoff for Full Entity Graph Navigation
- `reference_54fba6dd-1c2d-4e5d-98e3-9f600751af3e` — Handoff for PLAN-38
- `reference_240df9f7-a827-45c7-ae13-c52d2c9aeeb1` — Handoff for compact dot graph nodes
- `reference_87c065b5-361b-4734-8b59-c4854ca8566f` — Handoff for required task planning anchors
- `reference_d79b4438-25ef-4fca-9b9a-2085fde6dc89` — Handoff for visible full graph relations
- `reference_c953c6b4-2896-4a6a-9fe6-54edd64f62b4` — Handoff for spatial graph comparison view
- `reference_c8f9643e-678e-44df-9073-6229b25a38be` — Handoff for detail stylesheet regression
- `reference_034e7640-ab78-40a0-9e51-9565a839e00c` — Handoff for detail-to-graph return link
- `reference_2098e9ba-5d93-4406-96a7-7de6a305799b` — Handoff for FEAT-18
- `reference_a69ee5ec-43a9-4eef-b7a7-b23bebb45bc0` — Handoff for PLAN-64
- `reference_cd888888-e2f6-459f-8e05-2191746331cd` — Handoff for PLAN-65
- `reference_74403e27-2a1e-48e0-8e5e-f2db3d877820` — Orientation Packet for PLAN-67
- `reference_5e1b322f-9847-4c09-abd5-b8c7b9723222` — Orientation Packet for PLAN-68
- `reference_cf23a308-fff4-4ed7-963b-96697265e93f` — Orientation Packet for PLAN-69

## Keep (contract references)

- Orientation Packet v1
- Agent Playbook v1
- Workflow Step Graph v1

## Merge

- **Graph spine:** keep `feature_2e2be4dc-…` (Full Entity Graph Navigation) as primary.
- Fold `feature_graph_navigation` (Graph Navigation) via `related_to` toward the full-entity feature; keep aspect nodes `node_graph_view` / `node_tab_graph` as workspace meaning anchors.
- Aspect ↔ feature pairs otherwise retained; `Misc` kept as last-resort fallback.

## Narrative

Every kept entity gets `metadata.narrative.reason` (`updatedBy: rebuild`). Existing reasons preserved when present.
