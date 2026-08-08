# Decisions, questions, flows

## Decisions
- `node_decision_tree` **Use Aspect Graph Plus Tree** (accepted) — Nested aspects give ownership; relationships give navigation.
- `decision_080136fa-a37b-44a4-9208-7a811f4ef137` **Use graph entities and references for v1 agent workflows** (accepted) — Use existing generic graph entities for the first agent workflow contracts.
- `decision_5afa9010-cc8a-49cb-8fc2-b8f8fca04be2` **Keep SQLite now and investigate Dockerized Postgres with pgvector later** (accepted) — SQLite stays the v1 source of truth; Postgres plus pgvector is the later concurrency and semantic-search path.
- `decision_dad31235-5808-4167-b68e-ca13d8213f4c` **Make the full entity graph primary while keeping scoped graph views** (accepted) — Use the graph as the complete meaning map and keep aspect scopes as filters or modes.
- `decision_d349e500-a26c-42dd-b134-6ca021a99bda` **Use compact graph dots with sidebar detail** (accepted) — Graph nodes should be dots for overview; the sidebar and detail route carry readable information.
- `decision_9757249a-695b-4a0b-a834-58f0b0f5f2a0` **Build the local agent loop as its own monorepo app** (planned) — The local goal-loop agent should live in a separate workspace app instead of being hidden inside the web or db package.
- `decision_2c7a2ece-e1ea-4d3d-a7d5-e700f458f19d` **Use xyflow workflow mode with per-task context bags** (accepted) — Edit workflows with xyflow in a separate mode; store step graphs on flow metadata; keep context bags per Task.

## Questions
- `question_fbdf8a16-dfc8-40b2-a6c3-ec252755078a` **How should Aspects expose stable code anchors?** (planned) — Decide whether code orientation belongs as References, Aspect metadata, relations, an architecture subtree, or richer orient output.
- **DROP** `question_6596aab0-f158-48df-81e4-034dd3761619` **Smoke metadata-file question** (planned) — _no summary_

## Flows
- `flow_66716f0a-edb4-4163-8006-92a235eb4d66` **Agent Orientation Workflow** (planned) — Select the right graph target before implementation work.
- `flow_8c4a3877-536d-4c71-9d1c-ecc06b0f9226` **Task Consumption Handoff Workflow** (planned) — Consume compact task handoff context before broad repo reading.
- `flow_6c8a8ad8-7fd0-477a-acbe-ea6b30c8c22a` **Execution Result Workflow** (planned) — Leave compact implementation results for the next agent.
- `flow_ca0da308-0b9c-48aa-8e56-6f3968320aa1` **New Task** (planned) — Pick the next unblocked, non-canceled task by workScore and hand an agent prompt.
