import { createEvent, listEvents } from "./agent-run-events";
import type { DatabaseSync } from "node:sqlite";
import { isTerminal, terminalEvent, type AgentRun } from "@projectplaner/core";
type Row = Record<string, unknown>;
const json = (value: unknown) => value === undefined ? null : JSON.stringify(value);
function read(row: Row): AgentRun {
    return {
        id: row.id as string,
        agentId: row.agent_id as string,
        projectKey: row.project_key as string,
        task: row.task as string,
        status: row.status as AgentRun["status"],
        workspace: row.workspace_json ? JSON.parse(row.workspace_json as string) : undefined,
        context: row.context_json ? JSON.parse(row.context_json as string) : undefined,
        stepCount: row.step_count as number,
        workflowCallCount: row.workflow_call_count as number,
        result: row.result_json ? JSON.parse(row.result_json as string) : undefined,
        error: (row.error as string | null) ?? undefined,
        startedAt: row.started_at as string,
        finishedAt: (row.finished_at as string | null) ?? undefined
    };
}
function create(db: DatabaseSync, run: AgentRun) {
    db.prepare(`INSERT INTO agent_runs (id,agent_id,project_key,task,status,workspace_json,context_json,step_count,workflow_call_count,result_json,error,started_at,finished_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(run.id, run.agentId, run.projectKey, run.task, run.status, json(run.workspace), json(run.context), run.stepCount, run.workflowCallCount, json(run.result), run.error ?? null, run.startedAt, run.finishedAt ?? null);
    return run;
}
function get(db: DatabaseSync, id: string) {
    const row = db.prepare("SELECT * FROM agent_runs WHERE id = ?").get(id) as Row | undefined;
    return row ? read(row) : null;
}
function update(db: DatabaseSync, run: AgentRun) {
    const current = get(db, run.id);
    if (!current) throw new Error("Agent run not found.");
    if (isTerminal(current.status)) return current;
    db.prepare(`UPDATE agent_runs SET status=?, workspace_json=?, context_json=?, step_count=?, workflow_call_count=?, result_json=?, error=?, finished_at=? WHERE id=?`).run(run.status, json(run.workspace), json(run.context), run.stepCount, run.workflowCallCount, json(run.result), run.error ?? null, run.finishedAt ?? null, run.id);
    return run;
}
function list(db: DatabaseSync, agentId: string, projectKey?: string) {
    const rows = (projectKey ? db.prepare("SELECT * FROM agent_runs WHERE agent_id=? AND project_key=? ORDER BY started_at DESC") : db.prepare("SELECT * FROM agent_runs WHERE agent_id=? ORDER BY started_at DESC")).all(...(projectKey ? [
        agentId, projectKey
    ] : [
        agentId
    ])) as Row[];
    return rows.map(read);
}
function finish(db: DatabaseSync, run: AgentRun): AgentRun {
    if (!isTerminal(run.status))
        throw new Error("Expected terminal agent status.");
    db.exec("SAVEPOINT agent_terminal");
    try {
        const current = get(db, run.id);
        if (!current)
            throw new Error("Agent run not found.");
        if (isTerminal(current.status)) {
            db.exec("RELEASE agent_terminal");
            return current;
        }
        update(db, run);
        createEvent(db, terminalEvent(run));
        db.exec("RELEASE agent_terminal");
        return run;
    }
    catch (error) {
        db.exec("ROLLBACK TO agent_terminal");
        db.exec("RELEASE agent_terminal");
        throw error;
    }
}
export default {
    create,
    get,
    update,
    finish,
    list,
    createEvent,
    listEvents
};
