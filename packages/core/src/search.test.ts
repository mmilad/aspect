import { describe, expect, it } from "vitest";
import { entitySearchValues, rankedByQuery, scoreSearch } from "./search";
import type { Entity } from "./types";

function entity(input: Partial<Entity> & Pick<Entity, "id" | "type" | "title">): Entity {
  return {
    projectId: "project_self",
    key: null,
    slug: input.title.toLowerCase().replaceAll(" ", "-"),
    summary: "",
    body: "",
    status: "planned",
    sortOrder: 0,
    metadata: {},
    ...input
  };
}

describe("search", () => {
  it("scores exact phrase matches above token-only matches", () => {
    expect(scoreSearch(["Agent context API"], "agent context")).toBeGreaterThan(scoreSearch(["Agent API"], "agent context"));
  });

  it("ranks entities across core fields and metadata", () => {
    const matches = rankedByQuery(
      [
        entity({ id: "feature_api", type: "feature", title: "Hosted Agent Context", summary: "Expose orientation over HTTP." }),
        entity({ id: "task_cli", type: "task", title: "Keep CLI smoke tests", metadata: { note: "terminal workflow" } })
      ],
      "agent http",
      entitySearchValues
    );

    expect(matches[0]?.item.id).toBe("feature_api");
    expect(matches[0]?.score).toBeGreaterThan(0);
  });
});
