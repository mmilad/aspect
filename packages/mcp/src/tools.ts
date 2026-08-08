/** Canonical MCP tool surface — keep in sync with registerTool calls in server.ts */
export const EXPECTED_MCP_TOOLS = [
  "orient",
  "search",
  "next_work",
  "get_entity",
  "list_entities",
  "create_entity",
  "update_entity",
  "create_relation",
  "packet_read",
  "packet_write"
] as const;

export type ExpectedMcpTool = (typeof EXPECTED_MCP_TOOLS)[number];

export function assertExpectedToolNames(actual: string[]): void {
  const expected = [...EXPECTED_MCP_TOOLS].sort();
  const got = [...actual].sort();
  if (got.length !== expected.length || got.some((name, i) => name !== expected[i])) {
    throw new Error(
      `MCP tool list drift.\nexpected: ${expected.join(", ")}\nactual:   ${got.join(", ")}`
    );
  }
}
