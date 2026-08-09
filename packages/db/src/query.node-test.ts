import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { compileListQuery, createPlanApi } from "@projectplaner/core";
import { createDatabase, createSqliteEntityStore, executePlan, importGenericPlan } from "./index";

describe("executePlan SQL", () => {
  it("returns the same unblocked aspect-linked tasks as PlanApi sugar", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "projectplaner-query-"));
    const dbPath = path.join(dir, "test.db");
    const db = createDatabase(dbPath);

    const projectId = "proj_query_test";
    await importGenericPlan(db, {
      project: {
        id: projectId,
        key: "PLAN",
        title: "Query Test",
        description: ""
      },
      entities: [
        {
          id: "aspect_a",
          projectId,
          type: "aspect",
          key: null,
          slug: "aspect-a",
          title: "Aspect A",
          summary: "",
          body: "",
          status: "planned",
          sortOrder: 0,
          metadata: {}
        },
        {
          id: "aspect_b",
          projectId,
          type: "aspect",
          key: null,
          slug: "aspect-b",
          title: "Aspect B",
          summary: "",
          body: "",
          status: "planned",
          sortOrder: 1,
          metadata: {}
        },
        {
          id: "task_open",
          projectId,
          type: "task",
          key: "T-1",
          slug: "task-open",
          title: "Open",
          summary: "",
          body: "",
          status: "planned",
          sortOrder: 2,
          metadata: { priority: "high" }
        },
        {
          id: "task_blocked",
          projectId,
          type: "task",
          key: "T-2",
          slug: "task-blocked",
          title: "Blocked",
          summary: "",
          body: "",
          status: "planned",
          sortOrder: 3,
          metadata: {}
        },
        {
          id: "task_resolved_blockers",
          projectId,
          type: "task",
          key: "T-3",
          slug: "task-resolved",
          title: "Was blocked",
          summary: "",
          body: "",
          status: "planned",
          sortOrder: 4,
          metadata: {}
        },
        {
          id: "task_other",
          projectId,
          type: "task",
          key: "T-4",
          slug: "task-other",
          title: "Other",
          summary: "",
          body: "",
          status: "planned",
          sortOrder: 5,
          metadata: {}
        },
        {
          id: "blocker",
          projectId,
          type: "task",
          key: "T-5",
          slug: "blocker",
          title: "Blocker",
          summary: "",
          body: "",
          status: "planned",
          sortOrder: 6,
          metadata: {}
        },
        {
          id: "blocker_done",
          projectId,
          type: "task",
          key: "T-6",
          slug: "blocker-done",
          title: "Done",
          summary: "",
          body: "",
          status: "done",
          sortOrder: 7,
          metadata: {}
        }
      ],
      relations: [
        {
          id: "l1",
          projectId,
          sourceEntityId: "task_open",
          targetEntityId: "aspect_a",
          type: "affects",
          label: null,
          isPrimary: true,
          metadata: {}
        },
        {
          id: "l2",
          projectId,
          sourceEntityId: "task_blocked",
          targetEntityId: "aspect_a",
          type: "affects",
          label: null,
          isPrimary: true,
          metadata: {}
        },
        {
          id: "l3",
          projectId,
          sourceEntityId: "task_resolved_blockers",
          targetEntityId: "aspect_a",
          type: "implements",
          label: null,
          isPrimary: true,
          metadata: {}
        },
        {
          id: "l4",
          projectId,
          sourceEntityId: "task_other",
          targetEntityId: "aspect_b",
          type: "affects",
          label: null,
          isPrimary: true,
          metadata: {}
        },
        {
          id: "l5",
          projectId,
          sourceEntityId: "blocker",
          targetEntityId: "aspect_b",
          type: "affects",
          label: null,
          isPrimary: true,
          metadata: {}
        },
        {
          id: "l6",
          projectId,
          sourceEntityId: "blocker_done",
          targetEntityId: "aspect_b",
          type: "affects",
          label: null,
          isPrimary: true,
          metadata: {}
        },
        {
          id: "b1",
          projectId,
          sourceEntityId: "task_blocked",
          targetEntityId: "blocker",
          type: "blocked_by",
          label: null,
          isPrimary: false,
          metadata: {}
        },
        {
          id: "b2",
          projectId,
          sourceEntityId: "task_resolved_blockers",
          targetEntityId: "blocker_done",
          type: "blocked_by",
          label: null,
          isPrimary: false,
          metadata: {}
        }
      ],
      tags: [],
      tagAssignments: []
    });

    const plan = compileListQuery(
      {
        projectKey: "PLAN",
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

    const sqlIds = (await executePlan(db, plan)).map((item) => item.id).sort();
    assert.deepEqual(sqlIds, ["task_open", "task_resolved_blockers"].sort());

    const api = createPlanApi(createSqliteEntityStore(db));
    const listed = await api.tasks.list({
      projectKey: "PLAN",
      unblocked: true,
      relatedTo: { id: "aspect_a" }
    });
    assert.deepEqual(
      listed.items.map((item) => item.id).sort(),
      sqlIds
    );

    db.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });
});

describe("archived snapshot exclusion", () => {
  it("hides archived entities and dangling relations from project snapshot", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "projectplaner-archive-"));
    const dbPath = path.join(dir, "test.db");
    const db = createDatabase(dbPath);
    const projectId = "proj_archive_test";

    await importGenericPlan(db, {
      project: {
        id: projectId,
        key: "PLAN",
        title: "Archive Test",
        description: ""
      },
      entities: [
        {
          id: "aspect_live",
          projectId,
          type: "aspect",
          key: null,
          slug: "live",
          title: "Live",
          summary: "",
          body: "",
          status: "planned",
          sortOrder: 0,
          metadata: {}
        },
        {
          id: "aspect_archived",
          projectId,
          type: "aspect",
          key: null,
          slug: "archived",
          title: "Archived",
          summary: "",
          body: "",
          status: "archived",
          sortOrder: 1,
          metadata: {}
        }
      ],
      relations: [
        {
          id: "rel_live_archived",
          projectId,
          sourceEntityId: "aspect_live",
          targetEntityId: "aspect_archived",
          type: "related_to",
          label: null,
          isPrimary: false,
          metadata: {}
        }
      ],
      tags: [],
      tagAssignments: []
    });

    const { getEntity, getProjectSnapshot, listEntities } = await import("./repository");

    const listed = await listEntities(db, { projectKey: "PLAN" });
    assert.deepEqual(
      listed.map((item) => item.id),
      ["aspect_live"]
    );

    const withArchived = await listEntities(db, { projectKey: "PLAN", includeArchived: true });
    assert.equal(withArchived.length, 2);

    const snapshot = await getProjectSnapshot(db, "PLAN");
    assert.ok(snapshot);
    assert.deepEqual(
      snapshot.nodes.map((node) => node.id),
      ["aspect_live"]
    );
    assert.equal(snapshot.relations.length, 0);
    assert.equal(snapshot.entityRelations.length, 0);

    const archived = await getEntity(db, "aspect_archived");
    assert.equal(archived?.status, "archived");

    db.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });
});
