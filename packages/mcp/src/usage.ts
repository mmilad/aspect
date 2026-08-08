export const USAGE_GUIDE = `# Projectplaner MCP usage

Local graph-first planning store. Aspects are meaning anchors; features and tasks attach to them.

## First moves
1. Call \`orient\` once per session (onboarding only — not a search).
2. Call \`search\` for relevant context, or \`next_work\` to pick an eligible task.
3. \`get_entity\` (compact + narrative) before broad code reading.
4. On writes, always pass \`reason\`. Optionally \`proposal\` / \`intent\`. End with \`packet_write\` when handing off execution.

## Hard constraints
- Serialize all Projectplaner tool calls (no parallel DB tools).
- Every task must link to an Aspect or Feature (\`targetEntityId\`).
- Prefer the smallest truthful Aspect/Feature; create only when nothing fits.
- \`reason\` is required on create_entity, update_entity, and packet_write.
- Compact reads by default; only set includeBody / includeMetadata when needed.

## Tool map
- orient: session briefing / rules (no graph query)
- search: relevance ranking (includes narrative.reason)
- next_work: unblocked task candidates by work score
- get_entity / list_entities: inspect / filter
- create_entity / update_entity: writes with enforced narrative
- create_relation: link entities
- packet_read / packet_write: execution handoffs (+ narrative stamp on target)
`;
