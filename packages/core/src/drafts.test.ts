import { describe, expect, it } from "vitest";
import { detectDraftConflicts } from "./drafts";
import { selfPlanningSeed } from "./seed";

describe("draft conflict detection", () => {
  it("keeps draft changes isolated while reporting conflicts", () => {
    const draft = selfPlanningSeed.draftPlans[0];
    const conflicts = detectDraftConflicts({
      changes: selfPlanningSeed.draftChanges.filter((change) => change.draftPlanId === draft.id),
      nodes: selfPlanningSeed.nodes,
      relations: selfPlanningSeed.relations
    });

    expect(conflicts.map((conflict) => conflict.message)).toContain(
      "Draft creates a duplicate node title in the same parent."
    );
    expect(selfPlanningSeed.nodes.some((node) => node.id === "node_graph_view")).toBe(true);
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
      nodes: selfPlanningSeed.nodes,
      relations: selfPlanningSeed.relations
    });

    expect(conflicts[0]?.severity).toBe("error");
  });
});
