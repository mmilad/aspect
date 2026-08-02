import { selfPlanningSeed, type ProjectPlanSnapshot } from "@projectplaner/core";
import type { DatabaseSync } from "node:sqlite";

function parseJson<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function run(db: DatabaseSync, sql: string, values: (string | number | null)[] = []): void {
  db.prepare(sql).run(...values);
}

export async function seedSelfPlanningProject(db: DatabaseSync): Promise<void> {
  run(db, "DELETE FROM projects WHERE id = ?", [selfPlanningSeed.project.id]);
  run(db, "INSERT INTO projects (id, key, title, description) VALUES (?, ?, ?, ?)", [
    selfPlanningSeed.project.id,
    selfPlanningSeed.project.key,
    selfPlanningSeed.project.title,
    selfPlanningSeed.project.description
  ]);

  for (const node of selfPlanningSeed.nodes) {
    run(
      db,
      `INSERT OR IGNORE INTO nodes
       (id, project_id, parent_id, type, slug, path, title, summary, body, status, sort_order, metadata_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        node.id,
        node.projectId,
        node.parentId,
        node.type,
        node.slug,
        node.path,
        node.title,
        node.summary,
        node.body,
        node.status,
        node.sortOrder,
        JSON.stringify(node.metadata)
      ]
    );
  }

  for (const relation of selfPlanningSeed.relations) {
    run(
      db,
      `INSERT OR IGNORE INTO relations
       (id, project_id, source_node_id, target_node_id, type, label, metadata_json)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        relation.id,
        relation.projectId,
        relation.sourceNodeId,
        relation.targetNodeId,
        relation.type,
        relation.label,
        JSON.stringify(relation.metadata)
      ]
    );
  }

  for (const draft of selfPlanningSeed.draftPlans) {
    run(
      db,
      `INSERT OR IGNORE INTO draft_plans
       (id, project_id, title, scope_node_id, hypothesis, status, metadata_json)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        draft.id,
        draft.projectId,
        draft.title,
        draft.scopeNodeId,
        draft.hypothesis,
        draft.status,
        JSON.stringify(draft.metadata)
      ]
    );
  }

  for (const change of selfPlanningSeed.draftChanges) {
    run(
      db,
      `INSERT OR IGNORE INTO draft_changes
       (id, draft_plan_id, change_type, target_type, target_id, payload_json)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [change.id, change.draftPlanId, change.changeType, change.targetType, change.targetId, JSON.stringify(change.payload)]
    );
  }

  for (const task of selfPlanningSeed.tasks) {
    run(
      db,
      `INSERT OR IGNORE INTO node_tasks
       (id, node_id, title, status, acceptance_criteria_json, sort_order)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [task.id, task.nodeId, task.title, task.status, JSON.stringify(task.acceptanceCriteria), task.sortOrder]
    );
  }
}

type ProjectRow = { id: string; key: string; title: string; description: string };
type NodeRow = {
  id: string;
  project_id: string;
  parent_id: string | null;
  type: string;
  slug: string;
  path: string;
  title: string;
  summary: string;
  body: string;
  status: string;
  sort_order: number;
  metadata_json: string;
};
type RelationRow = {
  id: string;
  project_id: string;
  source_node_id: string;
  target_node_id: string;
  type: string;
  label: string | null;
  metadata_json: string;
};
type DraftRow = {
  id: string;
  project_id: string;
  title: string;
  scope_node_id: string | null;
  hypothesis: string;
  status: string;
  metadata_json: string;
};
type DraftChangeRow = {
  id: string;
  draft_plan_id: string;
  change_type: string;
  target_type: string;
  target_id: string | null;
  payload_json: string;
};
type TaskRow = {
  id: string;
  node_id: string;
  title: string;
  status: string;
  acceptance_criteria_json: string;
  sort_order: number;
};

export async function getProjectSnapshot(db: DatabaseSync, key = "PLAN"): Promise<ProjectPlanSnapshot | null> {
  const project = db.prepare("SELECT id, key, title, description FROM projects WHERE key = ?").get(key) as
    | ProjectRow
    | undefined;

  if (!project) {
    return null;
  }

  const nodes = db
    .prepare("SELECT * FROM nodes WHERE project_id = ? ORDER BY sort_order ASC")
    .all(project.id) as NodeRow[];
  const relations = db.prepare("SELECT * FROM relations WHERE project_id = ?").all(project.id) as RelationRow[];
  const drafts = db.prepare("SELECT * FROM draft_plans WHERE project_id = ?").all(project.id) as DraftRow[];
  const changes = db
    .prepare(
      `SELECT draft_changes.* FROM draft_changes
       INNER JOIN draft_plans ON draft_plans.id = draft_changes.draft_plan_id
       WHERE draft_plans.project_id = ?`
    )
    .all(project.id) as DraftChangeRow[];
  const tasks = db
    .prepare(
      `SELECT node_tasks.* FROM node_tasks
       INNER JOIN nodes ON nodes.id = node_tasks.node_id
       WHERE nodes.project_id = ?
       ORDER BY node_tasks.sort_order ASC`
    )
    .all(project.id) as TaskRow[];

  return {
    project: {
      id: project.id,
      key: project.key,
      title: project.title,
      description: project.description
    },
    nodes: nodes.map((node) => ({
      id: node.id,
      projectId: node.project_id,
      parentId: node.parent_id,
      type: node.type as ProjectPlanSnapshot["nodes"][number]["type"],
      slug: node.slug,
      path: node.path,
      title: node.title,
      summary: node.summary,
      body: node.body,
      status: node.status as ProjectPlanSnapshot["nodes"][number]["status"],
      sortOrder: node.sort_order,
      metadata: parseJson(node.metadata_json, {})
    })),
    relations: relations.map((relation) => ({
      id: relation.id,
      projectId: relation.project_id,
      sourceNodeId: relation.source_node_id,
      targetNodeId: relation.target_node_id,
      type: relation.type as ProjectPlanSnapshot["relations"][number]["type"],
      label: relation.label,
      metadata: parseJson(relation.metadata_json, {})
    })),
    draftPlans: drafts.map((draft) => ({
      id: draft.id,
      projectId: draft.project_id,
      title: draft.title,
      scopeNodeId: draft.scope_node_id,
      hypothesis: draft.hypothesis,
      status: draft.status as ProjectPlanSnapshot["draftPlans"][number]["status"],
      metadata: parseJson(draft.metadata_json, {})
    })),
    draftChanges: changes.map((change) => ({
      id: change.id,
      draftPlanId: change.draft_plan_id,
      changeType: change.change_type as ProjectPlanSnapshot["draftChanges"][number]["changeType"],
      targetType: change.target_type as ProjectPlanSnapshot["draftChanges"][number]["targetType"],
      targetId: change.target_id,
      payload: parseJson(change.payload_json, {})
    })),
    tasks: tasks.map((task) => ({
      id: task.id,
      nodeId: task.node_id,
      title: task.title,
      status: task.status as ProjectPlanSnapshot["tasks"][number]["status"],
      acceptanceCriteria: parseJson(task.acceptance_criteria_json, []),
      sortOrder: task.sort_order
    }))
  };
}
