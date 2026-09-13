"use client";

import { useState, type FormEvent } from "react";
import type { AgentProfile } from "@projectplaner/core";
import { Button } from "../ui";

type WorkflowOption = { id: string; key: string | null; title: string };

export function AgentConfiguration({
  agentId,
  projectKey,
  profile,
  availableWorkflows,
  registeredCapabilities
}: {
  agentId: string;
  projectKey: string;
  profile: AgentProfile;
  availableWorkflows: WorkflowOption[];
  registeredCapabilities: string[];
}) {
  const [assignedWorkflowIds, setAssignedWorkflowIds] = useState(profile.assignedWorkflowIds);
  const [enabledCapabilities, setEnabledCapabilities] = useState(profile.registeredCapabilities);
  const [memoryEnabled, setMemoryEnabled] = useState(profile.memoryPolicy.enabled);
  const [memoryScope, setMemoryScope] = useState(profile.memoryPolicy.scope);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  function toggle(values: string[], value: string, set: (next: string[]) => void) {
    set(values.includes(value) ? values.filter(item => item !== value) : [...values, value]);
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/agents/${encodeURIComponent(agentId)}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          projectKey,
          assignedWorkflowIds,
          registeredCapabilities: enabledCapabilities,
          contextPolicy: { memoryEnabled },
          memoryPolicy: { enabled: memoryEnabled, scope: memoryScope }
        })
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(typeof result.error === "string" ? result.error : "Could not save agent configuration.");
      setMessage("Saved. New runs use these explicit permissions.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save agent configuration.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={save} className="space-y-4 rounded-md border border-amber-200 bg-amber-50/40 p-4">
      <div>
        <h2 className="text-xs font-semibold uppercase tracking-wide text-amber-900">Runtime access</h2>
        <p className="mt-1 text-xs text-amber-950/75">Expertise is descriptive. Only the checked workflows and registered capabilities can execute.</p>
      </div>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-zinc-800">Assigned workflows</legend>
        {availableWorkflows.length ? availableWorkflows.map(workflow => (
          <label key={workflow.id} className="flex items-start gap-2 text-sm text-zinc-700">
            <input
              type="checkbox"
              checked={assignedWorkflowIds.includes(workflow.id) || (workflow.key !== null && assignedWorkflowIds.includes(workflow.key))}
              onChange={() => {
                const keys = [workflow.id, ...(workflow.key ? [workflow.key] : [])];
                const checked = keys.some(key => assignedWorkflowIds.includes(key));
                setAssignedWorkflowIds(checked
                  ? assignedWorkflowIds.filter(key => !keys.includes(key))
                  : [...assignedWorkflowIds, workflow.key ?? workflow.id]);
              }}
              className="mt-1"
            />
            <span>{workflow.title}<span className="ml-1 font-mono text-xs text-muted-foreground">({workflow.key ?? workflow.id})</span></span>
          </label>
        )) : <p className="text-xs text-muted-foreground">No workflows are seeded for this project.</p>}
      </fieldset>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-zinc-800">Registered capabilities</legend>
        {registeredCapabilities.map(capability => (
          <label key={capability} className="flex items-center gap-2 text-sm text-zinc-700">
            <input
              type="checkbox"
              checked={enabledCapabilities.includes(capability)}
              onChange={() => toggle(enabledCapabilities, capability, setEnabledCapabilities)}
            />
            <span className="font-mono text-xs">{capability}</span>
          </label>
        ))}
      </fieldset>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-zinc-800">Owned memory</legend>
        <label className="flex items-center gap-2 text-sm text-zinc-700">
          <input type="checkbox" checked={memoryEnabled} onChange={event => setMemoryEnabled(event.target.checked)} />
          Enable memory retrieval for this agent
        </label>
        <label className="flex items-center gap-2 text-xs text-zinc-700">
          Scope
          <select value={memoryScope} onChange={event => setMemoryScope(event.target.value as AgentProfile["memoryPolicy"]["scope"])} className="h-8 rounded-md border border-input bg-background px-2">
            {(["project", "personal", "agent", "session", "global"] as const).map(scope => <option key={scope} value={scope}>{scope}</option>)}
          </select>
        </label>
      </fieldset>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Save access"}</Button>
        {message ? <span className="text-xs text-muted-foreground">{message}</span> : null}
      </div>
    </form>
  );
}
