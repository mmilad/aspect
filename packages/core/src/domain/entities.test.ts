import { describe, expect, it } from "vitest";
import { getGenericEntityDependents, validateEntityGraph } from "./entities";
import type { Entity, EntityRelation } from "./types";

const projectId = "project_test";

function entity(id: string, type: Entity["type"]): Entity {
  return {
    id,
    projectId,
    type,
    key: null,
    slug: id,
    title: id,
    summary: "",
    body: "",
    status: "planned",
    sortOrder: 0,
    metadata: {}
  };
}

function relation(id: string, sourceEntityId: string, targetEntityId: string, type: EntityRelation["type"], isPrimary = false): EntityRelation {
  return {
    id,
    projectId,
    sourceEntityId,
    targetEntityId,
    type,
    label: null,
    isPrimary,
    metadata: {}
  };
}

describe("generic entities", () => {
  it("rejects tasks without an Aspect or Feature relation", () => {
    const result = validateEntityGraph([entity("task_1", "task")], []);

    expect(result.errors).toContain("Task task_1 must link to at least one Aspect or Feature.");
  });

  it("warns when features are not linked to an Aspect", () => {
    const result = validateEntityGraph([entity("feature_1", "feature")], []);

    expect(result.errors).toEqual([]);
    expect(result.warnings).toContain("Feature feature_1 should link to at least one Aspect.");
  });

  it("rejects multiple primary parents for an aspect", () => {
    const entities = [entity("aspect_1", "aspect"), entity("aspect_2", "aspect"), entity("aspect_3", "aspect")];
    const relations = [
      relation("rel_1", "aspect_2", "aspect_1", "contains", true),
      relation("rel_2", "aspect_3", "aspect_1", "contains", true)
    ];

    expect(validateEntityGraph(entities, relations).errors).toContain("Aspect aspect_1 has multiple primary parents.");
  });

  it("derives depended-on-by from depends_on relations", () => {
    const relations = [relation("rel_1", "task_2", "task_1", "depends_on")];

    expect(getGenericEntityDependents("task_1", relations).map((item) => item.sourceEntityId)).toContain("task_2");
  });
});
