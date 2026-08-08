import { describe, expect, it } from "vitest";
import {
  compileListQuery,
  createPlanApi,
  expandNamedPredicates,
  evaluatePlan,
  isTaskUnblocked,
  MemoryEntityStore,
  UNBLOCKED_FILTER,
  type Entity,
  type EntityRelation
} from "../index";

const projectId = "project_test";
const projectKey = "PLAN";

function entity(partial: Partial<Entity> & Pick<Entity, "id" | "type" | "title">): Entity {
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

describe("query expand + evaluate", () => {
  const aspect = entity({ id: "aspect_a", type: "aspect", title: "Aspect A" });
  const otherAspect = entity({ id: "aspect_b", type: "aspect", title: "Aspect B" });
  const open = entity({ id: "task_open", type: "task", title: "Open", metadata: { priority: "high" } });
  const blocked = entity({ id: "task_blocked", type: "task", title: "Blocked" });
  const resolved = entity({ id: "task_resolved_blockers", type: "task", title: "Was blocked" });
  const other = entity({ id: "task_other", type: "task", title: "Other aspect" });
  const blockerOpen = entity({ id: "blocker", type: "task", title: "Blocker", status: "todo" });
  const blockerDone = entity({ id: "blocker_done", type: "task", title: "Done", status: "done" });

  const entities = [aspect, otherAspect, open, blocked, resolved, other, blockerOpen, blockerDone];
  const relations = [
    relation("l1", "task_open", "aspect_a", "affects"),
    relation("l2", "task_blocked", "aspect_a", "affects"),
    relation("l3", "task_resolved_blockers", "aspect_a", "implements"),
    relation("l4", "task_other", "aspect_b", "affects"),
    relation("b1", "task_blocked", "blocker", "blocked_by"),
    relation("b2", "task_resolved_blockers", "blocker_done", "blocked_by"),
    // blockers belong to a different aspect so they are not in the aspect_a result set
    relation("l5", "blocker", "aspect_b", "affects"),
    relation("l6", "blocker_done", "aspect_b", "affects")
  ];

  it("expands unblocked into blocked_by every-resolved", () => {
    expect(expandNamedPredicates({ pred: "unblocked" })).toEqual(UNBLOCKED_FILTER);
  });

  it("matches isTaskUnblocked for evaluatePlan unblocked pred", () => {
    const byId = new Map(entities.map((item) => [item.id, item]));
    const plan = compileListQuery({
      projectKey,
      where: {
        and: [
          { pred: "unblocked" },
          {
            rel: {
              direction: "out",
              types: ["affects", "implements", "validates", "investigates"],
              some: { field: "id", op: "eq", value: "aspect_a" }
            }
          }
        ]
      }
    }, { type: "task" });

    const ids = evaluatePlan(plan, entities, relations, {
      projectIdByKey: new Map([[projectKey, projectId]])
    }).map((item) => item.id);

    expect(ids.sort()).toEqual(["task_open", "task_resolved_blockers"].sort());
    expect(isTaskUnblocked(open, byId, relations)).toBe(true);
    expect(isTaskUnblocked(blocked, byId, relations)).toBe(false);
    expect(isTaskUnblocked(resolved, byId, relations)).toBe(true);
  });

  it("TaskController sugar lists unblocked tasks related to an aspect", async () => {
    const api = createPlanApi(
      new MemoryEntityStore({
        entities,
        relations,
        projectIdByKey: new Map([[projectKey, projectId]])
      })
    );

    const result = await api.tasks.list({
      projectKey,
      unblocked: true,
      relatedTo: { id: "aspect_a" },
      select: "compact"
    });

    expect(result.items.map((item) => item.id).sort()).toEqual(
      ["task_open", "task_resolved_blockers"].sort()
    );
    expect(result.items.every((item) => item.type === "task")).toBe(true);
    expect(result.items[0] && "body" in result.items[0]).toBe(false);
  });
});
