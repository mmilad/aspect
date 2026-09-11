"use client";
import { useEffect, useRef, useState } from "react";
import type { AgentRunEvent } from "@projectplaner/core";
import type { AgentMessage } from "./turn-client";
import { MissingRunError, RefreshLoop } from "./refresh-loop";
import { usePageVisible } from "./use-page-visible";

export function useAgentEvents(run: AgentMessage, expanded: boolean) {
  const [events, setEvents] = useState<AgentRunEvent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const saved = useRef<AgentRunEvent[]>([]);
  const loaded = useRef(false);
  const visible = usePageVisible();
  const active = run.status === "running" || run.status === "queued";
  useEffect(() => {
    if (!expanded || !visible || (loaded.current && !active)) return;
    const owner = new RefreshLoop(async signal => {
      const cursor = saved.current.at(-1)?.id;
      const url = '/api/agents/runs/' + encodeURIComponent(run.runId) + '/events' +
        (cursor ? '?after=' + encodeURIComponent(cursor) : '');
      const response = await fetch(url, { signal, cache: "no-store" });
      if (response.status === 404) throw new MissingRunError("Run events not found.");
      if (!response.ok) throw new Error("Could not load persisted events.");
      const text = await response.text();
      const incoming = text.split('\n').filter(line => line.startsWith('data: '))
        .map(line => JSON.parse(line.slice(6)) as AgentRunEvent);
      if (signal.aborted) return false;
      saved.current = [...new Map([...saved.current, ...incoming].map(event => [event.id, event])).values()];
      loaded.current = !active;
      setEvents(saved.current);
      setError(null);
      return active;
    }, err => setError(err instanceof Error ? err.message : "Event replay failed."));
    owner.refresh();
    return () => owner.dispose();
  }, [expanded, visible, run.runId, active, retry]);
  return { events, error, retry: () => {
    loaded.current = false;
    setRetry(value => value + 1);
  } };
}
