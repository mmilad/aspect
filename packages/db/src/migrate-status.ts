import type { DatabaseSync } from "node:sqlite";

/**
 * Idempotent rewrite of legacy statuses onto the locked process/decision/question model.
 * Safe to run on every openDatabase.
 */
export function migrateEntityStatuses(db: DatabaseSync): void {
  // Generic entities (v2)
  db.exec(`
    UPDATE entities
    SET status = CASE
      WHEN type = 'decision' AND status IN ('planned', 'not_implemented', 'in_planning', 'todo') THEN 'open'
      WHEN type = 'decision' AND status IN ('rejected') THEN 'rejected'
      WHEN type = 'question' AND status IN ('planned', 'not_implemented', 'in_planning', 'todo', 'open') THEN 'open'
      WHEN type = 'question' AND status IN ('accepted', 'answered') THEN 'answered'
      WHEN type = 'task' AND status = 'todo' THEN 'planned'
      WHEN type = 'task' AND status IN ('doing', 'blocked', 'review') THEN 'in_progress'
      WHEN status IN ('doing', 'in_work', 'active', 'blocked', 'review') THEN 'in_progress'
      WHEN status IN ('implemented', 'answered') AND type NOT IN ('decision', 'question') THEN 'done'
      WHEN status = 'accepted' AND type NOT IN ('decision', 'question', 'flow') THEN 'done'
      WHEN status = 'accepted' AND type = 'flow' THEN 'done'
      WHEN status = 'not_implemented' THEN 'in_planning'
      WHEN status = 'todo' THEN 'planned'
      WHEN status IN ('cancelled') THEN 'canceled'
      ELSE status
    END
    WHERE status IN (
      'todo', 'doing', 'blocked', 'review', 'in_work', 'active', 'implemented',
      'not_implemented', 'answered', 'accepted', 'cancelled'
    )
       OR (type IN ('decision', 'question') AND status IN ('planned', 'in_planning', 'todo', 'not_implemented'));
  `);

  db.exec(`
    UPDATE entities
    SET status = 'canceled',
        metadata_json = json_set(COALESCE(metadata_json, '{}'), '$.disabled', json('true'))
    WHERE type = 'task'
      AND json_extract(metadata_json, '$.disabled') = 1
      AND status NOT IN ('canceled', 'archived');
  `);

  // Legacy tables (if present)
  try {
    db.exec(`
      UPDATE tasks SET status = CASE status
        WHEN 'todo' THEN 'planned'
        WHEN 'doing' THEN 'in_progress'
        WHEN 'blocked' THEN 'in_progress'
        WHEN 'review' THEN 'in_progress'
        WHEN 'cancelled' THEN 'canceled'
        ELSE status
      END
      WHERE status IN ('todo', 'doing', 'blocked', 'review', 'cancelled');
    `);
  } catch {
    /* table may not exist in some fixtures */
  }

  try {
    db.exec(`
      UPDATE features SET status = CASE status
        WHEN 'in_work' THEN 'in_progress'
        WHEN 'implemented' THEN 'done'
        WHEN 'not_implemented' THEN 'in_planning'
        WHEN 'active' THEN 'in_progress'
        WHEN 'blocked' THEN 'in_progress'
        WHEN 'accepted' THEN 'done'
        ELSE status
      END
      WHERE status IN ('in_work', 'implemented', 'not_implemented', 'active', 'blocked', 'accepted');
    `);
  } catch {
    /* optional */
  }

  try {
    db.exec(`
      UPDATE nodes SET status = CASE
        WHEN type = 'decision' AND status IN ('planned', 'not_implemented', 'in_planning') THEN 'open'
        WHEN type = 'question' AND status IN ('planned', 'not_implemented', 'in_planning', 'accepted') THEN
          CASE WHEN status = 'accepted' THEN 'answered' ELSE 'open' END
        WHEN status IN ('in_work', 'active', 'blocked', 'review') THEN 'in_progress'
        WHEN status IN ('implemented', 'answered') THEN 'done'
        WHEN status = 'accepted' AND type NOT IN ('decision', 'question') THEN 'done'
        WHEN status = 'not_implemented' THEN 'in_planning'
        WHEN status = 'todo' THEN 'planned'
        ELSE status
      END;
    `);
  } catch {
    /* optional */
  }
}
