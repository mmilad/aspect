"use client";

import { GhostButton, TextArea } from "../../ui";

interface WorkflowAuthorPanelProps {
  brief: string;
  generating: boolean;
  onBriefChange: (value: string) => void;
  onGenerate: (scaffoldOnly?: boolean) => void;
}

export function WorkflowAuthorPanel({ brief, generating, onBriefChange, onGenerate }: WorkflowAuthorPanelProps) {
  return (
    <div className="border-b border-amber-200 bg-amber-50/70 px-3 py-3">
      <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-amber-900">Author with brief</div>
      <p className="mb-2 text-xs text-amber-950/80">
        Explain what this workflow should do. Generate builds a step graph (LLM if configured, otherwise a scaffold with your brief on an llm node).
      </p>
      <TextArea
        className="min-h-20 border-amber-300"
        placeholder="e.g. Given a user goal, load matching aspects, pick the smallest truthful one, then create a feature + tasks."
        value={brief}
        onChange={(event) => onBriefChange(event.target.value)}
      />
      <div className="mt-2 flex flex-wrap gap-2">
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
