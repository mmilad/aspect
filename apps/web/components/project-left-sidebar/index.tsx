"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CircleDot, FileText, GitFork, ListTodo, Network, Tags, Workflow } from "lucide-react";
import type { EntityType, ProjectNode, ProjectPlanSnapshot } from "@projectplaner/core";
import { Badge } from "../badge";
import { cn } from "../../lib/utils";
import styles from "./style.module.css";

interface ProjectLeftSidebarProps {
  snapshot: ProjectPlanSnapshot;
  activeView: "workspace" | "graph" | "entity" | "workflow";
  activeTypes?: Set<EntityType>;
  entityTypes?: EntityType[];
  centerNode?: ProjectNode;
  recentScopes?: ProjectNode[];
  onSelectTypes?: (types: Set<EntityType>) => void;
  onToggleType?: (type: EntityType) => void;
  onOpenScope?: (id: string) => void;
}

const workTypes: EntityType[] = ["aspect", "feature", "task"];

export function ProjectLeftSidebar({
  snapshot,
  activeView,
  activeTypes,
  entityTypes = [],
  centerNode,
  recentScopes = [],
  onSelectTypes,
  onToggleType,
  onOpenScope
}: ProjectLeftSidebarProps) {
  const router = useRouter();
  const projectHref = `/projects/${snapshot.project.key}`;
  const graphHref = `/projects/${snapshot.project.key}/graph`;
  const [creating, setCreating] = useState(false);
  const [brief, setBrief] = useState("");
  const [composerOpen, setComposerOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const flows = useMemo(
    () => snapshot.nodes.filter((node) => node.type === "flow").sort((a, b) => a.title.localeCompare(b.title)),
    [snapshot.nodes]
  );

  async function createWorkflow() {
    const text = brief.trim();
    if (!text) {
      setError("Describe the workflow first.");
      return;
    }
    setCreating(true);
    setError(null);
    try {
      const response = await fetch("/api/workflows", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          projectKey: snapshot.project.key,
          title: text.slice(0, 80),
          brief: text,
          targetEntityId: centerNode?.id
        })
      });
      const payload = (await response.json()) as { entity?: { id: string }; error?: string };
      if (!response.ok || !payload.entity) {
        throw new Error(payload.error ?? "Could not create workflow.");
      }
      setBrief("");
      setComposerOpen(false);
      router.push(`/projects/${snapshot.project.key}/flows/${payload.entity.id}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create workflow.");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className={styles.sidebar}>
      <section className={styles.section}>
        <div className={styles.heading}>Views</div>
        <nav className={styles.nav} aria-label="Project views">
          <Link className={cn(styles.link, activeView === "workspace" && styles.activeLink)} href={projectHref}>
            <span className="inline-flex items-center gap-2">
              <Network className="h-4 w-4" />
              Workspace
            </span>
          </Link>
          <Link className={cn(styles.link, activeView === "graph" && styles.activeLink)} href={graphHref}>
            <span className="inline-flex items-center gap-2">
              <GitFork className="h-4 w-4" />
              Graph
            </span>
          </Link>
          <div className={styles.link}>
            <span className="inline-flex items-center gap-2 text-muted-foreground">
              <ListTodo className="h-4 w-4" />
              Tasks
            </span>
            <Badge>{snapshot.tasks.length}</Badge>
          </div>
          <div className={styles.link}>
            <span className="inline-flex items-center gap-2 text-muted-foreground">
              <FileText className="h-4 w-4" />
              Features
            </span>
            <Badge>{snapshot.features.length}</Badge>
          </div>
        </nav>
      </section>

      <section className={styles.section}>
        <div className={styles.heading}>Workflows</div>
        <div className="mb-2 grid gap-1">
          {flows.length === 0 ? (
            <p className="px-1 text-xs text-muted-foreground">No flow entities yet.</p>
          ) : (
            flows.slice(0, 8).map((flow) => (
              <Link
                key={flow.id}
                href={`/projects/${snapshot.project.key}/flows/${flow.id}`}
                className={cn(styles.scopeItem, activeView === "workflow" && centerNode?.id === flow.id && styles.activeLink)}
                title={flow.title}
              >
                <span className="inline-flex min-w-0 items-center gap-2">
                  <Workflow className="h-3.5 w-3.5 shrink-0 text-indigo-600" />
                  <span className="truncate">{flow.title}</span>
                </span>
              </Link>
            ))
          )}
        </div>
        {composerOpen ? (
          <div className="space-y-2 rounded-md border border-indigo-200 bg-indigo-50/50 p-2">
            <textarea
              className="min-h-16 w-full rounded-md border border-indigo-200 bg-white px-2 py-1.5 text-xs"
              placeholder="Explain what this workflow should do…"
              value={brief}
              onChange={(event) => setBrief(event.target.value)}
            />
            {error ? <p className="text-[11px] text-rose-700">{error}</p> : null}
            <div className="flex gap-1">
              <button
                type="button"
                disabled={creating}
                className="rounded-md bg-indigo-700 px-2 py-1 text-[11px] font-medium text-white hover:bg-indigo-800 disabled:opacity-60"
                onClick={() => void createWorkflow()}
              >
                {creating ? "Creating…" : "Create flow"}
              </button>
              <button
                type="button"
                className="rounded-md border border-border bg-white px-2 py-1 text-[11px] hover:bg-muted"
                onClick={() => {
                  setComposerOpen(false);
                  setError(null);
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            className="w-full rounded-md border border-dashed border-indigo-300 px-2 py-1.5 text-left text-xs text-indigo-900 hover:bg-indigo-50"
            onClick={() => setComposerOpen(true)}
          >
            + New workflow from brief
          </button>
        )}
      </section>

      {activeTypes && onSelectTypes && onToggleType ? (
        <section className={styles.section}>
          <div className={styles.heading}>Graph Filters</div>
          <div className={styles.filterGrid}>
            <button className="h-7 rounded-md border border-border bg-white px-2 text-xs hover:bg-muted" onClick={() => onSelectTypes(new Set(entityTypes))}>
              All
            </button>
            <button className="h-7 rounded-md border border-border bg-white px-2 text-xs hover:bg-muted" onClick={() => onSelectTypes(new Set(workTypes))}>
              Work
            </button>
            {entityTypes.map((type) => {
              const active = activeTypes.has(type);
              return (
                <button
                  key={type}
                  className={cn(
                    "h-7 rounded-md border px-2 text-xs capitalize",
                    active ? "border-teal-700 bg-teal-50 text-teal-900" : "border-border bg-white text-muted-foreground hover:bg-muted"
                  )}
                  onClick={() => onToggleType(type)}
                >
                  {type.replace("_", " ")}
                </button>
              );
            })}
          </div>
        </section>
      ) : null}

      <section className={styles.section}>
        <div className={styles.heading}>Scope</div>
        {centerNode ? (
          <button className={styles.scopeItem} title={centerNode.path} onClick={() => onOpenScope?.(centerNode.id)}>
            <span className="inline-flex min-w-0 items-center gap-2">
              <CircleDot className="h-3.5 w-3.5 shrink-0 text-teal-700" />
              <span className="truncate">{centerNode.title}</span>
            </span>
          </button>
        ) : null}
        <div className="mt-2 grid gap-1">
          {recentScopes.slice(0, 5).map((scope) => (
            <button key={scope.id} className={styles.scopeItem} title={scope.path} onClick={() => onOpenScope?.(scope.id)}>
              {scope.title}
            </button>
          ))}
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.heading}>Inventory</div>
        <div className="grid gap-2 text-xs text-muted-foreground">
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-2">
              <Tags className="h-3.5 w-3.5" />
              Tags
            </span>
            <Badge>{snapshot.tags.length}</Badge>
          </div>
          <div className="flex items-center justify-between">
            <span>Draft plans</span>
            <Badge>{snapshot.draftPlans.length}</Badge>
          </div>
        </div>
      </section>
    </div>
  );
}
