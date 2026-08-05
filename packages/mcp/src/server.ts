import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  createPlanEntity,
  createPlanRelation,
  errorResult,
  getPlanEntity,
  listPlanEntities,
  orient,
  packetRead,
  packetWrite,
  textResult,
  updatePlanEntity
} from "./plan";
import { USAGE_GUIDE } from "./usage";

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
    version: "0.1.0"
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
        "Orient in the Projectplaner Aspect Graph. Call first with a short query for the work area. Returns ranked matches, nearby relations, and open tasks. Serialize with other Projectplaner tools.",
      inputSchema: {
        query: z.string().optional().describe("Short search query for aspects, features, tasks, or related entities"),
        limit: z.number().int().min(1).max(50).optional().describe("Max matches to return (default 10)")
      }
    },
    async ({ query, limit }) => {
      try {
        return textResult(await orient(query, limit));
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  server.registerTool(
    "get_entity",
    {
      description: "Fetch one Projectplaner entity by id (Aspect, Feature, Task, Reference, etc.).",
      inputSchema: {
        id: z.string().describe("Entity id")
      }
    },
    async ({ id }) => {
      try {
        return textResult(await getPlanEntity(id));
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  server.registerTool(
    "list_entities",
    {
      description: "List Projectplaner entities, optionally filtered by type and query.",
      inputSchema: {
        type: entityTypeSchema.optional(),
        query: z.string().optional(),
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
        "Create a Projectplaner entity. Tasks require targetEntityId pointing at an Aspect or Feature. Aspects under a parent should use linkType contains.",
      inputSchema: {
        type: entityTypeSchema,
        title: z.string(),
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
      description: "Update fields on an existing Projectplaner entity.",
      inputSchema: {
        id: z.string(),
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
      description: "Create a relation between two entities (depends_on, contains, implements, affects, references, ...).",
      inputSchema: {
        from: z.string().describe("Source entity id"),
        to: z.string().describe("Target entity id"),
        type: relationTypeSchema,
        label: z.string().optional(),
        primary: z.boolean().optional(),
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
        "Read orientation packets linked to an entity. Use before broad code search when consuming a task handoff.",
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
        "Write a compact Orientation Packet v1 and attach it to an entity. Leave machine-oriented deltas, not chat transcripts.",
      inputSchema: {
        entityId: z.string(),
        metadata: z.record(z.unknown()).describe("Packet fields: workflow, state, targetIds, next, confidence, ..."),
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

  return server;
}
