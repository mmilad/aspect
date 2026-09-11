"use client";
import { useEffect, useState } from "react";
import { useRightPane } from "../project-shell/right-pane-context";
export function AgentDebugSelector() {
    const { projectKey, selectedAgentId, setSelectedAgentId, agents } = useRightPane();
    const [items, setItems] = useState(agents);
    useEffect(() => {
        const abort = new AbortController();
        setItems([]);
        fetch(`/api/agents?projectKey=${encodeURIComponent(projectKey)}`, { signal: abort.signal })
            .then(r => r.ok ? r.json() : null)
            .then((v: {
            agents?: typeof items;
        } | null) => {
            if (!abort.signal.aborted)
                setItems(v?.agents ?? []);
        })
            .catch(() => { if (!abort.signal.aborted)
            setItems([]); });
        return () => abort.abort();
    }, [projectKey]);
    return (
      <label className="flex items-center gap-2 text-xs text-muted-foreground">
        <span>Debug agent</span>
        <select
          className="rounded border border-border bg-background px-2 py-1"
          value={selectedAgentId ?? ""}
          onChange={event => setSelectedAgentId(event.target.value || null)}
        >
          <option value="">Assistant</option>
          {items.map(agent => (
            <option key={agent.id} value={agent.id}>
              {agent.name}{agent.role ? ' · ' + agent.role : ''}
            </option>
          ))}
        </select>
      </label>
    );
}
