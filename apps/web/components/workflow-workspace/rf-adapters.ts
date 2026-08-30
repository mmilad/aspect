import type {
  BagShape,
  JsonRecord,
  WorkflowEdgeKind,
  WorkflowGraph,
  WorkflowNode,
  WorkflowVariable
} from "@projectplaner/core";
import workflow from "@projectplaner/core/workflow";

const { emptyWorkflowGraph, parse: parseWorkflowGraph, parseWaypoints } = workflow.graph;
const { isPureDataNodeType } = workflow.nodes;
const { isShapeConnectable, serializeShapeSlim } = workflow.bag;
import type { CSSProperties } from "react";
import { MarkerType, type Connection, type Edge, type Node } from "@xyflow/react";

export type FlowRfNode = Node<{ workflow: WorkflowNode; onTryLlm?: (node: WorkflowNode) => void }, "workflow">;

export type FlowRfEdgeData = {
  kind: WorkflowEdgeKind;
  waypoints?: Array<{ x: number; y: number }>;
  color?: string;
};

export type FlowRfEdge = Edge<FlowRfEdgeData>;

const EXEC_EDGE_STYLE: { animated: boolean; style: CSSProperties } = {
  animated: false,
  style: { stroke: "#57534e", strokeWidth: 3 }
};

const EDGE_STYLE: Record<
  WorkflowEdgeKind,
  { animated: boolean; style: CSSProperties; labelStyle?: CSSProperties }
> = {
  next: EXEC_EDGE_STYLE,
  route: { ...EXEC_EDGE_STYLE, labelStyle: { fill: "#44403c", fontSize: 10 } },
  depends_on: {
    animated: false,
    style: { stroke: "#0369a1", strokeWidth: 1.5, strokeDasharray: "6 4" },
    labelStyle: { fill: "#0c4a6e", fontSize: 10 }
  },
  error: {
    animated: false,
    style: { stroke: "#9f1239", strokeWidth: 3 },
    labelStyle: { fill: "#9f1239", fontSize: 10 }
  },
  data: {
    animated: false,
    style: { stroke: "#a1a1aa", strokeWidth: 1.5 }
  }
};

export function colorForBagShape(shape: BagShape | undefined): string {
  if (!shape) {
    return "#a1a1aa";
  }
  if (shape.kind === "primitive") {
    if (shape.type === "string") {
      return "#ec4899";
    }
    if (shape.type === "boolean") {
      return "#ef4444";
    }
    if (shape.type === "number") {
      return "#22c55e";
    }
  }
  if (shape.kind === "object" || shape.kind === "ref") {
    return "#3b82f6";
  }
  if (shape.kind === "array") {
    return "#06b6d4";
  }
  return "#a1a1aa";
}

export function isExecEdgeKind(kind: WorkflowEdgeKind): boolean {
  return kind === "next" || kind === "route" || kind === "error";
}

export function rfEdgeTypeForKind(kind: WorkflowEdgeKind): "exec" | undefined {
  return isExecEdgeKind(kind) || kind === "data" ? "exec" : undefined;
}

export function styleForEdgeKind(kind: WorkflowEdgeKind, color?: string): {
  animated: boolean;
  style: CSSProperties;
  labelStyle?: CSSProperties;
} {
  if (kind === "data") {
    return { animated: false, style: { stroke: color ?? "#a1a1aa", strokeWidth: 1.5 } };
  }
  return EDGE_STYLE[kind];
}

export function isExecHandle(handle: string | null | undefined, direction: "in" | "out"): boolean {
  return typeof handle === "string" && handle.startsWith(`${direction}:`) && !handle.startsWith("data:");
}

export function isDataHandle(handle: string | null | undefined): boolean {
  return typeof handle === "string" && (handle.startsWith("data:in:") || handle.startsWith("data:out:"));
}

export function isValidExecConnection(connection: {
  sourceHandle?: string | null;
  targetHandle?: string | null;
}): boolean {
  return isExecHandle(connection.sourceHandle, "out") && isExecHandle(connection.targetHandle, "in");
}

export function encodeHandle(
  direction: "in" | "out",
  pin?: string,
  channel: "exec" | "data" = "exec"
): string | undefined {
  if (!pin) {
    return undefined;
  }
  return channel === "data" ? `data:${direction}:${pin}` : `${direction}:${pin}`;
}

export function decodeHandle(handle: string | null | undefined, fallback: string): string {
  if (!handle) {
    return fallback;
  }
  if (handle.startsWith("data:in:")) {
    return handle.slice("data:in:".length) || fallback;
  }
  if (handle.startsWith("data:out:")) {
    return handle.slice("data:out:".length) || fallback;
  }
  const colon = handle.indexOf(":");
  return colon >= 0 ? handle.slice(colon + 1) || fallback : handle;
}

export type PinLookupCtx = {
  variables?: WorkflowVariable[];
  nodes?: FlowRfNode[];
  edges?: FlowRfEdge[];
};

function workflowOf(node: FlowRfNode | WorkflowNode | undefined): WorkflowNode | undefined {
  if (!node) {
    return undefined;
  }
  return "data" in node && node.data && typeof node.data === "object" && "workflow" in node.data
    ? (node.data as FlowRfNode["data"]).workflow
    : (node as WorkflowNode);
}

function dataLinkOf(edge: FlowRfEdge): { source: string; target: string; sourcePin: string; targetPin: string } | null {
  if (!isDataHandle(edge.sourceHandle) && edge.data?.kind !== "data") {
    return null;
  }
  return {
    source: edge.source,
    target: edge.target,
    sourcePin: decodeHandle(edge.sourceHandle, ""),
    targetPin: decodeHandle(edge.targetHandle, "")
  };
}

export function inferRerouteShape(
  rerouteId: string,
  ctx: PinLookupCtx,
  seen: Set<string> = new Set()
): BagShape | undefined {
  if (seen.has(rerouteId)) {
    return undefined;
  }
  seen.add(rerouteId);
  const incoming = (ctx.edges ?? [])
    .map(dataLinkOf)
    .filter((link): link is NonNullable<typeof link> => Boolean(link && link.target === rerouteId));
  const first = incoming[0];
  if (!first) {
    return undefined;
  }
  const sourceRf = ctx.nodes?.find((node) => node.id === first.source);
  const source = workflowOf(sourceRf);
  if (!source) {
    return undefined;
  }
  if (source.type === "reroute") {
    return inferRerouteShape(source.id, ctx, seen);
  }
  return lookupPinShape(source, first.sourcePin, "out", ctx);
}

export function lookupPinShape(
  node: WorkflowNode | undefined,
  pin: string | undefined,
  channel: "in" | "out",
  ctx?: WorkflowVariable[] | PinLookupCtx
): BagShape | undefined {
  const lookup: PinLookupCtx = Array.isArray(ctx) ? { variables: ctx } : (ctx ?? {});
  if (!node || !pin) {
    return undefined;
  }
  if (node.type === "reroute") {
    return inferRerouteShape(node.id, lookup);
  }
  if (node.type === "get" || (node.type === "set" && channel === "in")) {
    return lookup.variables?.find((variable) => variable.name === node.data.variable)?.shape;
  }
  if (channel === "out") {
    return node.data.outputContracts?.[pin]?.shape;
  }
  return node.data.inputs?.[pin]?.shape;
}

export function pinTooltip(input: {
  channel: "exec" | "data";
  direction: "in" | "out";
  pin: string;
  shape?: BagShape;
  description?: string;
}): string {
  const side = input.direction === "in" ? "in" : "out";
  const head =
    input.channel === "exec"
      ? `exec ${side} · ${input.pin}`
      : `data ${side} · ${input.pin} · ${serializeShapeSlim(input.shape)}`;
  return input.description ? `${head}\n${input.description}` : head;
}

function inferRerouteShapeFromGraph(
  graph: WorkflowGraph,
  rerouteId: string,
  seen: Set<string> = new Set()
): BagShape | undefined {
  if (seen.has(rerouteId)) {
    return undefined;
  }
  seen.add(rerouteId);
  const incoming = graph.edges.filter((edge) => edge.kind === "data" && edge.target === rerouteId);
  const first = incoming[0];
  if (!first) {
    return undefined;
  }
  const source = graph.nodes.find((item) => item.id === first.source);
  if (!source) {
    return undefined;
  }
  if (source.type === "reroute") {
    return inferRerouteShapeFromGraph(graph, source.id, seen);
  }
  return lookupPinShape(source, first.sourcePin, "out", graph.variables);
}

function pinShape(
  graph: WorkflowGraph,
  nodeId: string,
  pin: string | undefined,
  channel: "in" | "out"
): BagShape | undefined {
  const node = graph.nodes.find((item) => item.id === nodeId);
  if (node?.type === "reroute") {
    return inferRerouteShapeFromGraph(graph, nodeId);
  }
  return lookupPinShape(node, pin, channel, graph.variables);
}

export function isValidWorkflowConnection(
  connection: Connection | Edge,
  ctx: {
    nodes: FlowRfNode[];
    edges: FlowRfEdge[];
    variables?: WorkflowVariable[];
  }
): boolean {
  const sourceId = "source" in connection ? connection.source : undefined;
  const targetId = "target" in connection ? connection.target : undefined;
  const sourceHandle = "sourceHandle" in connection ? connection.sourceHandle : null;
  const targetHandle = "targetHandle" in connection ? connection.targetHandle : null;
  if (!sourceId || !targetId || sourceId === targetId) {
    return false;
  }
  if (!sourceHandle || !targetHandle) {
    return false;
  }

  const srcData = isDataHandle(sourceHandle);
  const tgtData = isDataHandle(targetHandle);
  if (srcData !== tgtData) {
    return false;
  }
  if (srcData) {
    if (!sourceHandle.startsWith("data:out:") || !targetHandle.startsWith("data:in:")) {
      return false;
    }
  } else if (!isValidExecConnection({ sourceHandle, targetHandle })) {
    return false;
  }

  const sourceNode = ctx.nodes.find((node) => node.id === sourceId)?.data.workflow;
  const targetNode = ctx.nodes.find((node) => node.id === targetId)?.data.workflow;
  if (!sourceNode || !targetNode) {
    return false;
  }
  if (targetNode.type === "start") {
    return false;
  }
  if ((sourceNode.type === "end" || sourceNode.type === "error_end") && !srcData) {
    return false;
  }
  if (isPureDataNodeType(sourceNode.type) && !srcData) {
    return false;
  }
  if (targetNode.type === "get") {
    return false;
  }
  if (isPureDataNodeType(targetNode.type) && !srcData) {
    return false;
  }
  const connectionId = "id" in connection && typeof connection.id === "string" ? connection.id : undefined;
  if (
    ctx.edges.some(
      (edge) =>
        edge.id !== connectionId &&
        edge.source === sourceId &&
        edge.target === targetId &&
        edge.sourceHandle === sourceHandle &&
        edge.targetHandle === targetHandle
    )
  ) {
    return false;
  }
  if (srcData && targetNode.type === "reroute") {
    const alreadyWired = ctx.edges.some(
      (edge) =>
        edge.id !== connectionId &&
        edge.target === targetId &&
        isDataHandle(edge.targetHandle)
    );
    if (alreadyWired) {
      return false;
    }
  }
  if (srcData) {
    const sourcePin = decodeHandle(sourceHandle, "");
    const targetPin = decodeHandle(targetHandle, "");
    if (!sourcePin || !targetPin) {
      return false;
    }
    const pinCtx: PinLookupCtx = { variables: ctx.variables, nodes: ctx.nodes, edges: ctx.edges };
    const fromShape = lookupPinShape(sourceNode, sourcePin, "out", pinCtx);
    if (targetNode.type === "reroute") {
      return true;
    }
    const toShape = lookupPinShape(targetNode, targetPin, "in", pinCtx);
    if (!isShapeConnectable(fromShape, toShape)) {
      return false;
    }
  }
  return true;
}

const REROUTE_SIZE = 18;

export function makeRerouteRfNode(id: string, position: { x: number; y: number }): FlowRfNode {
  return {
    id,
    type: "workflow",
    position,
    deletable: true,
    data: {
      workflow: {
        id,
        type: "reroute",
        position,
        data: { title: "Reroute" }
      }
    }
  };
}

export function splitDataEdgeWithReroute(
  edge: FlowRfEdge,
  rerouteId: string,
  position: { x: number; y: number }
): { node: FlowRfNode; edges: FlowRfEdge[] } {
  const color = edge.data?.color;
  const kindStyle = styleForEdgeKind("data", color);
  const intoReroute: FlowRfEdge = {
    ...edge,
    id: `${edge.id}_in_${rerouteId}`,
    target: rerouteId,
    targetHandle: encodeHandle("in", "value", "data"),
    data: { kind: "data", ...(color ? { color } : {}) },
    markerEnd: undefined,
    label: undefined,
    ...kindStyle
  };
  const outOfReroute: FlowRfEdge = {
    ...edge,
    id: `${edge.id}_out_${rerouteId}`,
    source: rerouteId,
    sourceHandle: encodeHandle("out", "value", "data"),
    data: { kind: "data", ...(color ? { color } : {}) },
    markerEnd: undefined,
    label: undefined,
    ...kindStyle
  };
  return {
    node: makeRerouteRfNode(rerouteId, {
      x: position.x - REROUTE_SIZE / 2,
      y: position.y - REROUTE_SIZE / 2
    }),
    edges: [intoReroute, outOfReroute]
  };
}

export function spliceRerouteDataEdges(edges: FlowRfEdge[], rerouteId: string): FlowRfEdge[] {
  const incoming = edges.filter((edge) => edge.target === rerouteId && isDataHandle(edge.targetHandle));
  const outgoing = edges.filter((edge) => edge.source === rerouteId && isDataHandle(edge.sourceHandle));
  const rest = edges.filter((edge) => edge.source !== rerouteId && edge.target !== rerouteId);
  if (incoming.length === 0) {
    return rest;
  }
  const bridged: FlowRfEdge[] = [];
  let index = 0;
  for (const inn of incoming) {
    for (const out of outgoing) {
      index += 1;
      const color = inn.data?.color ?? out.data?.color;
      bridged.push({
        ...out,
        id: `e_${inn.source}_${out.target}_r${index}`,
        source: inn.source,
        sourceHandle: inn.sourceHandle,
        target: out.target,
        targetHandle: out.targetHandle,
        data: { kind: "data", ...(color ? { color } : {}) },
        ...styleForEdgeKind("data", color)
      });
    }
  }
  return [...rest, ...bridged];
}

export function toRfNodes(graph: WorkflowGraph, selectedId: string | null): FlowRfNode[] {
  return graph.nodes.map((node) => ({
    id: node.id,
    type: "workflow",
    position: node.position,
    selected: node.id === selectedId,
    deletable: node.type !== "start",
    data: { workflow: node }
  }));
}

export function toRfEdges(graph: WorkflowGraph): FlowRfEdge[] {
  return graph.edges.map((edge) => {
    const dataChannel = edge.kind === "data";
    const color = dataChannel
      ? colorForBagShape(pinShape(graph, edge.source, edge.sourcePin, "out"))
      : undefined;
    return {
      id: edge.id,
      type: rfEdgeTypeForKind(edge.kind),
      source: edge.source,
      target: edge.target,
      sourceHandle: encodeHandle("out", edge.sourcePin, dataChannel ? "data" : "exec"),
      targetHandle: encodeHandle("in", edge.targetPin, dataChannel ? "data" : "exec"),
      label:
        edge.label ??
        (edge.kind === "route" && edge.sourcePin
          ? edge.sourcePin
          : edge.targetPin === "continue"
            ? "continue"
            : edge.kind === "depends_on" || edge.kind === "error"
              ? edge.kind
              : undefined),
      data: {
        kind: edge.kind,
        ...(edge.waypoints && edge.waypoints.length > 0 ? { waypoints: edge.waypoints } : {}),
        ...(color ? { color } : {})
      },
      markerEnd: isExecEdgeKind(edge.kind)
        ? {
            type: MarkerType.ArrowClosed,
            color: edge.kind === "error" ? "#9f1239" : "#57534e",
            width: 14,
            height: 14
          }
        : undefined,
      ...styleForEdgeKind(edge.kind, color)
    };
  });
}

export function fromRf(
  nodes: FlowRfNode[],
  edges: Edge[],
  version: number,
  variables?: WorkflowVariable[]
): WorkflowGraph {
  return {
    version,
    nodes: nodes.map((node) => ({
      ...node.data.workflow,
      id: node.id,
      position: node.position
    })),
    edges: edges.map((edge) => {
      const kind = (edge.data?.kind as WorkflowEdgeKind | undefined) ?? "next";
      const waypoints = parseWaypoints(edge.data?.waypoints);
      const dataChannel = isDataHandle(edge.sourceHandle) || isDataHandle(edge.targetHandle) || kind === "data";
      return {
        id: edge.id,
        source: edge.source,
        target: edge.target,
        kind: dataChannel ? "data" : kind,
        label: typeof edge.label === "string" && edge.label !== "continue" ? edge.label : undefined,
        sourcePin: decodeHandle(
          edge.sourceHandle,
          dataChannel ? "" : kind === "route" ? String(edge.label ?? "default") : "then"
        ),
        targetPin: decodeHandle(edge.targetHandle, dataChannel ? "" : "in"),
        ...(waypoints ? { waypoints } : {})
      };
    }),
    ...(variables ? { variables } : {})
  };
}

export function applyVariablesToRfNodes(nodes: FlowRfNode[], variables: WorkflowVariable[]): FlowRfNode[] {
  const inputs = Object.fromEntries(
    variables
      .filter((variable) => variable.role === "input")
      .map((variable) => [variable.name, { required: variable.required, shape: variable.shape }])
  );
  const outputs = Object.fromEntries(
    variables
      .filter((variable) => variable.role === "output")
      .map((variable) => [variable.name, { required: variable.required, shape: variable.shape }])
  );
  return nodes.map((node) => {
    const workflow = node.data.workflow;
    if (workflow.type === "start") {
      return {
        ...node,
        data: { workflow: { ...workflow, data: { ...workflow.data, outputContracts: inputs } } }
      };
    }
    if (workflow.type === "end") {
      return {
        ...node,
        data: { workflow: { ...workflow, data: { ...workflow.data, inputs: outputs } } }
      };
    }
    return node;
  });
}

export function loadInitialGraph(metadata: JsonRecord): WorkflowGraph {
  const parsed = parseWorkflowGraph(metadata.graph);
  if (parsed.ok) {
    return parsed.graph;
  }
  return emptyWorkflowGraph();
}

export function defaultEdgeKindForConnection(
  sourceType: string | undefined,
  targetType: string | undefined,
  preferred?: WorkflowEdgeKind
): WorkflowEdgeKind {
  if (preferred) {
    return preferred;
  }
  if (targetType === "join") {
    return "depends_on";
  }
  if (sourceType === "switch" || sourceType === "branch" || sourceType === "gate" || sourceType === "foreach") {
    return "route";
  }
  return "next";
}
