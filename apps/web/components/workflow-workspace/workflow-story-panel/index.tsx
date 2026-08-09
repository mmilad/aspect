"use client";

interface WorkflowStoryPanelProps {
  story: string;
}

export function WorkflowStoryPanel({ story }: WorkflowStoryPanelProps) {
  return (
    <div className="max-h-64 overflow-y-auto border-b border-teal-200 bg-teal-50/60 px-3 py-3">
      <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-teal-900">Story preview</div>
      <p className="mb-2 text-xs text-teal-950/80">
        Deterministic walk of the step graph (branches nested). Semantic description is the flow brief; steps come from the diagram.
      </p>
      <pre className="whitespace-pre-wrap font-mono text-[11px] leading-relaxed text-teal-950">{story}</pre>
    </div>
  );
}
