import { describe, expect, it } from "vitest";
import {
  compileListQuery,
  createPlanApi,
  expandNamedPredicates,
  evaluatePlan,
  getNarrative,
  isTaskUnblocked,
  MemoryEntityStore,
  UNBLOCKED_FILTER,
  withNarrative,
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
    relation("l5", "blocker", "aspect_b", "affects"),
    relation("l6", "blocker_done", "aspect_b", "affects")
  ];

  it("expands unblocked into blocked_by every-resolved", () => {
    expect(expandNamedPredicates({ pred: "unblocked" })).toEqual(UNBLOCKED_FILTER);
  });

  it("matches isTaskUnblocked for evaluatePlan unblocked pred", () => {
    const byId = new Map(entities.map((item) => [item.id, item]));
    const plan = compileListQuery(
      {
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
      },
      { type: "task" }
    );

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

    expect(result.meta.mode).toBe("filter");
    expect(result.meta.applied).not.toBeNull();
    expect(result.items.map((item) => item.id).sort()).toEqual(
      ["task_open", "task_resolved_blockers"].sort()
    );
    expect(result.items.every((item) => item.type === "task")).toBe(true);
    expect(result.items[0] && "body" in result.items[0]).toBe(false);
  });
});

describe("narrative + retrieval modes", () => {
  it("getNarrative / withNarrative merge without clobbering priority", () => {
    const task = entity({
      id: "t1",
      type: "task",
      title: "T",
      metadata: { priority: "high" }
    });
    const updated = withNarrative(task, { reason: "because graph", proposal: "ship filter api" });
    expect(updated.metadata.priority).toBe("high");
    expect(getNarrative(updated)).toMatchObject({
      reason: "because graph",
      proposal: "ship filter api"
    });
  });

  it("search ranks an entity when only narrative.reason matches", async () => {
    const visible = withNarrative(
      entity({ id: "aspect_reason", type: "aspect", title: "Unrelated Title" }),
      { reason: "unique-zebra-handoff context" }
    );
    const other = entity({ id: "aspect_other", type: "aspect", title: "Something Else" });
    const api = createPlanApi(
      new MemoryEntityStore({
        entities: [visible, other],
        relations: [],
        projectIdByKey: new Map([[projectKey, projectId]])
      })
    );

    const result = await api.entities.search({
      projectKey,
      q: "unique-zebra-handoff",
      limit: 5,
      select: "compact"
    });

    expect(result.meta.mode).toBe("relevance");
    expect(result.items.map((item) => item.id)).toEqual(["aspect_reason"]);
    expect(result.items[0]?.score).toBeGreaterThan(0);
  });

  it("filters by metadata.narrative.reason match", () => {
    const visible = withNarrative(entity({ id: "a1", type: "aspect", title: "A" }), {
      reason: "needle-in-reason"
    });
    const other = withNarrative(entity({ id: "a2", type: "aspect", title: "B" }), {
      reason: "different"
    });
    const plan = compileListQuery({
      projectKey,
      where: { field: "metadata.narrative.reason", op: "match", value: "needle-in-reason" }
    });
    const ids = evaluatePlan(plan, [visible, other], [], {
      projectIdByKey: new Map([[projectKey, projectId]])
    }).map((item) => item.id);
    expect(ids).toEqual(["a1"]);
  });

  it("nextWork orders by workScore and respects relatedTo + unblocked candidacy", async () => {
    const aspect = entity({ id: "aspect_a", type: "aspect", title: "Aspect A" });
    const high = entity({
      id: "task_high",
      type: "task",
      title: "High",
      key: "T-2",
      metadata: { priority: "critical" }
    });
    const low = entity({
      id: "task_low",
      type: "task",
      title: "Low",
      key: "T-1",
      metadata: { priority: "low" }
    });
    const blocked = entity({
      id: "task_blocked",
      type: "task",
      title: "Blocked",
      metadata: { priority: "critical" }
    });
    const blocker = entity({ id: "blocker", type: "task", title: "Blocker", status: "todo" });
    const otherAspect = entity({ id: "aspect_b", type: "aspect", title: "B" });
    const elsewhere = entity({
      id: "task_elsewhere",
      type: "task",
      title: "Elsewhere",
      metadata: { priority: "critical" }
    });

    const api = createPlanApi(
      new MemoryEntityStore({
        entities: [aspect, otherAspect, high, low, blocked, blocker, elsewhere],
        relations: [
          relation("r1", "task_high", "aspect_a", "affects"),
          relation("r2", "task_low", "aspect_a", "affects"),
          relation("r3", "task_blocked", "aspect_a", "affects"),
          relation("r4", "task_blocked", "blocker", "blocked_by"),
          relation("r5", "blocker", "aspect_b", "affects"),
          relation("r6", "task_elsewhere", "aspect_b", "affects")
        ],
        projectIdByKey: new Map([[projectKey, projectId]])
      })
    );

    const result = await api.tasks.nextWork({
      projectKey,
      relatedTo: { id: "aspect_a" },
      limit: 10
    });

    expect(result.meta.mode).toBe("work");
    expect(result.items.map((item) => item.id)).toEqual(["task_high", "task_low"]);
    expect(result.items[0]!.score).toBeGreaterThan(result.items[1]!.score);
  });
});

describe("archived entity exclusion", () => {
  const live = entity({ id: "aspect_live", type: "aspect", title: "Live Shell", status: "in_work" });
  const archived = entity({
    id: "aspect_archived",
    type: "aspect",
    title: "Archived Shell",
    status: "archived",
    summary: "old shell aspect"
  });
  const liveTask = entity({ id: "task_live", type: "task", title: "Live task", status: "todo" });
  const archivedTask = entity({
    id: "task_archived",
    type: "task",
    title: "Archived task",
    status: "archived"
  });

  const store = () =>
    new MemoryEntityStore({
      entities: [live, archived, liveTask, archivedTask],
      relations: [
        relation("r1", "task_live", "aspect_live", "affects"),
        relation("r2", "task_archived", "aspect_archived", "affects")
      ],
      projectIdByKey: new Map([[projectKey, projectId]])
    });

  it("excludes archived from default list and search", async () => {
    const api = createPlanApi(store());

    const listed = await api.entities.list({ projectKey });
    expect(listed.items.map((item) => item.id).sort()).toEqual(["aspect_live", "task_live"].sort());

    const searched = await api.entities.search({ projectKey, q: "Shell" });
    expect(searched.items.map((item) => item.id)).toEqual(["aspect_live"]);

    const included = await api.entities.list({ projectKey, includeArchived: true });
    expect(included.items.map((item) => item.id).sort()).toEqual(
      ["aspect_archived", "aspect_live", "task_archived", "task_live"].sort()
    );
  });

  it("still returns archived entities by id", async () => {
    const api = createPlanApi(store());
    const entityView = await api.entities.get("aspect_archived");
    expect(entityView?.id).toBe("aspect_archived");
    expect(entityView?.status).toBe("archived");
  });

  it("keeps archived blockers resolved for candidacy", async () => {
    const aspect = entity({ id: "aspect_a", type: "aspect", title: "A", status: "planned" });
    const archivedFeature = entity({
      id: "feature_old",
      type: "feature",
      title: "Old",
      status: "archived"
    });
    const task = entity({ id: "task_ready", type: "task", title: "Ready", status: "todo" });
    const api = createPlanApi(
      new MemoryEntityStore({
        entities: [aspect, archivedFeature, task],
        relations: [
          relation("r1", "task_ready", "aspect_a", "affects"),
          relation("r2", "task_ready", "feature_old", "blocked_by")
        ],
        projectIdByKey: new Map([[projectKey, projectId]])
      })
    );

    const result = await api.tasks.nextWork({ projectKey });
    expect(result.items.map((item) => item.id)).toEqual(["task_ready"]);
  });
});
