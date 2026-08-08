"use client";

import { workflowNodeTypes, type WorkflowNodeType } from "@projectplaner/core";

interface WorkflowPaletteProps {
  status: string | null;
  errors: string[];
  onAddNode: (type: WorkflowNodeType) => void;
}

export function WorkflowPalette({ status, errors, onAddNode }: WorkflowPaletteProps) {
  return (
    <aside className="w-44 shrink-0 overflow-y-auto border-r border-border bg-white p-2">
      <div className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Add node</div>
      <div className="flex flex-col gap-1">
        {workflowNodeTypes.map((type) => (
          <button
            key={type}
            type="button"
            className="rounded-md border border-border px-2 py-1.5 text-left text-xs capitalize hover:bg-muted"
            onClick={() => onAddNode(type)}
          >
            {type}
          </button>
        ))}
      </div>
      {status ? <p className="mt-3 text-xs text-muted-foreground">{status}</p> : null}
      {errors.length > 0 ? (
        <ul className="mt-2 list-disc space-y-1 pl-4 text-[11px] text-rose-700">
          {errors.map((error) => (
            <li key={error}>{error}</li>
          ))}
        </ul>
      ) : null}
    </aside>
  );
}
