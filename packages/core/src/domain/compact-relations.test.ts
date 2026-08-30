import { describe, expect, it } from "vitest";
import {
  expandTaskChainIds,
  selectCompactContextRelations
} from "./compact-relations";
import type { EntityRelation, EntityRelationType } from "./types";

function rel(
  id: string,
  from: string,
  type: EntityRelationType,
  to: string
): EntityRelation {
  return {
    id,
    projectId: "p",
    sourceEntityId: from,
    targetEntityId: to,
    type,
    label: null,
    isPrimary: false,
    metadata: {}
  };
}

describe("selectCompactContextRelations", () => {
  const feature = "feature_1";
  const taskA = "task_a";
  const taskB = "task_b";
  const extra = "ref_noise";

  const relations = [
    rel("r1", feature, "contains", extra),
    rel("r2", extra, "references", feature),
    rel("r3", extra, "related_to", extra),
    rel("r4", taskA, "implements", feature),
    rel("r5", taskB, "implements", feature),
    rel("r6", taskB, "depends_on", taskA)
  ];

  it("keeps implements and depends_on even when neighborhood filler would fill the limit", () => {
    const neighborhoodIds = new Set([feature, taskA, taskB, extra]);
    const selected = selectCompactContextRelations(relations, {
      chainIds: new Set([feature, taskA, taskB]),
      neighborhoodIds,
      limit: 2
    });
    const types = selected.map((item) => item.type);
    expect(types).toContain("depends_on");
    expect(types.filter((type) => type === "implements")).toHaveLength(2);
    expect(selected.some((item) => item.id === "r6")).toBe(true);
  });

  it("fills remaining compact slots from the neighborhood after chain edges", () => {
    const selected = selectCompactContextRelations(relations, {
      chainIds: new Set([feature, taskA, taskB]),
      neighborhoodIds: new Set([feature, taskA, taskB, extra]),
      limit: 10
    });
    expect(selected.some((item) => item.type === "contains")).toBe(true);
    expect(selected.map((item) => item.id).slice(0, 3)).toEqual(["r6", "r4", "r5"]);
  });

  it("keeps implements onto the anchor feature and drops implements onto another feature", () => {
    const selected = selectCompactContextRelations(
      [
        rel("r1", "task_a", "implements", "feature_1"),
        rel("r2", "task_host", "implements", "feature_host"),
        rel("r3", "task_a", "depends_on", "task_host")
      ],
      {
        chainIds: new Set(["feature_1", "task_a", "task_host", "feature_host"]),
        neighborhoodIds: new Set(["feature_1", "task_a", "task_host", "feature_host"]),
        limit: 10,
        anchorIds: new Set(["feature_1"])
      }
    );
    expect(selected.some((item) => item.id === "r1")).toBe(true);
    expect(selected.some((item) => item.id === "r2")).toBe(false);
    expect(selected.some((item) => item.id === "r3")).toBe(true);
  });
});

describe("expandTaskChainIds", () => {
  it("adds a depends_on partner that depth-1 neighborhood missed", () => {
    const relations = [
      rel("r1", "task_open", "implements", "feature_1"),
      rel("r2", "task_open", "depends_on", "task_hidden")
    ];
    const expanded = expandTaskChainIds(["feature_1", "task_open"], relations);
    expect(expanded.has("task_hidden")).toBe(true);
  });

  it("does not follow implements into another feature's tasks", () => {
    const relations = [
      rel("r1", "task_a", "implements", "feature_1"),
      rel("r2", "task_a", "depends_on", "feature_host"),
      rel("r3", "task_host", "implements", "feature_host")
    ];
    const expanded = expandTaskChainIds(["feature_1", "task_a"], relations);
    expect(expanded.has("feature_host")).toBe(true);
    expect(expanded.has("task_host")).toBe(false);
  });

  it("does not walk a second depends_on hop into another feature's DAG", () => {
    const relations = [
      rel("r1", "task_a", "depends_on", "task_host"),
      rel("r2", "task_host", "depends_on", "task_host_2")
    ];
    const expanded = expandTaskChainIds(["task_a"], relations);
    expect(expanded.has("task_host")).toBe(true);
    expect(expanded.has("task_host_2")).toBe(false);
  });
});
