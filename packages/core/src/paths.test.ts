import { describe, expect, it } from "vitest";
import { buildNodePath, slugifyTitle, uniqueSlug } from "./paths";

describe("node paths", () => {
  it("generates stable readable slugs", () => {
    expect(slugifyTitle("Scoped Graph View!")).toBe("scoped-graph-view");
  });

  it("builds dotted paths from parent paths", () => {
    expect(buildNodePath("app.surface.project-map", "graph-view")).toBe("app.surface.project-map.graph-view");
  });

  it("deduplicates sibling slugs", () => {
    expect(uniqueSlug("Graph View", ["graph-view", "graph-view-2"])).toBe("graph-view-3");
  });
});

