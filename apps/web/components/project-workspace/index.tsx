import Link from "next/link";
import {
  Columns3,
  GitFork,
  LayoutDashboard,
  ListTodo,
  Workflow
} from "lucide-react";
import type { ProjectNode, ProjectPlanSnapshot } from "@projectplaner/core";
import type { ProjectStats, ProjectStatsBucket } from "@projectplaner/db";
import { EntityBadges, Field } from "../ui";
import { formatEntityType, formatStatus } from "../../lib/entity-label";
import { projectPaths } from "../../lib/project-paths";

const TYPE_ROWS: Array<{ type: string; label: string }> = [
  { type: "aspect", label: "Aspects" },
  { type: "feature", label: "Features" },
  { type: "task", label: "Tasks" },
  { type: "flow", label: "Flows" },
  { type: "decision", label: "Decisions" },
  { type: "question", label: "Questions" },
  { type: "entry", label: "Entries" },
  { type: "reference", label: "References" },
  { type: "area", label: "Areas" },
  { type: "surface", label: "Surfaces" },
  { type: "task_group", label: "Task groups" },
  { type: "project", label: "Project roots" }
];

function bucketOrEmpty(bucket?: ProjectStatsBucket): ProjectStatsBucket {
  return bucket ?? { total: 0, planning: 0, inProgress: 0, done: 0, other: 0 };
}

function resolveRootNode(snapshot: ProjectPlanSnapshot): ProjectNode | null {
  const byType = snapshot.nodes.find((node) => node.type === "project");
  if (byType) {
    return byType;
  }
  return snapshot.nodes[0] ?? null;
}

interface ProjectWorkspaceHubProps {
  snapshot: ProjectPlanSnapshot;
  stats: ProjectStats;
}

export function ProjectWorkspaceHub({ snapshot, stats }: ProjectWorkspaceHubProps) {
  const projectKey = snapshot.project.key;
  const root = resolveRootNode(snapshot);
  const rows = TYPE_ROWS.map((row) => ({
    ...row,
    counts: bucketOrEmpty(stats.byType[row.type])
  })).filter((row) => row.counts.total > 0 || ["aspect", "feature", "task", "flow"].includes(row.type));

  const jumps = [
    { href: projectPaths.graph(projectKey), label: "Graph", icon: GitFork },
    { href: projectPaths.issues(projectKey), label: "Issues", icon: ListTodo },
    { href: projectPaths.kanban(projectKey), label: "Kanban", icon: Columns3 },
    { href: projectPaths.workflows(projectKey), label: "Workflows", icon: Workflow }
  ];

  return (
    <section className="flex h-full min-h-0 flex-col gap-4 overflow-auto bg-[#f8faf9] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <LayoutDashboard className="h-4 w-4 shrink-0 text-zinc-700" />
            <h1 className="text-sm font-semibold text-zinc-900">{snapshot.project.title}</h1>
            {root ? (
              <EntityBadges type={root.type} status={root.status} entityKey={snapshot.project.key} />
            ) : (
              <EntityBadges type="project" status="in_progress" entityKey={snapshot.project.key} />
            )}
          </div>
          {snapshot.project.description || root?.summary ? (
            <p className="mt-2 max-w-2xl text-xs text-muted-foreground">
              {snapshot.project.description || root?.summary}
            </p>
          ) : (
            <p className="mt-2 max-w-2xl text-xs text-muted-foreground">
              Operational workspace for {snapshot.project.key}. Archived entities excluded from counts.
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {jumps.map((jump) => (
            <Link
              key={jump.href}
              href={jump.href}
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-white px-2.5 py-1 text-xs font-medium text-zinc-800 hover:bg-muted"
            >
              <jump.icon className="h-3.5 w-3.5" />
              {jump.label}
            </Link>
          ))}
        </div>
      </div>

      {root ? (
        <div className="space-y-3 rounded-md border border-border bg-white p-3">
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Project</div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Type" value={formatEntityType(root.type)} />
            <Field label="Status" value={formatStatus(root.status)} />
          </div>
          {root.body ? (
            <div className="rounded-md border border-border bg-[#f8faf9] p-3 text-sm leading-6 text-zinc-700 whitespace-pre-wrap">
              {root.body}
            </div>
          ) : root.summary && root.summary !== snapshot.project.description ? (
            <p className="text-sm text-zinc-700">{root.summary}</p>
          ) : null}
          <div className="font-mono text-[11px] text-muted-foreground">{root.id}</div>
        </div>
      ) : null}

      <div className="overflow-hidden rounded-md border border-border bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border bg-zinc-50 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">Type</th>
              <th className="px-3 py-2 font-medium tabular-nums">Total</th>
              <th className="px-3 py-2 font-medium tabular-nums">Planning</th>
              <th className="px-3 py-2 font-medium tabular-nums">In progress</th>
              <th className="px-3 py-2 font-medium tabular-nums">Done</th>
              <th className="px-3 py-2 font-medium tabular-nums">Other</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.type} className="border-b border-border last:border-0">
                <td className="px-3 py-2 font-medium text-zinc-900">{row.label}</td>
                <td className="px-3 py-2 tabular-nums text-zinc-800">{row.counts.total}</td>
                <td className="px-3 py-2 tabular-nums text-zinc-700">{row.counts.planning}</td>
                <td className="px-3 py-2 tabular-nums text-zinc-700">{row.counts.inProgress}</td>
                <td className="px-3 py-2 tabular-nums text-zinc-700">{row.counts.done}</td>
                <td className="px-3 py-2 tabular-nums text-zinc-500">{row.counts.other}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="rounded-md border border-border bg-white px-3 py-3">
        <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Workflows</div>
        <div className="mt-1 flex items-baseline gap-2">
          <span className="text-2xl font-semibold tabular-nums text-zinc-900">{stats.workflowDefs}</span>
          <span className="text-xs text-muted-foreground">workflow definitions</span>
          <Link
            href={projectPaths.workflows(projectKey)}
            className="ml-auto text-xs font-medium text-teal-800 hover:underline"
          >
            Open workflows
          </Link>
        </div>
      </div>
    </section>
  );
}
