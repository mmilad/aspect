import type { DatabaseSync } from "node:sqlite";
import type { ProjectPlanSnapshot } from "@projectplaner/core";
import type { TagRow } from "../storage";

export function listTags(
  db: DatabaseSync,
  projectId: string
): ProjectPlanSnapshot["tags"] {
  const rows = db.prepare("SELECT * FROM tags WHERE project_id = ?").all(projectId) as TagRow[];
  return rows.map((tag) => ({
    id: tag.id,
    projectId: tag.project_id,
    slug: tag.slug,
    label: tag.label,
    kind: tag.kind as ProjectPlanSnapshot["tags"][number]["kind"]
  }));
}
