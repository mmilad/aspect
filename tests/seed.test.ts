import { describe, expect, it } from "vitest";
import { selfPlanningSeed } from "@projectplaner/core";

describe("self-planning seed", () => {
  it("contains the root project, graph aspect and sidebar tab aspects", () => {
    expect(selfPlanningSeed.project.key).toBe("PLAN");
    expect(selfPlanningSeed.nodes.some((node) => node.id === "node_graph_view")).toBe(true);
    expect(selfPlanningSeed.nodes.some((node) => node.id === "node_sidebar_tabs")).toBe(true);
    expect(selfPlanningSeed.nodes.some((node) => node.id === "node_tab_issues")).toBe(true);
  });

  it("uses unique paths", () => {
    const paths = selfPlanningSeed.nodes.map((node) => node.path);
    expect(new Set(paths).size).toBe(paths.length);
  });
});
