"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { readAgentRun, type AgentMessage } from "./turn-client";
import { MissingRunError, RefreshLoop } from "./refresh-loop";
import { usePageVisible } from "./use-page-visible";

const active = (run: AgentMessage) => run.status === "queued" || run.status === "running";
export function useAgentMessages(projectKey: string, agentId: string | null, open: boolean) {
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const rows = useRef<AgentMessage[]>([]);
  const loop = useRef<RefreshLoop | undefined>(undefined);
  const full = useRef(true);
  const visible = usePageVisible();
  const scope = projectKey + ':' + agentId;
  const currentScope = useRef(scope);
  currentScope.current = scope;
  const [loadedScope, setLoadedScope] = useState(scope);

  const refresh = useCallback(() => {
    full.current = true;
    loop.current?.refresh();
  }, []);
  const add = useCallback((message: AgentMessage) => {
    if (message.agentId !== agentId || currentScope.current !== scope) return;
    rows.current = [...rows.current.filter(row => row.runId !== message.runId), message];
    setMessages(rows.current);
  }, [agentId, scope]);

  useEffect(() => {
    rows.current = [];
    setMessages([]);
    setLoadedScope(scope);
    setError(null);
  }, [scope]);

  useEffect(() => {
    if (!agentId || !open || !visible) return;
    full.current = true;
    setLoading(rows.current.length === 0);
    const owner = new RefreshLoop(async signal => {
      let saved: AgentMessage[];
      if (full.current) {
        const url = '/api/agents/' + encodeURIComponent(agentId) + '/runs?projectKey=' + encodeURIComponent(projectKey);
        const response = await fetch(url, { signal, cache: "no-store" });
        if (response.status === 404) throw new MissingRunError("Agent not found.");
        if (!response.ok) throw new Error("Could not load agent history.");
        const payload = await response.json();
        if (!Array.isArray(payload.runs)) throw new Error("Invalid agent history response.");
        saved = payload.runs.map(readAgentRun);
      } else {
        saved = [];
        for (const run of rows.current.filter(active)) {
          const response = await fetch('/api/agents/runs/' + encodeURIComponent(run.runId), { signal, cache: "no-store" });
          if (response.status === 404) throw new MissingRunError("Run not found. Refresh to reload history.");
          if (!response.ok) throw new Error("Could not refresh agent response.");
          saved.push(readAgentRun(await response.json()));
        }
      }
      if (signal.aborted) return false;
      full.current = false;
      rows.current = [...new Map([...rows.current, ...saved].map(run => [run.runId, run])).values()]
        .sort((a, b) => (a.startedAt ?? '').localeCompare(b.startedAt ?? '') || a.runId.localeCompare(b.runId));
      setMessages(rows.current);
      setLoading(false);
      setError(null);
      return rows.current.some(active);
    }, err => {
      setLoading(false);
      setError(err instanceof Error ? err.message : "Could not refresh history.");
    });
    loop.current = owner;
    owner.refresh();
    return () => { owner.dispose(); loop.current = undefined; };
  }, [agentId, projectKey, open, visible]);
  return { messages: loadedScope === scope ? messages : [], add, refresh, error, loading };
}
