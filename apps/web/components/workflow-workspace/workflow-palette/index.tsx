"use client";

import {
  workflowControlNodeTypes,
  workflowWorkNodeTypes,
  type WorkflowNodeType
} from "@projectplaner/core";

interface WorkflowPaletteProps {
  status: string | null;
  errors: string[];
  warnings?: string[];
  connectKind: "next" | "route" | "depends_on" | "error";
  onConnectKindChange: (kind: "next" | "route" | "depends_on" | "error") => void;
  onAddNode: (type: WorkflowNodeType) => void;
}

function PaletteSection({
  label,
  types,
  onAddNode
}: {
  label: string;
  types: readonly WorkflowNodeType[];
  onAddNode: (type: WorkflowNodeType) => void;
}) {
  return (
    <div className="mb-3">
      <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="flex flex-col gap-1">
        {types.map((type) => (
          <button
            key={type}
            type="button"
            className="rounded-md border border-border px-2 py-1.5 text-left text-xs capitalize hover:bg-muted"
            onClick={() => onAddNode(type)}
          >
            {type.replaceAll("_", " ")}
          </button>
        ))}
      </div>
    </div>
  );
}

export function WorkflowPalette({
  status,
  errors,
  warnings = [],
  connectKind,
  onConnectKindChange,
  onAddNode
}: WorkflowPaletteProps) {
  return (
    <aside className="w-48 shrink-0 overflow-y-auto border-r border-border bg-white p-2">
      <div className="mb-3">
        <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          Connect as
        </div>
        <select
          className="w-full rounded border border-border bg-white px-2 py-1 text-xs"
          value={connectKind}
          onChange={(event) =>
            onConnectKindChange(event.target.value as "next" | "route" | "depends_on" | "error")
          }
        >
          <option value="next">next</option>
          <option value="route">route</option>
          <option value="depends_on">depends_on</option>
          <option value="error">error</option>
        </select>
      </div>
      <PaletteSection label="Control" types={workflowControlNodeTypes} onAddNode={onAddNode} />
      <PaletteSection label="Work" types={workflowWorkNodeTypes} onAddNode={onAddNode} />
      {status ? <p className="mt-3 text-xs text-muted-foreground">{status}</p> : null}
      {errors.length > 0 ? (
        <ul className="mt-2 list-disc space-y-1 pl-4 text-[11px] text-rose-700">
          {errors.map((error) => (
            <li key={error}>{error}</li>
          ))}
        </ul>
      ) : null}
      {warnings.length > 0 ? (
        <ul className="mt-2 list-disc space-y-1 pl-4 text-[11px] text-amber-700">
          {warnings.map((warning) => (
            <li key={warning}>{warning}</li>
          ))}
        </ul>
      ) : null}
    </aside>
  );
}
