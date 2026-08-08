import { describe, expect, it } from "vitest";
import {
  getEntityDependents,
  getTagsForEntity,
  getTasksForAspect,
  getTasksForFeature,
  validateTaskLinks
} from "./task-planning";
import type { ProjectPlanSnapshot } from "../domain/types";

const snapshot: ProjectPlanSnapshot = {
  project: { id: "p", key: "PLAN", title: "Plan", description: "" },
  nodes: [
    {
      id: "aspect_root",
      projectId: "p",
      parentId: null,
      type: "aspect",
      slug: "root",
      path: "root",
      title: "Root",
      summary: "",
      body: "",
      status: "planned",
      sortOrder: 0,
      metadata: {}
    },
    {
      id: "aspect_child",
      projectId: "p",
      parentId: "aspect_root",
      type: "aspect",
      slug: "child",
      path: "root.child",
      title: "Child",
      summary: "",
      body: "",
      status: "planned",
      sortOrder: 1,
      metadata: {}
    },
    {
      id: "aspect_misc",
      projectId: "p",
      parentId: "aspect_root",
      type: "aspect",
      slug: "misc",
      path: "root.misc",
      title: "Misc",
      summary: "",
      body: "",
      status: "planned",
      sortOrder: 2,
      metadata: {}
    }
  ],
  relations: [],
  draftPlans: [],
  draftChanges: [],
  features: [
    {
      id: "feature_parent",
      projectId: "p",
      parentFeatureId: null,
      key: "FEAT-1",
      slug: "parent",
      title: "Parent feature",
      summary: "",
      body: "",
      status: "planned",
      acceptanceShape: "",
      sortOrder: 0,
      metadata: {}
    },
    {
      id: "feature_child",
      projectId: "p",
      parentFeatureId: "feature_parent",
      key: "FEAT-2",
      slug: "child",
      title: "Child feature",
      summary: "",
      body: "",
      status: "planned",
      acceptanceShape: "",
      sortOrder: 1,
      metadata: {}
    }
  ],
  featureAspectLinks: [
    { id: "fal_1", featureId: "feature_parent", aspectId: "aspect_child", type: "implements", isPrimary: true },
    { id: "fal_2", featureId: "feature_child", aspectId: "aspect_child", type: "implements", isPrimary: true }
  ],
  tasks: [
    {
      id: "task_direct",
      projectId: "p",
      key: "PLAN-1",
      title: "Direct",
      description: "",
      status: "todo",
      priority: "medium",
      acceptanceCriteria: [],
      sortOrder: 0,
      metadata: {}
    },
    {
      id: "task_via_feature",
      projectId: "p",
      key: "PLAN-2",
      title: "Via feature",
      description: "",
      status: "todo",
      priority: "medium",
      acceptanceCriteria: [],
      sortOrder: 1,
      metadata: {}
    },
    {
      id: "task_nested",
      projectId: "p",
      key: "PLAN-3",
      title: "Nested",
      description: "",
      status: "todo",
      priority: "medium",
      acceptanceCriteria: [],
      sortOrder: 2,
      metadata: {}
    },
    {
      id: "task_misc",
      projectId: "p",
      key: "PLAN-4",
      title: "Misc",
      description: "",
      status: "todo",
      priority: "low",
      acceptanceCriteria: [],
      sortOrder: 3,
      metadata: {}
    },
    {
      id: "task_blocked",
      projectId: "p",
      key: "PLAN-5",
      title: "Blocked",
      description: "",
      status: "todo",
      priority: "high",
      acceptanceCriteria: [],
      sortOrder: 4,
      metadata: {}
    }
  ],
  taskLinks: [
    { id: "tl_1", taskId: "task_direct", targetType: "aspect", targetId: "aspect_child", type: "affects", isPrimary: true },
    {
      id: "tl_2",
      taskId: "task_via_feature",
      targetType: "feature",
      targetId: "feature_parent",
      type: "implements",
      isPrimary: true
    },
    {
      id: "tl_3",
      taskId: "task_nested",
      targetType: "feature",
      targetId: "feature_child",
      type: "implements",
      isPrimary: true
    },
    { id: "tl_4", taskId: "task_misc", targetType: "aspect", targetId: "aspect_misc", type: "affects", isPrimary: true },
    {
      id: "tl_5",
      taskId: "task_blocked",
      targetType: "aspect",
      targetId: "aspect_child",
      type: "affects",
      isPrimary: true
    }
  ],
  entityRelations: [
    {
      id: "er_1",
      projectId: "p",
      sourceType: "task",
      sourceId: "task_blocked",
      targetType: "task",
      targetId: "task_direct",
      type: "depends_on",
      label: null,
      metadata: {}
    }
  ],
  tags: [
    { id: "tag_ux", projectId: "p", slug: "ux", label: "UX", kind: "domain" },
    { id: "tag_crit", projectId: "p", slug: "business-critical", label: "Critical", kind: "priority" }
  ],
  tagAssignments: [
    { id: "ta_1", tagId: "tag_ux", targetType: "aspect", targetId: "aspect_child" },
    { id: "ta_2", tagId: "tag_crit", targetType: "feature", targetId: "feature_parent" },
    { id: "ta_3", tagId: "tag_ux", targetType: "task", targetId: "task_direct" }
  ]
};

describe("task planning", () => {
  it("requires every task to have an aspect or feature link", () => {
    expect(validateTaskLinks("missing", snapshot.taskLinks)).toContain(
      "Task must link to at least one Aspect or Feature."
    );
    expect(validateTaskLinks("task_direct", snapshot.taskLinks)).toEqual([]);
  });

  it("looks up misc aspect tasks", () => {
    expect(getTasksForAspect("aspect_misc", snapshot).map((task) => task.id)).toContain("task_misc");
  });

  it("derives depended-on-by from depends_on relations", () => {
    expect(
      getEntityDependents({ type: "task", id: "task_direct" }, snapshot).map((relation) => relation.sourceId)
    ).toContain("task_blocked");
  });

  it("looks up direct, feature-linked and descendant aspect tasks", () => {
    expect(getTasksForAspect("aspect_child", snapshot).map((task) => task.id)).toContain("task_direct");
    expect(
      getTasksForAspect("aspect_child", snapshot, { includeFeatures: true }).map((task) => task.id)
    ).toContain("task_via_feature");
    expect(
      getTasksForAspect("aspect_root", snapshot, { includeSubaspects: true, includeFeatures: true }).map(
        (task) => task.id
      )
    ).toContain("task_nested");
  });

  it("looks up nested feature tasks", () => {
    expect(
      getTasksForFeature("feature_parent", snapshot, { includeNestedFeatures: true }).map((task) => task.id)
    ).toContain("task_nested");
  });

  it("assigns tags to aspects, features and tasks", () => {
    expect(getTagsForEntity({ type: "aspect", id: "aspect_child" }, snapshot).map((tag) => tag.slug)).toContain("ux");
    expect(getTagsForEntity({ type: "feature", id: "feature_parent" }, snapshot).map((tag) => tag.slug)).toContain(
      "business-critical"
    );
    expect(getTagsForEntity({ type: "task", id: "task_direct" }, snapshot).map((tag) => tag.slug)).toContain("ux");
  });
});
