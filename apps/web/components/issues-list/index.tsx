"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  getPrimaryTaskLink,
  getTagsForEntity,
  type ProjectPlanSnapshot,
  type Tag,
  type Task,
  type TaskLink
} from "@projectplaner/core";
import { Badge, Select, ToolbarLink } from "../ui";
import { TagList } from "../entity-chrome";
import { formatEntityType, formatStatus } from "../../lib/entity-label";
import { projectPaths } from "../../lib/project-paths";
import { cn } from "../../lib/utils";

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

const TASK_STATUSES = ["in_planning", "planned", "in_progress", "done", "canceled", "archived"] as const;

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

function buildGroups(tasks: Task[], snapshot: ProjectPlanSnapshot): IssueGroup[] {
  const byTarget = new Map<string, IssueGroup>();
  const unlinked: Task[] = [];

  for (const task of tasks) {
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

function taskStatusValue(task: Task): string {
  return task.status;
}

function matchesStatus(task: Task, statusFilter: string): boolean {
  const status = taskStatusValue(task);
  if (statusFilter === "all") {
    return true;
  }
  if (statusFilter === "open") {
    return status !== "done" && status !== "archived";
  }
  return status === statusFilter;
}

function matchesTags(taskTags: Tag[], selectedTagIds: Set<string>): boolean {
  if (selectedTagIds.size === 0) {
    return true;
  }
  return taskTags.some((tag) => selectedTagIds.has(tag.id));
}

export function IssuesList({ snapshot }: { snapshot: ProjectPlanSnapshot }) {
  const projectKey = snapshot.project.key;
  const total = snapshot.tasks.length;
  const [statusFilter, setStatusFilter] = useState("open");
  const [selectedTagIds, setSelectedTagIds] = useState<Set<string>>(() => new Set());

  const projectTags = useMemo(
    () => [...snapshot.tags].sort((a, b) => a.label.localeCompare(b.label)),
    [snapshot.tags]
  );

  const hasArchived = useMemo(
    () => snapshot.tasks.some((task) => taskStatusValue(task) === "archived"),
    [snapshot.tasks]
  );

  const tagsByTaskId = useMemo(() => {
    const map = new Map<string, Tag[]>();
    for (const task of snapshot.tasks) {
      map.set(task.id, getTagsForEntity({ type: "task", id: task.id }, snapshot));
    }
    return map;
  }, [snapshot]);

  const filteredTasks = useMemo(
    () =>
      snapshot.tasks.filter((task) => {
        if (!matchesStatus(task, statusFilter)) {
          return false;
        }
        return matchesTags(tagsByTaskId.get(task.id) ?? [], selectedTagIds);
      }),
    [snapshot.tasks, statusFilter, selectedTagIds, tagsByTaskId]
  );

  const groups = useMemo(() => buildGroups(filteredTasks, snapshot), [filteredTasks, snapshot]);
  const shown = filteredTasks.length;

  function toggleTag(tagId: string) {
    setSelectedTagIds((prev) => {
      const next = new Set(prev);
      if (next.has(tagId)) {
        next.delete(tagId);
      } else {
        next.add(tagId);
      }
      return next;
    });
  }

  return (
    <section className="flex h-full min-h-0 flex-col overflow-auto bg-[#f8faf9]">
      <div className="border-b border-border bg-white px-4 py-3">
        <div className="text-sm font-medium text-zinc-900">Issues</div>
        <p className="mt-1 text-xs text-muted-foreground">
          Tasks grouped by primary Aspect/Feature link.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Select
            className="w-auto min-w-[8rem] text-xs"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            aria-label="Filter by status"
          >
            <option value="open">Open</option>
            <option value="all">All</option>
            {TASK_STATUSES.map((status) => (
              <option key={status} value={status}>
                {formatStatus(status)}
              </option>
            ))}
            {hasArchived ? <option value="archived">{formatStatus("archived")}</option> : null}
          </Select>
          <span className="text-[11px] text-muted-foreground">
            {shown} shown of {total}
          </span>
        </div>
        {projectTags.length > 0 ? (
          <div className="mt-2 flex flex-wrap gap-1">
            {projectTags.map((tag) => {
              const active = selectedTagIds.has(tag.id);
              return (
                <button
                  key={tag.id}
                  type="button"
                  className={cn(
                    "h-7 rounded-md border px-2 text-xs",
                    active
                      ? "border-teal-700 bg-teal-50 text-teal-900"
                      : "border-border bg-white text-muted-foreground hover:bg-muted"
                  )}
                  onClick={() => toggleTag(tag.id)}
                  aria-pressed={active}
                >
                  {tag.label}
                </button>
              );
            })}
          </div>
        ) : null}
      </div>

      <div className="min-h-0 flex-1 overflow-auto p-4">
        {total === 0 ? (
          <div className="flex flex-1 items-start border border-dashed border-zinc-300 bg-white px-3 py-6">
            <p className="text-sm text-muted-foreground">No tasks in this project.</p>
          </div>
        ) : groups.length === 0 ? (
          <div className="flex flex-1 items-start border border-dashed border-zinc-300 bg-white px-3 py-6">
            <p className="text-sm text-muted-foreground">No tasks match the current filters.</p>
          </div>
        ) : (
          <div className="space-y-3">
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
                    const tags = tagsByTaskId.get(task.id) ?? [];

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
                            <TagList tags={tags} compact empty={null} className="mt-1.5" />
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
      </div>
    </section>
  );
}
