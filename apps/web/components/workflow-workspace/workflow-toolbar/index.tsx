"use client";

import { Badge, Button } from "../../ui";
import { badgeClassForTone } from "../../../lib/entity-tones";
import { cn } from "../../../lib/utils";
import type { ReactNode } from "react";

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
  onSave: () => void;
  onFormat?: () => void;
  onRun?: () => void;
  addSlot?: React.ReactNode;
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
  onSave,
  onFormat,
  onRun,
  addSlot
}: WorkflowToolbarProps) {
  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-border bg-white px-3 py-2">
      <Badge className={cn("border-transparent text-white", badgeClassForTone("flow"))}>workflow</Badge>
      {presetKey ? <Badge className={badgeClassForTone("accent")}>preset</Badge> : null}
      {presetKey && presetDirty ? <Badge className={badgeClassForTone("warning")}>modified</Badge> : null}
      <div className="text-sm font-medium text-zinc-900">{flowTitle}</div>
      <div className="font-mono text-xs text-muted-foreground">v{version}</div>
      {presetKey ? (
        <div className="font-mono text-[10px] text-muted-foreground">{presetKey}</div>
      ) : null}
      <div className="ml-auto flex flex-wrap items-center gap-2">
        <Button size="xs" variant={authorOpen ? "default" : "outline"} onClick={onToggleAuthor}>
          Describe
        </Button>
        <Button size="xs" variant={storyOpen ? "default" : "outline"} onClick={onToggleStory}>
          Story
        </Button>
        <Button
          size="xs"
          variant={diagramOpen ? "default" : "outline"}
          onClick={onToggleDiagram}
        >
          Diagram
        </Button>
        {addSlot}
        {onFormat ? (
          <Button size="xs" variant="outline" onClick={onFormat}>
            Format
          </Button>
        ) : null}
        {onRun ? (
          <Button size="xs" variant="outline" onClick={onRun}>
            Run
          </Button>
        ) : null}
        <Button size="xs" variant="default" disabled={saving} onClick={onSave}>
          {saving ? "Saving…" : "Save graph"}
        </Button>
      </div>
    </div>
  );
}
