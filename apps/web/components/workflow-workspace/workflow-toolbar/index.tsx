"use client";

import { Badge, GhostButton, ToolbarLink } from "../../ui";
import { projectPaths } from "../../../lib/project-paths";

interface WorkflowToolbarProps {
  projectKey: string;
  flowId: string;
  flowTitle: string;
  version: number;
  authorOpen: boolean;
  saving: boolean;
  onToggleAuthor: () => void;
  onLoadExample: () => void;
  onLoadNewTask: () => void;
  onResetEmpty: () => void;
  onSave: () => void;
}

export function WorkflowToolbar({
  projectKey,
  flowId,
  flowTitle,
  version,
  authorOpen,
  saving,
  onToggleAuthor,
  onLoadExample,
  onLoadNewTask,
  onResetEmpty,
  onSave
}: WorkflowToolbarProps) {
  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-border bg-white px-3 py-2">
      <Badge tone="flow">workflow</Badge>
      <div className="text-sm font-medium text-zinc-900">{flowTitle}</div>
      <div className="font-mono text-xs text-muted-foreground">v{version}</div>
      <div className="ml-auto flex flex-wrap items-center gap-2">
        <ToolbarLink href={projectPaths.entity(projectKey, flowId)} size="xs">
          Entity
        </ToolbarLink>
        <ToolbarLink href={projectPaths.graph(projectKey, flowId)} size="xs">
          Aspect Graph
        </ToolbarLink>
        <GhostButton size="xs" tone={authorOpen ? "accent" : "default"} active={authorOpen} onClick={onToggleAuthor}>
          Describe
        </GhostButton>
        <GhostButton size="xs" onClick={onLoadExample}>
          Load example
        </GhostButton>
        <GhostButton size="xs" onClick={onLoadNewTask}>
          Load New Task
        </GhostButton>
        <GhostButton size="xs" onClick={onResetEmpty}>
          Reset empty
        </GhostButton>
        <GhostButton size="xs" tone="primary" disabled={saving} onClick={onSave}>
          {saving ? "Saving…" : "Save graph"}
        </GhostButton>
      </div>
    </div>
  );
}
