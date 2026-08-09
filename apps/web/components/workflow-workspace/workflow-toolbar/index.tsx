"use client";

import { Badge, GhostButton } from "../../ui";

interface WorkflowToolbarProps {
  projectKey: string;
  flowId: string;
  flowTitle: string;
  version: number;
  authorOpen: boolean;
  storyOpen: boolean;
  diagramOpen: boolean;
  saving: boolean;
  presetKey?: string | null;
  presetDirty?: boolean;
  onToggleAuthor: () => void;
  onToggleStory: () => void;
  onToggleDiagram: () => void;
  onLoadExample: () => void;
  onLoadNewTask: () => void;
  onResetEmpty: () => void;
  onSave: () => void;
  onRun?: () => void;
}

export function WorkflowToolbar({
  flowTitle,
  version,
  authorOpen,
  storyOpen,
  diagramOpen,
  saving,
  presetKey,
  presetDirty,
  onToggleAuthor,
  onToggleStory,
  onToggleDiagram,
  onLoadExample,
  onLoadNewTask,
  onResetEmpty,
  onSave,
  onRun
}: WorkflowToolbarProps) {
  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-border bg-white px-3 py-2">
      <Badge tone="flow">workflow</Badge>
      {presetKey ? <Badge tone="accent">preset</Badge> : null}
      {presetKey && presetDirty ? <Badge tone="warning">modified</Badge> : null}
      <div className="text-sm font-medium text-zinc-900">{flowTitle}</div>
      <div className="font-mono text-xs text-muted-foreground">v{version}</div>
      {presetKey ? (
        <div className="font-mono text-[10px] text-muted-foreground">{presetKey}</div>
      ) : null}
      <div className="ml-auto flex flex-wrap items-center gap-2">
        <GhostButton size="xs" tone={authorOpen ? "accent" : "default"} active={authorOpen} onClick={onToggleAuthor}>
          Describe
        </GhostButton>
        <GhostButton size="xs" tone={storyOpen ? "accent" : "default"} active={storyOpen} onClick={onToggleStory}>
          Story
        </GhostButton>
        <GhostButton
          size="xs"
          tone={diagramOpen ? "accent" : "default"}
          active={diagramOpen}
          onClick={onToggleDiagram}
        >
          Diagram
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
        {onRun ? (
          <GhostButton size="xs" onClick={onRun}>
            Run
          </GhostButton>
        ) : null}
        <GhostButton size="xs" tone="primary" disabled={saving} onClick={onSave}>
          {saving ? "Saving…" : "Save graph"}
        </GhostButton>
      </div>
    </div>
  );
}
