"use client";

import { Handle, type NodeProps, Position } from "@xyflow/react";
import { getNodeModel } from "@projectplaner/core";
import { workflowStepToneByType } from "../../../lib/workflow-tones";
import { cn } from "../../../lib/utils";
import type { FlowRfNode } from "../rf-adapters";

const CONTROL_TYPES = new Set([
  "start",
  "end",
  "error_end",
  "switch",
  "branch",
  "fork",
  "join",
  "foreach",
  "gate",
  "wait",
  "subworkflow"
]);

function pinTop(index: number): string {
  return `${34 + index * 22}px`;
}

export function WorkflowStepNode({ data, selected }: NodeProps<FlowRfNode>) {
  const node = data.workflow;
  const model = getNodeModel(node.type);
  const execInputs = model.execInputs?.(node) ?? ["in"];
  const execOutputs = model.execOutputs?.(node) ?? ["then"];
  const canvasFields = model.canvasFields?.(node) ?? [];
  const isControl = CONTROL_TYPES.has(node.type);

  return (
    <div
      className={cn(
        "min-w-[168px] rounded-md border-2 px-3 py-2 shadow-sm",
        workflowStepToneByType[node.type],
        selected && "ring-2 ring-offset-2 ring-zinc-900",
        node.type === "foreach" && "min-w-[190px] border-dashed",
        node.type === "switch" && "min-w-[190px]"
      )}
    >
      {execInputs.map((pin, index) => (
        <Handle
          key={`in:${pin}`}
          id={`in:${pin}`}
          type="target"
          position={Position.Left}
          className="!h-2.5 !w-2.5 !bg-zinc-700"
          style={{ top: pinTop(index) }}
        />
      ))}

      <div className="text-[10px] font-semibold uppercase tracking-wide opacity-70">
        {isControl ? "control - " : "work - "}
        {node.type.replaceAll("_", " ")}
      </div>
      <div className="text-sm font-medium leading-tight">{node.data.title}</div>
      {model.description ? (
        <div className="mt-1 max-w-[220px] text-[10px] leading-snug opacity-70">
          {model.description}
        </div>
      ) : null}

      {execInputs.length > 1 ? (
        <div className="mt-1 grid gap-0.5 text-[10px] opacity-70">
          {execInputs.map((pin) => (
            <div key={pin}>in: {pin}</div>
          ))}
        </div>
      ) : null}

      {canvasFields.map((field) => (
        <div key={`${field.label}:${field.value}`} className="mt-1 truncate text-[10px] opacity-70">
          {field.label}: {field.value}
        </div>
      ))}

      {node.type === "switch" || node.type === "foreach" || node.type === "branch" ? (
        <div className="mt-2 grid gap-1 text-[10px]">
          {execOutputs.map((pin) => (
            <div key={pin} className="rounded border border-current/20 px-1.5 py-0.5 opacity-80">
              out: {pin}
            </div>
          ))}
        </div>
      ) : null}

      {node.type === "join" ? (
        <div className="mt-1 text-[10px] opacity-70">
          join {typeof node.data.join?.mode === "object" ? `count:${node.data.join.mode.count}` : node.data.join?.mode ?? "all"}
        </div>
      ) : null}
      {node.type === "subworkflow" && node.data.subworkflow?.workflowId ? (
        <div className="mt-1 truncate text-[10px] opacity-70">to {node.data.subworkflow.workflowId}</div>
      ) : null}
      {node.type === "map" && node.data.map ? (
        <div className="mt-1 text-[10px] opacity-70">
          map {node.data.map.from} to {node.data.map.as}
        </div>
      ) : null}
      {node.data.writes?.length ? (
        <div className="mt-1 text-[10px] opacity-70">writes: {node.data.writes.join(", ")}</div>
      ) : null}

      {execOutputs.map((pin, index) => (
        <Handle
          key={`out:${pin}`}
          id={`out:${pin}`}
          type="source"
          position={Position.Right}
          className="!h-2.5 !w-2.5 !bg-zinc-700"
          style={{ top: pinTop(index) }}
        />
      ))}
    </div>
  );
}

export const workflowRfNodeTypes = { workflow: WorkflowStepNode };
