import { describe, expect, it } from "vitest";
import {
  getEntityDependents,
  getTagsForEntity,
  getTasksForAspect,
  getTasksForFeature,
  validateTaskLinks
} from "./task-planning";
import { selfPlanningSeed } from "./seed";

describe("task planning", () => {
  it("requires every task to have an aspect or feature link", () => {
    expect(validateTaskLinks("missing", selfPlanningSeed.taskLinks)).toContain(
      "Task must link to at least one Aspect or Feature."
    );
    expect(validateTaskLinks("task_graph_drag", selfPlanningSeed.taskLinks)).toEqual([]);
  });

  it("keeps a visible Misc aspect for fallback tasks", () => {
    expect(selfPlanningSeed.nodes.some((node) => node.id === "node_misc" && node.type === "aspect")).toBe(true);
    expect(getTasksForAspect("node_misc", selfPlanningSeed).map((task) => task.id)).toContain("task_misc_fallback");
  });

  it("derives depended-on-by from depends_on relations", () => {
    expect(getEntityDependents({ type: "task", id: "task_graph_drag" }, selfPlanningSeed).map((relation) => relation.sourceId)).toContain(
      "task_task_aspect_links"
    );
  });

  it("looks up direct, feature-linked and descendant aspect tasks", () => {
    expect(getTasksForAspect("node_graph_view", selfPlanningSeed).map((task) => task.id)).toContain("task_graph_drag");
    expect(getTasksForAspect("node_tab_issues", selfPlanningSeed, { includeFeatures: true }).map((task) => task.id)).toContain(
      "task_task_aspect_links"
    );
    expect(
      getTasksForAspect("node_sidebar", selfPlanningSeed, { includeSubaspects: true, includeFeatures: true }).map(
        (task) => task.id
      )
    ).toContain("task_sidebar_model");
  });

  it("looks up nested feature tasks", () => {
    expect(
      getTasksForFeature("feature_project_sidebar", selfPlanningSeed, { includeNestedFeatures: true }).map((task) => task.id)
    ).toContain("task_task_aspect_links");
  });

  it("assigns tags to aspects, features and tasks", () => {
    expect(getTagsForEntity({ type: "aspect", id: "node_graph_view" }, selfPlanningSeed).map((tag) => tag.slug)).toContain("ux");
    expect(getTagsForEntity({ type: "feature", id: "feature_issue_list" }, selfPlanningSeed).map((tag) => tag.slug)).toContain(
      "business-critical"
    );
    expect(getTagsForEntity({ type: "task", id: "task_task_aspect_links" }, selfPlanningSeed).map((tag) => tag.slug)).toContain(
      "planning-model"
    );
  });
});

