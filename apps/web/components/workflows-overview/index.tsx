"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Play, Workflow } from "lucide-react";
import {
  isWorkflowPresetKind,
  resolveWorkflowKind,
  workflowPresetKinds,
  type ProjectNode,
  type ProjectPlanSnapshot,
  type WorkflowPresetKind
} from "@projectplaner/core";
import { Badge, GhostButton, Select, TextArea, TextInput } from "../ui";
import { RunWorkflowDialog } from "../workflow-run-dialog";
import { projectPaths } from "../../lib/project-paths";

interface WorkflowsOverviewProps {
  snapshot: ProjectPlanSnapshot;
}

function flowStatuses(flows: ProjectNode[]): string[] {
  return [...new Set(flows.map((flow) => flow.status))].sort((a, b) => a.localeCompare(b));
}

const KIND_LABELS: Record<WorkflowPresetKind, string> = {
  mutation: "Graph mutations",
  builder: "Builders",
  housekeeping: "Housekeeping",
  orientation: "Orientation",
  user: "Project workflows"
};

const KIND_ORDER: WorkflowPresetKind[] = [
  "builder",
  "housekeeping",
  "orientation",
  "user",
  "mutation"
];

function flowKind(flow: ProjectNode): WorkflowPresetKind {
  return resolveWorkflowKind({
    presetKey: flow.metadata.presetKey,
    kind: flow.metadata.presetKind
  });
}

function FlowRow({
  flow,
  projectKey,
  onRun,
  onOpen
}: {
  flow: ProjectNode;
  projectKey: string;
  onRun: (flow: ProjectNode) => void;
  onOpen: (flow: ProjectNode) => void;
}) {
  return (
    <li className="flex flex-wrap items-start gap-2 px-3 py-2.5 hover:bg-zinc-50/80">
      <Workflow className="mt-0.5 h-3.5 w-3.5 shrink-0 text-indigo-600" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={projectPaths.flow(projectKey, flow.id)}
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
        <GhostButton size="xs" onClick={() => onRun(flow)}>
          <span className="inline-flex items-center gap-1">
            <Play className="h-3 w-3" />
            Run
          </span>
        </GhostButton>
        <GhostButton size="xs" tone="workflow" onClick={() => onOpen(flow)}>
          Open
        </GhostButton>
      </div>
    </li>
  );
}

export function WorkflowsOverview({ snapshot }: WorkflowsOverviewProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [kindFilter, setKindFilter] = useState<"all" | WorkflowPresetKind>("all");
  const [mutationsExpanded, setMutationsExpanded] = useState(false);
  const [composerOpen, setComposerOpen] = useState(false);
  const [brief, setBrief] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [runTarget, setRunTarget] = useState<ProjectNode | null>(null);
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
      const kind = flowKind(flow);
      if (kindFilter !== "all" && kind !== kindFilter) {
        return false;
      }
      if (!q) {
        return true;
      }
      const presetKey = typeof flow.metadata.presetKey === "string" ? flow.metadata.presetKey : "";
      const haystack =
        `${flow.title} ${flow.summary ?? ""} ${flow.slug ?? ""} ${flow.id} ${presetKey} ${KIND_LABELS[kind]}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [flows, query, statusFilter, kindFilter]);

  const grouped = useMemo(() => {
    const groups = Object.fromEntries(workflowPresetKinds.map((kind) => [kind, [] as ProjectNode[]])) as Record<
      WorkflowPresetKind,
      ProjectNode[]
    >;
    for (const flow of filtered) {
      groups[flowKind(flow)].push(flow);
    }
    return groups;
  }, [filtered]);

  const visibleKinds = KIND_ORDER.filter((kind) => grouped[kind].length > 0);
  const mutationForcedOpen =
    kindFilter === "mutation" || (query.trim().length > 0 && grouped.mutation.length > 0);
  const mutationsOpen = mutationForcedOpen || mutationsExpanded;

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
        <Select
          className="w-auto min-w-[10rem] text-xs"
          value={kindFilter}
          onChange={(event) => {
            const value = event.target.value;
            setKindFilter(value === "all" || isWorkflowPresetKind(value) ? value : "all");
          }}
          aria-label="Filter by kind"
        >
          <option value="all">All kinds</option>
          {KIND_ORDER.map((kind) => (
            <option key={kind} value={kind}>
              {KIND_LABELS[kind]}
            </option>
          ))}
        </Select>
        <span className="text-[11px] text-muted-foreground">
          {filtered.length} shown
          {statusFilter !== "all" || kindFilter !== "all" || query.trim() ? ` of ${flows.length}` : ""}
        </span>
      </div>

      {runMessage ? (
        <div className="border-b border-border bg-zinc-50 px-3 py-1.5 text-[11px] text-zinc-700">{runMessage}</div>
      ) : null}

      <div className="min-h-0 flex-1 overflow-auto">
        {filtered.length === 0 ? (
          <p className="px-3 py-6 text-sm text-muted-foreground">
            {flows.length === 0
              ? "No flow entities yet. Create one from a brief."
              : "No workflows match the current filter."}
          </p>
        ) : (
          <div>
            {visibleKinds.map((kind) => {
              const items = grouped[kind];
              const heading = (
                <div className="flex items-center gap-2 px-3 py-2">
                  <div className="text-[10px] font-semibold uppercase tracking-wide text-zinc-600">
                    {KIND_LABELS[kind]}
                  </div>
                  <Badge className="h-5">{items.length}</Badge>
                </div>
              );
              const list = (
                <ul className="divide-y divide-border border-t border-border">
                  {items.map((flow) => (
                    <FlowRow
                      key={flow.id}
                      flow={flow}
                      projectKey={snapshot.project.key}
                      onRun={(next) => {
                        setRunMessage(null);
                        setRunTarget(next);
                      }}
                      onOpen={(next) => router.push(projectPaths.flow(snapshot.project.key, next.id))}
                    />
                  ))}
                </ul>
              );
              if (kind !== "mutation") {
                return (
                  <section key={kind} className="border-b border-border">
                    {heading}
                    {list}
                  </section>
                );
              }
              return (
                <details
                  key={kind}
                  className="border-b border-border"
                  open={mutationsOpen}
                  onToggle={(event) => {
                    if (mutationForcedOpen) {
                      return;
                    }
                    setMutationsExpanded(event.currentTarget.open);
                  }}
                >
                  <summary className="cursor-pointer list-none [&::-webkit-details-marker]:hidden">
                    {heading}
                    <p className="px-3 pb-2 text-[11px] text-muted-foreground">
                      {mutationsOpen
                        ? "Create/update/archive packs for graph writes."
                        : "CRUD clones — expand to run one."}
                    </p>
                  </summary>
                  {list}
                </details>
              );
            })}
          </div>
        )}
      </div>
      {runTarget ? (
        <RunWorkflowDialog
          flowId={runTarget.id}
          flowTitle={runTarget.title}
          onClose={() => setRunTarget(null)}
          onRan={(summary) => setRunMessage(summary)}
        />
      ) : null}
    </div>
  );
}
