"use client";

import { GhostButton, TextArea } from "../../ui";

export interface WorkflowAuthorInspectorProps {
  brief: string;
  generating: boolean;
  onBriefChange: (value: string) => void;
  onGenerate: (scaffoldOnly?: boolean) => void;
}

/** Author brief for the shell right inspector (Describe mode). */
export function WorkflowAuthorInspector({
  brief,
  generating,
  onBriefChange,
  onGenerate
}: WorkflowAuthorInspectorProps) {
  return (
    <div className="space-y-3 p-3">
      <div>
        <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Brief</div>
        <p className="mt-1 text-xs text-muted-foreground">
          Explain what this workflow should do. Generate builds a step graph (LLM if configured, otherwise a
          scaffold with your brief on an llm node).
        </p>
      </div>
      <TextArea
        className="min-h-32"
        placeholder="e.g. Given a user goal, load matching aspects, pick the smallest truthful one, then create a feature + tasks."
        value={brief}
        onChange={(event) => onBriefChange(event.target.value)}
      />
      <div className="flex flex-wrap gap-2">
        <GhostButton size="xs" tone="accent" disabled={generating} onClick={() => onGenerate(false)}>
          {generating ? "Generating…" : "Generate workflow"}
        </GhostButton>
        <GhostButton size="xs" disabled={generating} onClick={() => onGenerate(true)}>
          Scaffold only
        </GhostButton>
      </div>
    </div>
  );
}
