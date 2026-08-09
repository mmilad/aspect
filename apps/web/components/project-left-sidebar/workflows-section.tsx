"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Workflow } from "lucide-react";
import type { ProjectNode, ProjectPlanSnapshot } from "@projectplaner/core";
import { GhostButton } from "../ui/ghost-button";
import { TextArea } from "../ui/controls";
import { projectPaths } from "../../lib/project-paths";
import type { ProjectView } from "../../lib/project-view";
import { cn } from "../../lib/utils";
import styles from "./style.module.css";

interface WorkflowsSectionProps {
  snapshot: ProjectPlanSnapshot;
  activeView: ProjectView;
  centerNode?: ProjectNode;
}

export function WorkflowsSection({ snapshot, activeView, centerNode }: WorkflowsSectionProps) {
  const router = useRouter();
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
      router.push(projectPaths.flow(snapshot.project.key, payload.entity.id));
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create workflow.");
    } finally {
      setCreating(false);
    }
  }

  return (
    <section className={styles.section}>
      <div className={styles.heading}>Workflows</div>
      <div className="mb-2 grid max-h-48 gap-1 overflow-y-auto pr-0.5">
        {flows.length === 0 ? (
          <p className="px-1 text-xs text-muted-foreground">No flow entities yet.</p>
        ) : (
          flows.map((flow) => (
            <Link
              key={flow.id}
              href={projectPaths.flow(snapshot.project.key, flow.id)}
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
          <TextArea
            className="min-h-16 text-xs"
            placeholder="Explain what this workflow should do…"
            value={brief}
            onChange={(event) => setBrief(event.target.value)}
          />
          {error ? <p className="text-[11px] text-rose-700">{error}</p> : null}
          <div className="flex gap-1">
            <GhostButton size="xs" tone="workflow" disabled={creating} onClick={() => void createWorkflow()}>
              {creating ? "Creating…" : "Create flow"}
            </GhostButton>
            <GhostButton
              size="xs"
              onClick={() => {
                setComposerOpen(false);
                setError(null);
              }}
            >
              Cancel
            </GhostButton>
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
  );
}
