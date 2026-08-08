import { describe, expect, it } from "vitest";
import {
  composeTaskPrompt,
  isBlockerResolved,
  isTaskCandidate,
  isTaskDisabled,
  isTaskUnblocked,
  lightSignals,
  rankTaskCandidates,
  workScore
} from "./task-candidacy";
import type { Entity, EntityRelation } from "./types";

const projectId = "project_test";

function entity(
  partial: Partial<Entity> & Pick<Entity, "id" | "type" | "title">
): Entity {
  return {
    projectId,
    key: null,
    slug: partial.id,
    summary: "",
    body: "",
    status: partial.type === "task" ? "todo" : "planned",
    sortOrder: 0,
    metadata: {},
    ...partial
  };
}

function relation(
  id: string,
  sourceEntityId: string,
  targetEntityId: string,
  type: EntityRelation["type"]
): EntityRelation {
  return {
    id,
    projectId,
    sourceEntityId,
    targetEntityId,
    type,
    label: null,
    isPrimary: false,
    metadata: {}
  };
}

describe("task candidacy", () => {
  it("treats metadata.disabled as canceled", () => {
    expect(isTaskDisabled(entity({ id: "t1", type: "task", title: "A", metadata: { disabled: true } }))).toBe(
      true
    );
    expect(isTaskDisabled(entity({ id: "t2", type: "task", title: "B" }))).toBe(false);
  });

  it("resolves blockers by type-specific completion", () => {
    expect(isBlockerResolved(entity({ id: "t", type: "task", title: "T", status: "done" }))).toBe(true);
    expect(isBlockerResolved(entity({ id: "t2", type: "task", title: "T2", status: "todo" }))).toBe(false);
    expect(
      isBlockerResolved(entity({ id: "d", type: "decision", title: "D", status: "accepted" }))
    ).toBe(true);
    expect(
      isBlockerResolved(entity({ id: "a", type: "aspect", title: "A", status: "implemented" }))
    ).toBe(true);
    expect(
      isBlockerResolved(entity({ id: "x", type: "task", title: "X", metadata: { disabled: true } }))
    ).toBe(true);
  });

  it("treats missing blocked_by as unblocked and requires resolved blockers otherwise", () => {
    const open = entity({ id: "task_open", type: "task", title: "Open" });
    const blocked = entity({ id: "task_blocked", type: "task", title: "Blocked" });
    const blockerOpen = entity({ id: "blocker", type: "task", title: "Blocker", status: "todo" });
    const blockerDone = entity({ id: "blocker_done", type: "task", title: "Done", status: "done" });
    const entities = new Map(
      [open, blocked, blockerOpen, blockerDone].map((item) => [item.id, item])
    );

    expect(isTaskUnblocked(open, entities, [])).toBe(true);
    expect(
      isTaskUnblocked(blocked, entities, [
        relation("r1", "task_blocked", "blocker", "blocked_by")
      ])
    ).toBe(false);
    expect(
      isTaskUnblocked(blocked, entities, [
        relation("r2", "task_blocked", "blocker_done", "blocked_by")
      ])
    ).toBe(true);
  });

  it("excludes disabled, done, and status-blocked tasks from candidacy", () => {
    const aspect = entity({ id: "aspect_1", type: "aspect", title: "Aspect", status: "planned" });
    const todo = entity({ id: "task_todo", type: "task", title: "Todo", metadata: { priority: "high" } });
    const disabled = entity({
      id: "task_disabled",
      type: "task",
      title: "Canceled",
      metadata: { disabled: true, priority: "critical" }
    });
    const statusBlocked = entity({ id: "task_sb", type: "task", title: "SB", status: "blocked" });
    const done = entity({ id: "task_done", type: "task", title: "Done", status: "done" });
    const waiting = entity({ id: "task_wait", type: "task", title: "Wait", metadata: { priority: "critical" } });
    const entities = [aspect, todo, disabled, statusBlocked, done, waiting];
    const byId = new Map(entities.map((item) => [item.id, item]));
    const relations = [
      relation("r_wait", "task_wait", "aspect_1", "blocked_by"),
      relation("r_link", "task_todo", "aspect_1", "affects")
    ];

    expect(isTaskCandidate(todo, byId, relations)).toBe(true);
    expect(isTaskCandidate(disabled, byId, relations)).toBe(false);
    expect(isTaskCandidate(statusBlocked, byId, relations)).toBe(false);
    expect(isTaskCandidate(done, byId, relations)).toBe(false);
    expect(isTaskCandidate(waiting, byId, relations)).toBe(false);
  });

  it("ranks by priority then light signals", () => {
    const aspect = entity({ id: "aspect_1", type: "aspect", title: "Aspect" });
    const lowConnected = entity({
      id: "task_low",
      type: "task",
      key: "PLAN-2",
      title: "Low",
      metadata: { priority: "low" }
    });
    const highSparse = entity({
      id: "task_high",
      type: "task",
      key: "PLAN-1",
      title: "High",
      metadata: { priority: "high" }
    });
    const mediumCriticalTag = entity({
      id: "task_med",
      type: "task",
      key: "PLAN-3",
      title: "Med",
      metadata: { priority: "medium" }
    });
    const entities = [aspect, lowConnected, highSparse, mediumCriticalTag];
    const relations = [
      relation("r1", "task_low", "aspect_1", "affects"),
      relation("r2", "task_low", "aspect_1", "implements"),
      relation("r3", "task_low", "aspect_1", "related_to"),
      relation("r4", "task_med", "aspect_1", "affects")
    ];

    expect(lightSignals(lowConnected, relations)).toBe(3);
    expect(workScore(highSparse, relations)).toBe(30);
    expect(workScore(mediumCriticalTag, relations, { criticalTaggedIds: new Set(["task_med"]) })).toBe(
      20 + 1 + 5
    );

    const ranked = rankTaskCandidates(entities, relations, {
      criticalTaggedIds: new Set(["task_med"])
    });
    expect(ranked.map((item) => item.id)).toEqual(["task_high", "task_med", "task_low"]);
    expect(ranked[0]?.workScore).toBeGreaterThan(ranked[1]?.workScore ?? 0);
  });

  it("composes a prompt with task and context", () => {
    const prompt = composeTaskPrompt({
      task: {
        id: "task_1",
        type: "task",
        key: "PLAN-9",
        title: "Do the thing",
        status: "todo",
        summary: "Ship it",
        priority: "high",
        workScore: 31
      },
      context: { entities: [{ id: "aspect_1", title: "Workspace" }], relations: [] }
    });
    expect(prompt).toContain("PLAN-9");
    expect(prompt).toContain("Do the thing");
    expect(prompt).toContain("workScore 31");
    expect(prompt).toContain("aspect_1");
  });
});
