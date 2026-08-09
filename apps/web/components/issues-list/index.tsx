import Link from "next/link";
import { getPrimaryTaskLink, type ProjectPlanSnapshot, type Task, type TaskLink } from "@projectplaner/core";
import { Badge, ToolbarLink } from "../ui";
import { formatEntityType, formatStatus } from "../../lib/entity-label";
import { projectPaths } from "../../lib/project-paths";

type TargetRef = {
  id: string;
  type: "aspect" | "feature";
  key: string | null;
  title: string;
};

type IssueGroup = {
  key: string;
  target: TargetRef | null;
  tasks: Task[];
};

function resolveTarget(link: TaskLink, snapshot: ProjectPlanSnapshot): TargetRef | null {
  if (link.targetType === "feature") {
    const feature = snapshot.features.find((item) => item.id === link.targetId);
    if (!feature) {
      return null;
    }
    return { id: feature.id, type: "feature", key: feature.key, title: feature.title };
  }

  const node = snapshot.nodes.find((item) => item.id === link.targetId);
  if (!node) {
    return null;
  }
  return { id: node.id, type: "aspect", key: null, title: node.title };
}

function targetLabel(target: TargetRef): string {
  const type = formatEntityType(target.type);
  return target.key ? `${type} · ${target.key} · ${target.title}` : `${type} · ${target.title}`;
}

function buildGroups(snapshot: ProjectPlanSnapshot): IssueGroup[] {
  const byTarget = new Map<string, IssueGroup>();
  const unlinked: Task[] = [];

  for (const task of snapshot.tasks) {
    const primary = getPrimaryTaskLink(task, snapshot);
    if (!primary) {
      unlinked.push(task);
      continue;
    }

    const target = resolveTarget(primary, snapshot);
    if (!target) {
      unlinked.push(task);
      continue;
    }

    const existing = byTarget.get(target.id);
    if (existing) {
      existing.tasks.push(task);
    } else {
      byTarget.set(target.id, { key: target.id, target, tasks: [task] });
    }
  }

  const groups = [...byTarget.values()].sort((a, b) => {
    const left = a.target ? targetLabel(a.target) : "";
    const right = b.target ? targetLabel(b.target) : "";
    return left.localeCompare(right);
  });

  for (const group of groups) {
    group.tasks.sort((a, b) => a.key.localeCompare(b.key) || a.sortOrder - b.sortOrder);
  }

  unlinked.sort((a, b) => a.key.localeCompare(b.key) || a.sortOrder - b.sortOrder);
  if (unlinked.length > 0) {
    groups.push({ key: "unlinked", target: null, tasks: unlinked });
  }

  return groups;
}

export function IssuesList({ snapshot }: { snapshot: ProjectPlanSnapshot }) {
  const projectKey = snapshot.project.key;
  const groups = buildGroups(snapshot);
  const total = snapshot.tasks.length;

  return (
    <section className="flex h-full min-h-0 flex-col overflow-auto bg-[#f8faf9] p-4">
      <div className="text-sm font-medium text-zinc-900">Issues</div>
      <p className="mt-1 text-xs text-muted-foreground">
        {total} task{total === 1 ? "" : "s"} grouped by primary Aspect/Feature link.
      </p>

      {groups.length === 0 ? (
        <div className="mt-4 flex flex-1 items-start border border-dashed border-zinc-300 bg-white px-3 py-6">
          <p className="text-sm text-muted-foreground">No tasks in this project.</p>
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          {groups.map((group) => (
            <section key={group.key} className="rounded-md border border-border bg-white p-3">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {group.target ? targetLabel(group.target) : "Unlinked"}
                  <span className="ml-2 font-normal normal-case text-zinc-500">({group.tasks.length})</span>
                </h2>
                {group.target ? (
                  <ToolbarLink href={projectPaths.graph(projectKey, group.target.id)} size="xs">
                    Open graph
                  </ToolbarLink>
                ) : null}
              </div>

              <ul className="space-y-2">
                {group.tasks.map((task) => {
                  const primary = getPrimaryTaskLink(task, snapshot);
                  const target = primary ? resolveTarget(primary, snapshot) : null;

                  return (
                    <li key={task.id} className="rounded-md border border-border px-2.5 py-2">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0">
                          <Link
                            className="font-medium text-teal-800 hover:underline"
                            href={projectPaths.entity(projectKey, task.id)}
                          >
                            {task.key} · {task.title}
                          </Link>
                          <div className="mt-1 text-xs text-muted-foreground">
                            {target ? (
                              <>
                                Affects{" "}
                                <Link
                                  className="text-teal-800 hover:underline"
                                  href={projectPaths.graph(projectKey, target.id)}
                                >
                                  {targetLabel(target)}
                                </Link>
                              </>
                            ) : (
                              "No primary Aspect/Feature link"
                            )}
                          </div>
                        </div>
                        <Badge>{formatStatus(task.status)}</Badge>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </section>
  );
}
