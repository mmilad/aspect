export const USAGE_GUIDE = `# Projectplaner MCP usage

Projectplaner is a local graph-first planning store. Use these tools to navigate and update the Aspect Graph. Product/workflow rules are injected separately during task execution (orientation packets / playbook), not here.

## First moves
1. Call \`orient\` with a short query for the work area.
2. Call \`get_entity\` on the best Aspect or Feature match.
3. For an assigned task, call \`packet_read\` before broad code search.
4. Keep writes small: create/update linked entities, then \`packet_write\` a compact handoff.

## Hard usage constraints
- Serialize tool calls that read or write the plan DB. Do not parallelize orient, get/list/create/update, relation, or packet tools.
- Every task must link to an existing Aspect or Feature (\`targetEntityId\` + link type).
- Prefer the smallest truthful Aspect/Feature anchor. Create one only when nothing fits.
- Orientation packets are compact JSON handoffs, not chat transcripts.

## Tool map
- orient: ranked neighborhood for a query
- get_entity / list_entities: inspect graph objects
- create_entity / update_entity: add or change Aspects, Features, Tasks, References, etc.
- create_relation: link entities (\`depends_on\`, \`contains\`, \`implements\`, \`affects\`, ...)
- packet_read / packet_write: consume and leave Orientation Packet v1 handoffs
`;
