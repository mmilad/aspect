import type { DatabaseSync } from "node:sqlite";
import type { AgentRunEvent } from "@projectplaner/core";

type Row = Record<string, unknown>;
export function createEvent(db: DatabaseSync, event: AgentRunEvent) {
  db.prepare(
    "INSERT INTO agent_run_events (id,run_id,type,message,data_json,created_at) VALUES (?,?,?,?,?,?)"
  ).run(event.id, event.runId, event.type, event.message,
    event.data === undefined ? null : JSON.stringify(event.data), event.createdAt);
  return event;
}

export function listEvents(db: DatabaseSync, runId: string, afterId?: string): AgentRunEvent[] {
  // rowid gives insertion order even when timestamps tie. The cursor is run-scoped.
  // Unknown cursors replay from the start; clients deduplicate by event ID.
  const rows = (afterId
    ? db.prepare(
      'SELECT * FROM agent_run_events WHERE run_id=? AND rowid > ' +
      'COALESCE((SELECT rowid FROM agent_run_events WHERE id=? AND run_id=?), 0) ORDER BY rowid'
    ).all(runId, afterId, runId)
    : db.prepare('SELECT * FROM agent_run_events WHERE run_id=? ORDER BY rowid').all(runId)
  ) as Row[];
  return rows.map(row => ({
    id: row.id as string, runId: row.run_id as string,
    type: row.type as AgentRunEvent['type'], message: row.message as string,
    data: row.data_json ? JSON.parse(row.data_json as string) : undefined,
    createdAt: row.created_at as string
  }));
}
