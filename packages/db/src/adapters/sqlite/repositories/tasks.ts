import type { DatabaseSync } from "node:sqlite";
import { randomUUID } from "node:crypto";
import { insertEntity, insertGenericRelation, run, slugify } from "../storage/index";

import type { CreateTaskInput } from "../../../contracts/tasks";
export type { CreateTaskInput } from "../../../contracts/tasks";

async function create(db: DatabaseSync, input: CreateTaskInput) {
  const project = db.prepare("SELECT id, key FROM projects WHERE key = ?").get(input.projectKey) as
    | { id: string; key: string }
    | undefined;

  if (!project) {
    throw new Error("Project not found.");
  }

  const title = input.title.trim();
  if (!title) {
    throw new Error("Task title is required.");
  }

  const targetExists =
    input.targetType === "feature"
      ? Boolean(db.prepare("SELECT id FROM features WHERE id = ? AND project_id = ?").get(input.targetId, project.id))
      : Boolean(db.prepare("SELECT id FROM nodes WHERE id = ? AND project_id = ?").get(input.targetId, project.id));

  if (!targetExists) {
    throw new Error("Task target does not exist.");
  }

  const rows = db.prepare("SELECT key FROM tasks WHERE project_id = ?").all(project.id) as { key: string }[];
  const nextNumber =
    rows.reduce((max, row) => {
      const match = row.key.match(/-(\d+)$/);
      return match ? Math.max(max, Number(match[1])) : max;
    }, 0) + 1;
  const id = `task_${randomUUID()}`;
  const key = `${project.key}-${nextNumber}`;
  const status = input.status ?? "planned";

  run(
    db,
    `INSERT INTO tasks
     (id, project_id, key, title, description, status, priority, acceptance_criteria_json, sort_order, metadata_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      project.id,
      key,
      title,
      input.description.trim(),
      status,
      input.priority,
      JSON.stringify(input.acceptanceCriteria.filter(Boolean)),
      nextNumber,
      "{}"
    ]
  );

  run(
    db,
    `INSERT INTO task_links
     (id, task_id, target_type, target_id, type, is_primary)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [`tl_${randomUUID()}`, id, input.targetType, input.targetId, input.linkType, 1]
  );

  insertEntity(db, {
    id,
    projectId: project.id,
    type: "task",
    key,
    slug: slugify(key),
    title,
    summary: input.description.trim(),
    body: input.description.trim(),
    status,
    sortOrder: nextNumber,
    metadata: {
      priority: input.priority,
      acceptanceCriteria: input.acceptanceCriteria.filter(Boolean)
    }
  });
  insertGenericRelation(db, {
    id: `ger_tl_${randomUUID()}`,
    projectId: project.id,
    sourceEntityId: id,
    targetEntityId: input.targetId,
    type: input.linkType,
    label: null,
    isPrimary: true,
    metadata: { createdBy: "createTask", targetType: input.targetType }
  });


  return { id, key };
}

const tasks = {
  create
};

export default tasks;
