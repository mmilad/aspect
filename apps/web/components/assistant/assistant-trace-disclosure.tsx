"use client";

import { useState } from "react";
import type { AssistantTurnTrace } from "@projectplaner/core/assistant";

function duration(trace: AssistantTurnTrace): string | null {
  if (!trace.finishedAt) return null;
  const milliseconds = Date.parse(trace.finishedAt) - Date.parse(trace.startedAt);
  return Number.isFinite(milliseconds) && milliseconds >= 0 ? `${milliseconds} ms` : null;
}

function stepStatusLabel(status: AssistantTurnTrace["steps"][number]["status"]): string {
  return status === "completed" ? "done" : status;
}

export function AssistantTraceDisclosure({ sessionId, workflowRunId }: { sessionId: string; workflowRunId: string }) {
  const [trace, setTrace] = useState<AssistantTurnTrace | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    if (trace || loading) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/assistant/sessions/${encodeURIComponent(sessionId)}/trace?runId=${encodeURIComponent(workflowRunId)}`
      );
      const payload = (await response.json()) as { trace?: AssistantTurnTrace; error?: string };
      if (!response.ok || !payload.trace) {
        throw new Error(payload.error ?? "Could not load Assistant trace.");
      }
      setTrace(payload.trace);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load Assistant trace.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <details className="mt-2 max-w-xl text-xs text-muted-foreground" onToggle={(event) => {
      if (event.currentTarget.open) void load();
    }}>
      <summary className="cursor-pointer select-none">How I handled this</summary>
      <div className="mt-2 space-y-2 rounded-md border border-border bg-muted/30 p-3">
        {loading ? <p>Loading run trace…</p> : null}
        {error ? <p role="alert" className="text-rose-700">{error}</p> : null}
        {trace ? (
          <>
            <div className="flex flex-wrap gap-x-3 gap-y-1 font-medium text-foreground">
              <span>Status: {trace.status}</span>
              {trace.route ? <span>Route: {trace.route}</span> : null}
              {trace.lookupKind ? <span>Lookup: {trace.lookupKind}</span> : null}
              {trace.delegation?.agentId ? <span>Agent: {trace.delegation.agentId}</span> : null}
              {trace.delegation?.status ? <span>Delegation: {trace.delegation.status}</span> : null}
              {duration(trace) ? <span>Duration: {duration(trace)}</span> : null}
            </div>
            <ol className="space-y-1">
              {trace.steps.map((step, index) => (
                <li key={`${step.nodeId}-${step.visit}-${index}`} className="flex gap-2">
                  <span className="w-5 shrink-0 text-right">{index + 1}.</span>
                  <span className="text-foreground">{step.title}</span>
                  <span>({step.type}, {stepStatusLabel(step.status)})</span>
                </li>
              ))}
            </ol>
            {trace.error ? <p className="text-rose-700">Error: {trace.error}</p> : null}
          </>
        ) : null}
      </div>
    </details>
  );
}
