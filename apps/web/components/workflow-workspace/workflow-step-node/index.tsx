"use client";

import { createContext, useContext, useEffect } from "react";
import { Handle, type NodeProps, Position, useUpdateNodeInternals } from "@xyflow/react";
import { FlaskConical } from "lucide-react";
import type { BagShape, WorkflowNodeType, WorkflowVariable } from "@projectplaner/core";
import workflow from "@projectplaner/core/workflow";

const { getNodeModel } = workflow.nodes;
import { workflowStepToneByType } from "../../../lib/workflow-tones";
import { cn } from "../../../lib/utils";
import {
  colorForBagShape,
  encodeHandle,
  lookupPinShape,
  pinTooltip,
  breakOutputPins,
  type FlowRfEdge,
  type FlowRfNode
} from "../rf-adapters";

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

export const WorkflowPinsContext = createContext<{
  variables: WorkflowVariable[];
  nodes: FlowRfNode[];
  edges: FlowRfEdge[];
}>({ variables: [], nodes: [], edges: [] });

function RerouteNode({ data, selected }: { data: FlowRfNode["data"]; selected?: boolean }) {
  const ctx = useContext(WorkflowPinsContext);
  const node = data.workflow;
  const shape = lookupPinShape(node, "value", "out", ctx);
  const color = colorForBagShape(shape);
  const tooltip = pinTooltip({
    channel: "data",
    direction: "out",
    pin: "value",
    shape,
    description: "Drag to fan this value out to another input."
  });
  return (
    <div
      className={cn("relative h-[18px] w-[18px]", selected && "ring-2 ring-offset-1 ring-zinc-900")}
      title={tooltip}
    >
      <div
        className="absolute inset-0 rotate-45 border border-stone-700"
        style={{ background: color }}
      />
      <Handle
        id={encodeHandle("in", "value", "data")}
        type="target"
        position={Position.Left}
        className="workflow-reroute-handle workflow-reroute-handle-in"
        isConnectableStart={false}
        isConnectableEnd
        title={tooltip}
        aria-label={tooltip}
        style={{ background: color }}
      />
      <Handle
        id={encodeHandle("out", "value", "data")}
        type="source"
        position={Position.Right}
        className="workflow-reroute-handle workflow-reroute-handle-out"
        isConnectableStart
        isConnectableEnd={false}
        title={tooltip}
        aria-label={tooltip}
        style={{ background: color }}
      />
    </div>
  );
}

function PinHandle({
  channel,
  direction,
  pin,
  shape,
  description
}: {
  channel: "exec" | "data";
  direction: "in" | "out";
  pin: string;
  shape?: BagShape;
  description?: string;
}) {
  const id = encodeHandle(direction, pin, channel);
  const tooltip = pinTooltip({ channel, direction, pin, shape, description });
  return (
    <Handle
      id={id}
      type={direction === "in" ? "target" : "source"}
      position={direction === "in" ? Position.Left : Position.Right}
      className={cn("workflow-handle-flow", channel === "exec" ? "workflow-exec-handle" : "workflow-data-handle")}
      title={tooltip}
      aria-label={tooltip}
      style={channel === "data" ? { background: colorForBagShape(shape) } : undefined}
    />
  );
}

function PinRow({
  channel,
  direction,
  pin,
  shape,
  description,
  showLabel
}: {
  channel: "exec" | "data";
  direction: "in" | "out";
  pin: string;
  shape?: BagShape;
  description?: string;
  showLabel: boolean;
}) {
  const tooltip = pinTooltip({ channel, direction, pin, shape, description });
  const handle = (
    <PinHandle channel={channel} direction={direction} pin={pin} shape={shape} description={description} />
  );
  const label = showLabel ? (
    <span className="min-w-0 truncate text-[10px] opacity-80">{pin}</span>
  ) : null;

  return (
    <div
      className={cn(
        "group/pin relative flex h-[18px] items-center gap-1",
        direction === "out" && "justify-end"
      )}
      style={direction === "in" ? { marginLeft: -6 } : { marginRight: -6 }}
    >
      {direction === "in" ? (
        <>
          {handle}
          {label}
        </>
      ) : (
        <>
          {label}
          {handle}
        </>
      )}
      <span
        role="tooltip"
        className={cn(
          "pointer-events-none absolute z-[80] hidden max-w-[220px] whitespace-pre-wrap rounded bg-zinc-900 px-1.5 py-0.5 text-left text-[10px] leading-snug text-white shadow group-hover/pin:block",
          direction === "in" ? "bottom-full left-0 mb-0.5" : "bottom-full right-0 mb-0.5"
        )}
      >
        {tooltip}
      </span>
    </div>
  );
}

export function WorkflowStepNode({ data, selected }: NodeProps<FlowRfNode>) {
  const pinCtx = useContext(WorkflowPinsContext);
  const node = data.workflow;
  const model = getNodeModel(node.type);
  const execInputs = model.execInputs?.(node) ?? (node.type === "get" ? [] : ["in"]);
  const execOutputs =
    model.execOutputs?.(node) ?? (node.type === "get" || node.type === "end" || node.type === "error_end" ? [] : ["then"]);
  const dataInputs = model.dataInputs?.(node) ?? Object.keys(node.data.inputs ?? {});
  const dataOutputs = node.type === "break"
    ? breakOutputPins(node, pinCtx)
    : model.dataOutputs?.(node) ?? Object.keys(node.data.outputContracts ?? {});
  const updateNodeInternals = useUpdateNodeInternals();
  const portSignature = JSON.stringify([execInputs, execOutputs, dataInputs, dataOutputs]);
  useEffect(() => {
    updateNodeInternals(node.id);
  }, [node.id, portSignature, updateNodeInternals]);

  if (node.type === "reroute") {
    return <RerouteNode data={data} selected={selected} />;
  }
  const execInDesc = model.execInputDescriptions?.(node) ?? {};
  const execOutDesc = model.execOutputDescriptions?.(node) ?? {};
  const isControl = CONTROL_TYPES.has(node.type);
  const isVariable = node.type === "get" || node.type === "set" || node.type === "template";
  const title = isVariable && node.data.variable ? node.data.variable : node.data.title;
  const pinRows = Math.max(dataInputs.length, dataOutputs.length);
  const showExecOutLabels = execOutputs.length > 1;

  return (
    <div
      className={cn(
        "overflow-visible min-w-[176px] rounded-md border-2 py-1.5 shadow-sm",
        workflowStepToneByType[node.type as WorkflowNodeType],
        selected && "ring-2 ring-offset-2 ring-zinc-900",
        node.type === "foreach" && "min-w-[190px] border-dashed",
        node.type === "switch" && "min-w-[190px]",
        isVariable && "min-w-[120px]"
      )}
    >
      <div className="flex items-start">
        <div className="flex flex-col">
          {execInputs.map((pin) => (
            <PinRow
              key={`in:${pin}`}
              channel="exec"
              direction="in"
              pin={pin}
              description={execInDesc[pin]}
              showLabel={false}
            />
          ))}
        </div>
        <div className="min-w-0 flex-1 px-2">
          <div className="flex items-start gap-1">
            <div className="min-w-0 flex-1">
              <div className="text-[10px] font-semibold uppercase tracking-wide opacity-70">
                {isVariable ? "var - " : isControl ? "control - " : "work - "}
                {node.type.replaceAll("_", " ")}
              </div>
              <div className="text-sm font-medium leading-tight">{title}</div>
            </div>
            {node.type === "llm" && data.onTryLlm ? (
              <button
                type="button"
                className="nodrag nopan mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border border-amber-300 bg-white text-amber-700 hover:border-amber-500 hover:bg-amber-50"
                title="Try LLM step"
                aria-label={`Try ${title}`}
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  data.onTryLlm?.(node);
                }}
              >
                <FlaskConical className="h-3 w-3" aria-hidden="true" />
              </button>
            ) : null}
          </div>
        </div>
        <div className="flex flex-col">
          {execOutputs.map((pin) => (
            <PinRow
              key={`out:${pin}`}
              channel="exec"
              direction="out"
              pin={pin}
              description={execOutDesc[pin]}
              showLabel={showExecOutLabels}
            />
          ))}
        </div>
      </div>

      {node.type === "join" ? (
        <div className="px-2 text-[10px] opacity-70">
          join {typeof node.data.join?.mode === "object" ? `count:${node.data.join.mode.count}` : node.data.join?.mode ?? "all"}
        </div>
      ) : null}
      {node.type === "subworkflow" && node.data.subworkflow?.workflowId ? (
        <div className="truncate px-2 text-[10px] opacity-70">to {node.data.subworkflow.workflowId}</div>
      ) : null}
      {node.type === "map" && node.data.map ? (
        <div className="px-2 text-[10px] opacity-70">
          map {node.data.map.from} to {node.data.map.as}
        </div>
      ) : null}
      {(model.canvasFields?.(node) ?? []).map((field) => (
        <div key={field.label} className="truncate px-2 text-[10px] opacity-70">
          {field.label} {field.value}
        </div>
      ))}

      {pinRows > 0 ? (
        <div className="mt-1 grid grid-cols-2 gap-x-2">
          <div className="flex flex-col">
            {dataInputs.map((pin) => (
              <PinRow
                key={`data-in:${pin}`}
                channel="data"
                direction="in"
                pin={pin}
                  shape={lookupPinShape(node, pin, "in", pinCtx)}
                showLabel
              />
            ))}
          </div>
          <div className="flex flex-col">
            {dataOutputs.map((pin) => (
              <PinRow
                key={`data-out:${pin}`}
                channel="data"
                direction="out"
                pin={pin}
                  shape={lookupPinShape(node, pin, "out", pinCtx)}
                showLabel
              />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export const workflowRfNodeTypes = { workflow: WorkflowStepNode };
