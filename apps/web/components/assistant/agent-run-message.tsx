"use client";
import type { AgentMessage } from "./turn-client";
import { useState } from "react";
import { useAgentEvents } from "./use-agent-events";

export function AgentRunMessage({ run: initial }: { run: AgentMessage }) {
  const run = initial;
  const [expanded, setExpanded] = useState(false);
  const { events, error, retry } = useAgentEvents(run, expanded);
  return (
    <article className="space-y-2 rounded-lg border border-teal-200 bg-teal-50/60 p-4">
      {run.task ? <div className="whitespace-pre-wrap border-b pb-3 text-sm"><strong>You</strong><p>{run.task}</p></div> : null}
      <div className="text-xs font-semibold uppercase text-teal-900">Agent response · {run.status}</div>
      <div className="whitespace-pre-wrap text-sm text-zinc-800">
        {run.error ?? (typeof run.result === "string" ? run.result : JSON.stringify(run.result, null, 2))}
      </div>
      <div className="font-mono text-xs text-muted-foreground">Run: {run.runId}</div>
      <details onToggle={event => setExpanded(event.currentTarget.open)}>
        <summary className="cursor-pointer text-xs">Persisted events{expanded ? ` (${events.length})` : ""}</summary>
        {error ? <p role="status">{error} <button type="button" onClick={retry}>Retry</button></p> : null}
        <ol className="mt-2 space-y-1 text-sm">
          {events.map(event => <li key={event.id}>{event.type}: {event.message}</li>)}
        </ol>
      </details>
    </article>
  );
}
