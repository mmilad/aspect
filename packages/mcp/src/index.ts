import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createProjectplanerServer } from "./server";

async function main(): Promise<void> {
  const server = createProjectplanerServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Projectplaner MCP server running on stdio");
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
