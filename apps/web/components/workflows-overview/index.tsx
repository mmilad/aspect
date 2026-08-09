"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Play, Workflow } from "lucide-react";
import type { ProjectNode, ProjectPlanSnapshot } from "@projectplaner/core";
import { Badge, GhostButton, Select, TextArea, TextInput } from "../ui";
import { projectPaths } from "../../lib/project-paths";

interface WorkflowsOverviewProps {
  snapshot: ProjectPlanSnapshot;
}

function flowStatuses(flows: ProjectNode[]): string[] {
  return [...new Set(flows.map((flow) => flow.status))].sort((a, b) => a.localeCompare(b));
}

export function WorkflowsOverview({ snapshot }: WorkflowsOverviewProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [composerOpen, setComposerOpen] = useState(false);
  const [brief, setBrief] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [runningId, setRunningId] = useState<string | null>(null);
  const [runMessage, setRunMessage] = useState<string | null>(null);

  const flows = useMemo(
    () => snapshot.nodes.filter((node) => node.type === "flow").sort((a, b) => a.title.localeCompare(b.title)),
    [snapshot.nodes]
  );

  const statuses = useMemo(() => flowStatuses(flows), [flows]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return flows.filter((flow) => {
      if (statusFilter !== "all" && flow.status !== statusFilter) {
        return false;
      }
      if (!q) {
        return true;
      }
      const haystack = `${flow.title} ${flow.summary ?? ""} ${flow.slug ?? ""} ${flow.id}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [flows, query, statusFilter]);

  async function createWorkflow() {
    const text = brief.trim();
    if (!text) {
      setCreateError("Describe the workflow first.");
      return;
    }
    setCreating(true);
    setCreateError(null);
    try {
      const response = await fetch("/api/workflows", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          projectKey: snapshot.project.key,
          title: text.slice(0, 80),
          brief: text
        })
      });
      const payload = (await response.json()) as { entity?: { id: string }; error?: string };
      if (!response.ok || !payload.entity) {
        throw new Error(payload.error ?? "Could not create workflow.");
      }
      setBrief("");
      setComposerOpen(false);
      router.push(projectPaths.flow(snapshot.project.key, payload.entity.id));
      router.refresh();
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Could not create workflow.");
    } finally {
      setCreating(false);
    }
  }

  async function runWorkflow(flow: ProjectNode) {
    setRunningId(flow.id);
    setRunMessage(null);
    try {
      const response = await fetch("/api/workflows/run", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          id: flow.id,
          projectKey: snapshot.project.key,
          goal: flow.title,
          bag: {
            title: flow.title,
            reason: `Workflow run of ${flow.title}`
          }
        })
      });
      const payload = (await response.json()) as {
        run?: { id: string; status?: string };
        step?: { kind?: string };
        error?: string;
        note?: string;
      };
      if (!response.ok || !payload.run) {
        throw new Error(payload.error ?? "Run failed.");
      }
      const kind = payload.step?.kind ?? payload.run.status ?? "running";
      setRunMessage(
        [`${flow.title}: run ${payload.run.id} (${kind})`, payload.note].filter(Boolean).join(" — ")
      );
    } catch (err) {
      setRunMessage(err instanceof Error ? err.message : "Run failed.");
    } finally {
      setRunningId(null);
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-white">
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2">
        <Badge tone="flow">workflows</Badge>
        <div className="text-sm font-medium text-zinc-900">Project workflows</div>
        <Badge>{flows.length}</Badge>
        <div className="ml-auto">
          <GhostButton
            size="xs"
            tone="workflow"
            active={composerOpen}
            onClick={() => {
              setComposerOpen((open) => !open);
              setCreateError(null);
            }}
          >
            + New workflow from brief
          </GhostButton>
        </div>
      </div>

      {composerOpen ? (
        <div className="space-y-2 border-b border-indigo-200 bg-indigo-50/40 px-3 py-3">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-indigo-900">New from brief</div>
          <TextArea
            className="min-h-16 text-xs"
            placeholder="Explain what this workflow should do…"
            value={brief}
            onChange={(event) => setBrief(event.target.value)}
          />
          {createError ? <p className="text-[11px] text-rose-700">{createError}</p> : null}
          <div className="flex gap-1">
            <GhostButton size="xs" tone="workflow" disabled={creating} onClick={() => void createWorkflow()}>
              {creating ? "Creating…" : "Create flow"}
            </GhostButton>
            <GhostButton
              size="xs"
              onClick={() => {
                setComposerOpen(false);
                setCreateError(null);
              }}
            >
              Cancel
            </GhostButton>
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2">
        <TextInput
          className="max-w-xs text-xs"
          placeholder="Search title, summary, slug…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          aria-label="Search workflows"
        />
        <Select
          className="w-auto min-w-[8rem] text-xs"
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
          aria-label="Filter by status"
        >
          <option value="all">All statuses</option>
          {statuses.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </Select>
        <span className="text-[11px] text-muted-foreground">
          {filtered.length} shown
          {statusFilter !== "all" || query.trim() ? ` of ${flows.length}` : ""}
        </span>
      </div>

      {runMessage ? (
        <div className="border-b border-border bg-zinc-50 px-3 py-1.5 text-[11px] text-zinc-700">{runMessage}</div>
      ) : null}

      <div className="min-h-0 flex-1 overflow-auto">
        {filtered.length === 0 ? (
          <p className="px-3 py-6 text-sm text-muted-foreground">
            {flows.length === 0 ? "No flow entities yet. Create one from a brief." : "No workflows match the current filter."}
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {filtered.map((flow) => (
              <li key={flow.id} className="flex flex-wrap items-start gap-2 px-3 py-2.5 hover:bg-zinc-50/80">
                <Workflow className="mt-0.5 h-3.5 w-3.5 shrink-0 text-indigo-600" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href={projectPaths.flow(snapshot.project.key, flow.id)}
                      className="truncate text-sm font-medium text-zinc-900 hover:underline"
                    >
                      {flow.title}
                    </Link>
                    <Badge className="h-5">{flow.status}</Badge>
                    {flow.slug ? <span className="font-mono text-[10px] text-muted-foreground">{flow.slug}</span> : null}
                  </div>
                  {flow.summary ? (
                    <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{flow.summary}</p>
                  ) : null}
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <GhostButton size="xs" disabled={runningId === flow.id} onClick={() => void runWorkflow(flow)}>
                    <span className="inline-flex items-center gap-1">
                      <Play className="h-3 w-3" />
                      {runningId === flow.id ? "Running…" : "Run"}
                    </span>
                  </GhostButton>
                  <GhostButton
                    size="xs"
                    tone="workflow"
                    onClick={() => router.push(projectPaths.flow(snapshot.project.key, flow.id))}
                  >
                    Open
                  </GhostButton>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
