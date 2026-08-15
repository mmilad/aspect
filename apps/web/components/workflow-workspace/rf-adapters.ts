import {
  emptyWorkflowGraph,
  parseWaypoints,
  parseWorkflowGraph,
  type BagShape,
  type JsonRecord,
  type WorkflowEdgeKind,
  type WorkflowGraph,
  type WorkflowNode,
  type WorkflowVariable
} from "@projectplaner/core";
import type { CSSProperties } from "react";
import { MarkerType, type Connection, type Edge, type Node } from "@xyflow/react";

export type FlowRfNode = Node<{ workflow: WorkflowNode }, "workflow">;

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

export function isValidConnection(connection: Connection | Edge): boolean {
  const sourceHandle = "sourceHandle" in connection ? connection.sourceHandle : null;
  const targetHandle = "targetHandle" in connection ? connection.targetHandle : null;
  const srcData = isDataHandle(sourceHandle);
  const tgtData = isDataHandle(targetHandle);
  if (srcData || tgtData) {
    return srcData && tgtData && Boolean(sourceHandle?.startsWith("data:out:")) && Boolean(targetHandle?.startsWith("data:in:"));
  }
  return isValidExecConnection({ sourceHandle, targetHandle });
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

function pinShape(
  graph: WorkflowGraph,
  nodeId: string,
  pin: string | undefined,
  channel: "in" | "out"
): BagShape | undefined {
  if (!pin) {
    return undefined;
  }
  const node = graph.nodes.find((item) => item.id === nodeId);
  if (!node) {
    return undefined;
  }
  if (node.type === "get") {
    return graph.variables?.find((variable) => variable.name === node.data.variable)?.shape;
  }
  if (node.type === "set" && channel === "in") {
    return graph.variables?.find((variable) => variable.name === node.data.variable)?.shape;
  }
  if (channel === "out") {
    return node.data.outputContracts?.[pin]?.shape;
  }
  return node.data.inputs?.[pin]?.shape;
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
