"use client";

import { Handle, type NodeProps, Position } from "@xyflow/react";
import { getNodeModel, type BagShape } from "@projectplaner/core";
import { workflowStepToneByType } from "../../../lib/workflow-tones";
import { cn } from "../../../lib/utils";
import { colorForBagShape, encodeHandle, type FlowRfNode } from "../rf-adapters";

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
  return `${18 + index * 18}px`;
}

function dataPinShape(node: FlowRfNode["data"]["workflow"], port: string, channel: "in" | "out"): BagShape | undefined {
  if (node.type === "get" || node.type === "set") {
    return undefined;
  }
  if (channel === "out") {
    return node.data.outputContracts?.[port]?.shape;
  }
  return node.data.inputs?.[port]?.shape;
}

export function WorkflowStepNode({ data, selected }: NodeProps<FlowRfNode>) {
  const node = data.workflow;
  const model = getNodeModel(node.type);
  const execInputs = model.execInputs?.(node) ?? (node.type === "get" ? [] : ["in"]);
  const execOutputs = model.execOutputs?.(node) ?? (node.type === "get" || node.type === "end" || node.type === "error_end" ? [] : ["then"]);
  const dataInputs = model.dataInputs?.(node) ?? Object.keys(node.data.inputs ?? {});
  const dataOutputs = model.dataOutputs?.(node) ?? Object.keys(node.data.outputContracts ?? {});
  const canvasFields = model.canvasFields?.(node) ?? [];
  const isControl = CONTROL_TYPES.has(node.type);
  const isVariable = node.type === "get" || node.type === "set";
  const title = isVariable && node.data.variable ? node.data.variable : node.data.title;

  return (
    <div
      className={cn(
        "min-w-[168px] rounded-md border-2 px-3 py-2 shadow-sm",
        workflowStepToneByType[node.type],
        selected && "ring-2 ring-offset-2 ring-zinc-900",
        node.type === "foreach" && "min-w-[190px] border-dashed",
        node.type === "switch" && "min-w-[190px]",
        isVariable && "min-w-[120px] px-2 py-1.5"
      )}
    >
      {execInputs.map((pin, index) => (
        <Handle
          key={`in:${pin}`}
          id={encodeHandle("in", pin)}
          type="target"
          position={Position.Left}
          className="workflow-exec-handle"
          style={{ top: pinTop(index) }}
        />
      ))}
      {execOutputs.map((pin, index) => (
        <Handle
          key={`out:${pin}`}
          id={encodeHandle("out", pin)}
          type="source"
          position={Position.Right}
          className="workflow-exec-handle"
          style={{ top: pinTop(index) }}
        />
      ))}

      <div className="text-[10px] font-semibold uppercase tracking-wide opacity-70">
        {isVariable ? "var - " : isControl ? "control - " : "work - "}
        {node.type.replaceAll("_", " ")}
      </div>
      <div className="text-sm font-medium leading-tight">{title}</div>
      {model.description && !isVariable ? (
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

      {!isVariable
        ? canvasFields.map((field) => (
            <div key={`${field.label}:${field.value}`} className="mt-1 truncate text-[10px] opacity-70">
              {field.label}: {field.value}
            </div>
          ))
        : null}

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
      {!isVariable && node.data.writes?.length ? (
        <div className="mt-1 text-[10px] opacity-70">writes: {node.data.writes.join(", ")}</div>
      ) : null}

      {(dataInputs.length > 0 || dataOutputs.length > 0) ? (
        <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[10px] opacity-80">
          <div className="grid gap-1">
            {dataInputs.map((pin, index) => (
              <div key={`data-in:${pin}`} className="pl-1">
                <Handle
                  id={encodeHandle("in", pin, "data")}
                  type="target"
                  position={Position.Left}
                  className="workflow-data-handle"
                  style={{
                    top: `${(isVariable ? 44 : 70) + index * 16}px`,
                    background: colorForBagShape(dataPinShape(node, pin, "in"))
                  }}
                />
                {pin}
              </div>
            ))}
          </div>
          <div className="grid gap-1 text-right">
            {dataOutputs.map((pin, index) => (
              <div key={`data-out:${pin}`} className="pr-1">
                <Handle
                  id={encodeHandle("out", pin, "data")}
                  type="source"
                  position={Position.Right}
                  className="workflow-data-handle"
                  style={{
                    top: `${(isVariable ? 44 : 70) + index * 16}px`,
                    background: colorForBagShape(dataPinShape(node, pin, "out"))
                  }}
                />
                {pin}
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export const workflowRfNodeTypes = { workflow: WorkflowStepNode };
