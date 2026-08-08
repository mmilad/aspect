"use client";

import { Handle, type NodeProps, Position } from "@xyflow/react";
import { workflowStepToneByType } from "../../../lib/workflow-tones";
import { cn } from "../../../lib/utils";
import type { FlowRfNode } from "../rf-adapters";

export function WorkflowStepNode({ data, selected }: NodeProps<FlowRfNode>) {
  const node = data.workflow;
  return (
    <div
      className={cn(
        "min-w-[140px] rounded-md border-2 px-3 py-2 shadow-sm",
        workflowStepToneByType[node.type],
        selected && "ring-2 ring-offset-2 ring-zinc-900"
      )}
    >
      <Handle type="target" position={Position.Left} className="!bg-zinc-700" />
      <div className="text-[10px] font-semibold uppercase tracking-wide opacity-70">{node.type}</div>
      <div className="text-sm font-medium leading-tight">{node.data.title}</div>
      {node.data.writes?.length ? (
        <div className="mt-1 text-[10px] opacity-70">writes: {node.data.writes.join(", ")}</div>
      ) : null}
      <Handle type="source" position={Position.Right} className="!bg-zinc-700" />
    </div>
  );
}

export const workflowRfNodeTypes = { workflow: WorkflowStepNode };
