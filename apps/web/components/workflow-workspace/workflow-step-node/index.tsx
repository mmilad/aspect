"use client";

import { Handle, type NodeProps, Position } from "@xyflow/react";
import { workflowStepToneByType } from "../../../lib/workflow-tones";
import { cn } from "../../../lib/utils";
import type { FlowRfNode } from "../rf-adapters";

export function WorkflowStepNode({ data, selected }: NodeProps<FlowRfNode>) {
  const node = data.workflow;
  const isControl =
    node.type === "start" ||
    node.type === "end" ||
    node.type === "error_end" ||
    node.type === "switch" ||
    node.type === "branch" ||
    node.type === "fork" ||
    node.type === "join" ||
    node.type === "foreach" ||
    node.type === "gate" ||
    node.type === "wait" ||
    node.type === "subworkflow";

  return (
    <div
      className={cn(
        "min-w-[148px] rounded-md border-2 px-3 py-2 shadow-sm",
        workflowStepToneByType[node.type],
        selected && "ring-2 ring-offset-2 ring-zinc-900",
        node.type === "foreach" && "min-w-[180px] border-dashed"
      )}
    >
      <Handle type="target" position={Position.Left} className="!bg-zinc-700" />
      <div className="text-[10px] font-semibold uppercase tracking-wide opacity-70">
        {isControl ? "control · " : "work · "}
        {node.type.replaceAll("_", " ")}
      </div>
      <div className="text-sm font-medium leading-tight">{node.data.title}</div>
      {node.type === "foreach" && node.data.foreach?.itemsFrom ? (
        <div className="mt-1 text-[10px] opacity-70">items: {node.data.foreach.itemsFrom}</div>
      ) : null}
      {node.type === "join" ? (
        <div className="mt-1 text-[10px] opacity-70">
          join {typeof node.data.join?.mode === "object" ? `count:${node.data.join.mode.count}` : node.data.join?.mode ?? "all"}
        </div>
      ) : null}
      {node.type === "subworkflow" && node.data.subworkflow?.workflowId ? (
        <div className="mt-1 truncate text-[10px] opacity-70">→ {node.data.subworkflow.workflowId}</div>
      ) : null}
      {node.type === "map" && node.data.map ? (
        <div className="mt-1 text-[10px] opacity-70">
          map {node.data.map.from} → {node.data.map.as}
        </div>
      ) : null}
      {node.data.writes?.length ? (
        <div className="mt-1 text-[10px] opacity-70">writes: {node.data.writes.join(", ")}</div>
      ) : null}
      <Handle type="source" position={Position.Right} className="!bg-zinc-700" />
    </div>
  );
}

export const workflowRfNodeTypes = { workflow: WorkflowStepNode };
