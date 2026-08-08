import { describe, expect, it } from "vitest";
import { detectDraftConflicts } from "./drafts";
import type { DraftChange, ProjectNode, ProjectRelation } from "../domain/types";

const nodes: ProjectNode[] = [
  {
    id: "parent",
    projectId: "p",
    parentId: null,
    type: "aspect",
    slug: "parent",
    path: "parent",
    title: "Parent",
    summary: "",
    body: "",
    status: "planned",
    sortOrder: 0,
    metadata: {}
  },
  {
    id: "child",
    projectId: "p",
    parentId: "parent",
    type: "aspect",
    slug: "child",
    path: "parent.child",
    title: "Graph View",
    summary: "",
    body: "",
    status: "planned",
    sortOrder: 1,
    metadata: {}
  }
];

const relations: ProjectRelation[] = [];

describe("draft conflict detection", () => {
  it("reports duplicate create titles under the same parent", () => {
    const changes: DraftChange[] = [
      {
        id: "c1",
        draftPlanId: "draft",
        changeType: "create",
        targetType: "node",
        targetId: null,
        payload: { parentId: "parent", title: "Graph View" }
      }
    ];
    const conflicts = detectDraftConflicts({ changes, nodes, relations });
    expect(conflicts.map((conflict) => conflict.message)).toContain(
      "Draft creates a duplicate node title in the same parent."
    );
  });

  it("reports missing node targets", () => {
    const conflicts = detectDraftConflicts({
      changes: [
        {
          id: "missing",
          draftPlanId: "draft",
          changeType: "update",
          targetType: "node",
          targetId: "nope",
          payload: {}
        }
      ],
      nodes,
      relations
    });

    expect(conflicts[0]?.severity).toBe("error");
  });
});
