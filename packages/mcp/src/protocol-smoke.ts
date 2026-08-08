/**
 * End-to-end MCP protocol smoke: spawn the stdio server, list tools, call
 * orient → search → get_entity → next_work, and confirm reason is required.
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { EXPECTED_MCP_TOOLS, assertExpectedToolNames } from "./tools";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

function parseToolText(result: { content?: Array<{ type: string; text?: string }> }): unknown {
  const text = result.content?.find((part) => part.type === "text")?.text;
  if (!text) {
    throw new Error("Missing text content in tool result.");
  }
  return JSON.parse(text) as unknown;
}

async function main(): Promise<void> {
  const transport = new StdioClientTransport({
    command: "pnpm",
    args: ["--filter", "@projectplaner/mcp", "start"],
    cwd: root,
    stderr: "pipe"
  });

  const client = new Client({ name: "projectplaner-mcp-protocol-smoke", version: "0.1.0" });
  await client.connect(transport);

  try {
    const listed = await client.listTools();
    const names = listed.tools.map((tool) => tool.name);
    assertExpectedToolNames(names);

    const orientTool = listed.tools.find((tool) => tool.name === "orient");
    if (!orientTool) {
      throw new Error("orient missing from listTools.");
    }
    if (orientTool.description && /ranked matches/i.test(orientTool.description)) {
      throw new Error("orient description still looks like old graph search.");
    }
    const orientSchema = orientTool.inputSchema as { properties?: Record<string, unknown>; required?: string[] };
    if (orientSchema.properties && Object.keys(orientSchema.properties).length > 0) {
      throw new Error(`orient should have no input properties; got ${Object.keys(orientSchema.properties).join(",")}`);
    }

    const createTool = listed.tools.find((tool) => tool.name === "create_entity");
    const createRequired = (createTool?.inputSchema as { required?: string[] } | undefined)?.required ?? [];
    if (!createRequired.includes("reason")) {
      throw new Error(`create_entity.required missing reason: ${createRequired.join(",")}`);
    }

    const getTool = listed.tools.find((tool) => tool.name === "get_entity");
    const getProps = (getTool?.inputSchema as { properties?: Record<string, unknown> } | undefined)?.properties ?? {};
    for (const key of ["includeBody", "includeMetadata"]) {
      if (!(key in getProps)) {
        throw new Error(`get_entity schema missing ${key}`);
      }
    }

    const briefing = parseToolText(await client.callTool({ name: "orient", arguments: {} })) as {
      next?: string;
    };
    if (!briefing.next?.includes("search")) {
      throw new Error("orient briefing did not point at search.");
    }

    const searched = parseToolText(
      await client.callTool({ name: "search", arguments: { q: "agent orientation", limit: 5 } })
    ) as { items?: Array<{ id: string }> };
    if (!searched.items?.length) {
      throw new Error("search returned no items.");
    }

    const entityId = searched.items[0]?.id;
    if (!entityId) {
      throw new Error("search item missing id.");
    }
    const entity = parseToolText(await client.callTool({ name: "get_entity", arguments: { id: entityId } })) as {
      id?: string;
    };
    if (entity.id !== entityId) {
      throw new Error("get_entity id mismatch.");
    }

    const work = parseToolText(await client.callTool({ name: "next_work", arguments: { limit: 5 } })) as {
      meta?: { mode?: string };
    };
    if (work.meta?.mode !== "work") {
      throw new Error("next_work meta.mode != work.");
    }

    const rejected = await client.callTool({
      name: "create_entity",
      arguments: {
        type: "task",
        title: "protocol smoke should fail",
        targetEntityId: "node_agent_orientation"
      }
    });
    const rejectedText = JSON.stringify(rejected);
    if (!/reason/i.test(rejectedText)) {
      throw new Error(`Expected create_entity without reason to fail mentioning reason; got ${rejectedText}`);
    }

    console.log(`ok protocol tools=${[...EXPECTED_MCP_TOOLS].sort().join(",")} entity=${entityId}`);
  } finally {
    await client.close();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
