import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createProjectplanerServer } from "./server";
import { getDatabaseController } from "@projectplaner/db";

async function main(): Promise<void> {
  const server = createProjectplanerServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  server.server.onclose = () => {
    void getDatabaseController().shutdown().catch(error => console.error("Database shutdown failed", error));
  };
  for (const signal of ["SIGINT", "SIGTERM"] as const) {
    process.once(signal, () => {
      void server.close().finally(() => getDatabaseController().shutdown()).catch(error => {
        console.error(error); process.exitCode = 1;
      });
    });
  }
  console.error("Projectplaner MCP server running on stdio");
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
