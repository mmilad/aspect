import { describe, expect, it } from "vitest";
import type { ProjectNode, ProjectPlanSnapshot } from "@projectplaner/core";
import { buildGraphEntities } from "../apps/web/components/graph-workspace/lib/build-graph-entities";
import { buildFullFlowNodes } from "../apps/web/components/graph-workspace/lib/build-flow-nodes";
import { filterScoredEntities } from "../apps/web/components/graph-workspace/lib/filter-scored-entities";
import { graphNodeOpenHref } from "../apps/web/components/graph-workspace/lib/graph-open-target";
import { orderedEntityTypes } from "../apps/web/components/graph-workspace/lib/ordered-entity-types";
import { scoreEntity } from "../apps/web/components/graph-workspace/lib/score-entity";

function node(
  partial: Pick<ProjectNode, "id" | "type" | "slug" | "path" | "title" | "sortOrder"> &
    Partial<ProjectNode>
): ProjectNode {
  return {
    projectId: "p",
    parentId: partial.parentId ?? "project_root",
    summary: "",
    body: "",
    status: "planned",
    metadata: {},
    ...partial
  };
}

const snapshot: ProjectPlanSnapshot = {
  project: { id: "p", key: "PLAN", title: "Plan", description: "" },
  nodes: [
    node({
      id: "project_root",
      parentId: null,
      type: "project",
      slug: "root",
      path: "root",
      title: "Project",
      sortOrder: 0
    }),
    node({
      id: "aspect_nav",
      type: "aspect",
      slug: "nav",
      path: "root.nav",
      title: "Navigation Aspect",
      sortOrder: 1
    }),
    node({
      id: "decision_scope",
      type: "decision",
      slug: "scope",
      path: "root.nav.scope",
      title: "Scope Decision",
      parentId: "aspect_nav",
      sortOrder: 2
    }),
    node({
      id: "reference_docs",
      type: "reference",
      slug: "docs",
      path: "root.nav.docs",
      title: "Docs Reference",
      parentId: "aspect_nav",
      sortOrder: 3
    }),
    node({
      id: "flow_onboarding",
      type: "flow",
      slug: "onboarding",
      path: "root.nav.onboarding",
      title: "Onboarding Flow",
      parentId: "aspect_nav",
      sortOrder: 4
    })
  ],
  relations: [],
  draftPlans: [],
  draftChanges: [],
  features: [
    {
      id: "feature_graph",
      projectId: "p",
      parentFeatureId: null,
      key: "FEAT-13",
      slug: "graph",
      title: "Full Entity Graph",
      summary: "Graph navigation",
      body: "",
      status: "in_work",
      acceptanceShape: "",
      sortOrder: 10,
      metadata: {}
    }
  ],
  featureAspectLinks: [
    { id: "fal_1", featureId: "feature_graph", aspectId: "aspect_nav", type: "implements", isPrimary: true }
  ],
  tasks: [
    {
      id: "task_open",
      projectId: "p",
      key: "PLAN-41",
      title: "Add UI tests",
      description: "Cover graph navigation open behavior",
      status: "todo",
      priority: "medium",
      acceptanceCriteria: [],
      sortOrder: 20,
      metadata: {}
    }
  ],
  taskLinks: [
    {
      id: "tl_1",
      taskId: "task_open",
      targetType: "feature",
      targetId: "feature_graph",
      type: "implements",
      isPrimary: true
    }
  ],
  entityRelations: [],
  tags: [],
  tagAssignments: []
};

describe("full entity graph navigation", () => {
  it("builds visible graph entities across core types", () => {
    const entities = buildGraphEntities(snapshot);
    const types = new Set(entities.map((entity) => entity.type));

    expect(types.has("aspect")).toBe(true);
    expect(types.has("feature")).toBe(true);
    expect(types.has("task")).toBe(true);
    expect(types.has("decision")).toBe(true);
    expect(types.has("reference")).toBe(true);
    expect(types.has("flow")).toBe(true);

    const flowNodes = buildFullFlowNodes({
      scoredEntities: entities.map((entity) => ({ entity, score: 0 })),
      entityTypes: orderedEntityTypes(entities.map((entity) => entity.type)),
      centerId: "aspect_nav",
      selectedId: "aspect_nav",
      selectedFeatureId: null,
      query: ""
    });

    expect(flowNodes.map((node) => node.id)).toEqual(
      expect.arrayContaining([
        "aspect_nav",
        "feature_graph",
        "task_open",
        "decision_scope",
        "reference_docs",
        "flow_onboarding"
      ])
    );
  });

  it("applies type filters and ranks search matches by score", () => {
    const entities = buildGraphEntities(snapshot);

    const aspectsOnly = filterScoredEntities(entities, {
      activeTypes: new Set(["aspect"]),
      query: ""
    });
    expect(aspectsOnly.every((match) => match.entity.type === "aspect")).toBe(true);
    expect(aspectsOnly.map((match) => match.entity.id)).toContain("aspect_nav");
    expect(aspectsOnly.map((match) => match.entity.id)).not.toContain("task_open");

    const graphQuery = filterScoredEntities(entities, {
      activeTypes: new Set(entities.map((entity) => entity.type)),
      query: "Full Entity Graph"
    });
    expect(graphQuery.length).toBeGreaterThan(0);
    expect(graphQuery[0]?.entity.id).toBe("feature_graph");
    expect(graphQuery[0]?.score).toBeGreaterThan(
      scoreEntity(entities.find((e) => e.id === "task_open")!, "Full Entity Graph")
    );

    const ranked = filterScoredEntities(entities, {
      activeTypes: new Set(entities.map((entity) => entity.type)),
      query: "graph"
    });
    const featureRank = ranked.findIndex((match) => match.entity.id === "feature_graph");
    const taskRank = ranked.findIndex((match) => match.entity.id === "task_open");
    expect(featureRank).toBeGreaterThanOrEqual(0);
    expect(taskRank).toBeGreaterThanOrEqual(0);
    // Equal substring hits stay stable by sortOrder (feature 10 < task 20).
    expect(featureRank).toBeLessThan(taskRank);

    const openQuery = filterScoredEntities(entities, {
      activeTypes: new Set(entities.map((entity) => entity.type)),
      query: "open behavior"
    });
    expect(openQuery.map((match) => match.entity.id)).toContain("task_open");
    expect(openQuery.every((match) => match.score > 0)).toBe(true);

    const exactTitle = scoreEntity(entities.find((e) => e.id === "feature_graph")!, "Full Entity Graph");
    const tokenOnly = scoreEntity(entities.find((e) => e.id === "feature_graph")!, "zzzgraphzzz");
    expect(exactTitle).toBeGreaterThan(tokenOnly);
  });

  it("opens a graph node into the entity detail route", () => {
    expect(graphNodeOpenHref("PLAN", "feature_graph")).toBe("/projects/PLAN/entities/feature_graph");
    expect(graphNodeOpenHref("PLAN", "task_open")).toBe("/projects/PLAN/entities/task_open");
    expect(graphNodeOpenHref("PLAN", "decision_scope")).toBe("/projects/PLAN/entities/decision_scope");
  });
});
