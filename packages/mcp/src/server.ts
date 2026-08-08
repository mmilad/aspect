import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  createPlanEntity,
  createPlanRelation,
  errorResult,
  getPlanEntity,
  listPlanEntities,
  nextWork,
  orientBriefing,
  packetRead,
  packetWrite,
  searchPlanEntities,
  textResult,
  updatePlanEntity
} from "./plan";
import { assertExpectedToolNames } from "./tools";
import { USAGE_GUIDE } from "./usage";

export { EXPECTED_MCP_TOOLS, assertExpectedToolNames } from "./tools";

const entityTypeSchema = z.enum([
  "project",
  "aspect",
  "entry",
  "area",
  "surface",
  "feature",
  "flow",
  "decision",
  "question",
  "reference",
  "task_group",
  "task"
]);

const relationTypeSchema = z.enum([
  "contains",
  "leads_to",
  "depends_on",
  "blocks",
  "implements",
  "affects",
  "answers",
  "references",
  "conflicts_with",
  "validates",
  "investigates",
  "blocked_by",
  "related_to",
  "supports",
  "motivates"
]);

const statusSchema = z.enum([
  "not_implemented",
  "in_work",
  "implemented",
  "planned",
  "active",
  "blocked",
  "accepted",
  "answered",
  "archived",
  "todo",
  "doing",
  "review",
  "done"
]);

export function createProjectplanerServer(): McpServer {
  const server = new McpServer({
    name: "projectplaner",
    version: "0.2.0"
  });

  server.resource("usage", "projectplaner://usage", async (uri) => ({
    contents: [
      {
        uri: uri.href,
        mimeType: "text/markdown",
        text: USAGE_GUIDE
      }
    ]
  }));

  server.registerTool(
    "orient",
    {
      description:
        "One-time onboarding for a new agent session. Returns product rules and which tools to use next. Does not search the graph — call search or next_work after this. Serialize with other Projectplaner tools."
    },
    async () => {
      try {
        return textResult(orientBriefing());
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  server.registerTool(
    "search",
    {
      description:
        "Relevance search over the graph (titles, summaries; narrative fields when present). Use for finding context — not a raw filter. Excludes orientation packets by default.",
      inputSchema: {
        q: z.string().describe("Short relevance query"),
        type: entityTypeSchema.optional(),
        relatedTo: z.string().optional().describe("Only entities linked out to this id"),
        limit: z.number().int().min(1).max(50).optional()
      }
    },
    async (input) => {
      try {
        return textResult(await searchPlanEntities(input));
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  server.registerTool(
    "next_work",
    {
      description:
        "Pick eligible tasks (unblocked candidates) ranked by work score. Optional relatedTo Aspect/Feature id.",
      inputSchema: {
        relatedTo: z.string().optional().describe("Aspect or Feature id to scope tasks"),
        limit: z.number().int().min(1).max(50).optional()
      }
    },
    async (input) => {
      try {
        return textResult(await nextWork(input));
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  server.registerTool(
    "get_entity",
    {
      description:
        "Fetch one entity. Compact summary + narrative by default. Set includeBody/includeMetadata only when needed.",
      inputSchema: {
        id: z.string().describe("Entity id"),
        includeBody: z.boolean().optional().describe("Include truncated body text"),
        includeMetadata: z.boolean().optional().describe("Include full metadata JSON")
      }
    },
    async ({ id, includeBody, includeMetadata }) => {
      try {
        return textResult(await getPlanEntity(id, { includeBody, includeMetadata }));
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  server.registerTool(
    "list_entities",
    {
      description: "Filter/list entities (not ranked). For tasks supports unblocked + relatedTo sugar.",
      inputSchema: {
        type: entityTypeSchema.optional(),
        query: z.string().optional().describe("Optional text match filter"),
        relatedTo: z.string().optional(),
        unblocked: z.boolean().optional().describe("Tasks only: no unresolved blocked_by"),
        limit: z.number().int().min(1).max(100).optional()
      }
    },
    async (input) => {
      try {
        return textResult(await listPlanEntities(input));
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  server.registerTool(
    "create_entity",
    {
      description:
        "Create an entity. Requires reason (stored in metadata.narrative). Tasks require targetEntityId (Aspect or Feature).",
      inputSchema: {
        type: entityTypeSchema,
        title: z.string(),
        reason: z.string().describe("Why this entity exists — required durable narrative"),
        proposal: z.string().optional().describe("Suggested next move / stance"),
        intent: z.string().optional(),
        summary: z.string().optional(),
        body: z.string().optional(),
        status: statusSchema.optional(),
        key: z.string().optional(),
        slug: z.string().optional(),
        metadata: z.record(z.unknown()).optional(),
        targetEntityId: z.string().optional().describe("Aspect/Feature (or parent Aspect) to link"),
        linkType: relationTypeSchema.optional(),
        priority: z.enum(["low", "medium", "high", "critical"]).optional(),
        acceptanceCriteria: z.array(z.string()).optional()
      }
    },
    async (input) => {
      try {
        return textResult(await createPlanEntity(input));
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  server.registerTool(
    "update_entity",
    {
      description: "Update an entity. Requires reason (appended to metadata.narrative).",
      inputSchema: {
        id: z.string(),
        reason: z.string().describe("Why this change — required durable narrative"),
        proposal: z.string().optional(),
        intent: z.string().optional(),
        title: z.string().optional(),
        summary: z.string().optional(),
        body: z.string().optional(),
        status: statusSchema.optional(),
        key: z.string().optional(),
        slug: z.string().optional(),
        metadata: z.record(z.unknown()).optional()
      }
    },
    async (input) => {
      try {
        return textResult(await updatePlanEntity(input));
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  server.registerTool(
    "create_relation",
    {
      description: "Create a relation between two entities (depends_on, contains, implements, affects, ...).",
      inputSchema: {
        from: z.string().describe("Source entity id"),
        to: z.string().describe("Target entity id"),
        type: relationTypeSchema,
        label: z.string().optional(),
        primary: z.boolean().optional(),
        reason: z.string().optional().describe("Optional why this link exists"),
        metadata: z.record(z.unknown()).optional()
      }
    },
    async (input) => {
      try {
        return textResult(await createPlanRelation(input));
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  server.registerTool(
    "packet_read",
    {
      description:
        "Read orientation packets linked to an entity, plus that entity's narrative. Prefer narrative when packets are empty.",
      inputSchema: {
        entityId: z.string(),
        workflow: z.string().optional()
      }
    },
    async ({ entityId, workflow }) => {
      try {
        return textResult(await packetRead(entityId, workflow));
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  server.registerTool(
    "packet_write",
    {
      description:
        "Write Orientation Packet v1 (requires metadata.state + metadata.next) and stamp reason onto the target entity narrative.",
      inputSchema: {
        entityId: z.string(),
        reason: z.string().describe("Durable reason stamped onto the target entity"),
        proposal: z.string().optional(),
        metadata: z
          .record(z.unknown())
          .describe("Packet fields: must include state and next; optional confidence, workflow, ..."),
        id: z.string().optional().describe("Existing packet reference id to update"),
        title: z.string().optional(),
        summary: z.string().optional(),
        body: z.string().optional(),
        workflow: z.string().optional()
      }
    },
    async (input) => {
      try {
        return textResult(await packetWrite(input));
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  assertExpectedToolNames(listRegisteredToolNames(server));
  return server;
}

/** Inspect registered tool names (SDK private map; used by smoke/tests). */
export function listRegisteredToolNames(server: McpServer): string[] {
  const tools = (server as unknown as { _registeredTools: Record<string, unknown> })._registeredTools;
  return Object.keys(tools);
}

/** Registered tool defs for schema honesty checks in tests. */
export function listRegisteredToolDefs(server: McpServer): Record<
  string,
  { description?: string; inputSchema?: unknown }
> {
  return (server as unknown as { _registeredTools: Record<string, { description?: string; inputSchema?: unknown }> })
    ._registeredTools;
}
