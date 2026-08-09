import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createProjectplanerServer, listRegisteredToolDefs, listRegisteredToolNames } from "./server";
import { EXPECTED_MCP_TOOLS, assertExpectedToolNames } from "./tools";

type ZodLike = {
  shape?: Record<string, { isOptional?: () => boolean }>;
};

function shapeKeys(inputSchema: unknown): string[] {
  const shape = (inputSchema as ZodLike | undefined)?.shape;
  if (!shape || typeof shape !== "object") {
    return [];
  }
  return Object.keys(shape);
}

function isRequiredField(inputSchema: unknown, key: string): boolean {
  const field = (inputSchema as ZodLike | undefined)?.shape?.[key];
  if (!field) {
    return false;
  }
  return typeof field.isOptional === "function" ? !field.isOptional() : true;
}

describe("projectplaner MCP tool surface", () => {
  it("registers the expected tool names", () => {
    const server = createProjectplanerServer();
    const names = listRegisteredToolNames(server);
    assertExpectedToolNames(names);
    assert.deepEqual(names.sort(), [...EXPECTED_MCP_TOOLS].sort());
  });

  it("exposes honest required write fields and read options", () => {
    const defs = listRegisteredToolDefs(createProjectplanerServer());

    assert.match(defs.orient?.description ?? "", /Does not search the graph/i);
    assert.equal(defs.orient?.inputSchema, undefined);
    assert.deepEqual(shapeKeys(defs.orient?.inputSchema), []);

    assert.match(defs.search?.description ?? "", /Relevance search/i);
    assert.ok(shapeKeys(defs.search?.inputSchema).includes("q"));
    assert.ok(isRequiredField(defs.search?.inputSchema, "q"));

    for (const key of ["relatedTo", "limit"]) {
      assert.ok(shapeKeys(defs.next_work?.inputSchema).includes(key), `next_work missing ${key}`);
    }
    assert.match(defs.next_work?.description ?? "", /leaf Feature|outgoing affects\/implements/i);

    for (const key of ["id", "includeBody", "includeMetadata"]) {
      assert.ok(shapeKeys(defs.get_entity?.inputSchema).includes(key), `get_entity missing ${key}`);
    }

    assert.match(defs.list_entities?.description ?? "", /outgoing links targeting/i);

    for (const key of ["type", "title", "reason"]) {
      assert.ok(shapeKeys(defs.create_entity?.inputSchema).includes(key), `create_entity missing ${key}`);
      assert.ok(isRequiredField(defs.create_entity?.inputSchema, key), `create_entity.${key} should be required`);
    }
    for (const key of ["id", "reason"]) {
      assert.ok(shapeKeys(defs.update_entity?.inputSchema).includes(key), `update_entity missing ${key}`);
      assert.ok(isRequiredField(defs.update_entity?.inputSchema, key), `update_entity.${key} should be required`);
    }
    for (const key of ["entityId", "reason", "metadata"]) {
      assert.ok(shapeKeys(defs.packet_write?.inputSchema).includes(key), `packet_write missing ${key}`);
      assert.ok(isRequiredField(defs.packet_write?.inputSchema, key), `packet_write.${key} should be required`);
    }
  });
});
