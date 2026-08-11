import {
  emptyWorkflowGraph,
  parseWorkflowGraph,
  type JsonRecord,
  type WorkflowEdgeKind,
  type WorkflowGraph,
  type WorkflowNode
} from "@projectplaner/core";
import type { Edge, Node } from "@xyflow/react";

export type FlowRfNode = Node<{ workflow: WorkflowNode }, "workflow">;

const EDGE_STYLE: Record<WorkflowEdgeKind, Partial<Edge>> = {
  next: { animated: false, style: { stroke: "#3f3f46", strokeWidth: 1.5 } },
  route: { animated: false, style: { stroke: "#7c3aed", strokeWidth: 1.75 }, labelStyle: { fill: "#5b21b6", fontSize: 10 } },
  depends_on: {
    animated: false,
    style: { stroke: "#0369a1", strokeWidth: 1.5, strokeDasharray: "6 4" },
    labelStyle: { fill: "#0c4a6e", fontSize: 10 }
  },
  error: { animated: false, style: { stroke: "#e11d48", strokeWidth: 1.75 }, labelStyle: { fill: "#9f1239", fontSize: 10 } }
};

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

export function toRfEdges(graph: WorkflowGraph): Edge[] {
  return graph.edges.map((edge) => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    label: edge.kind === "route" || edge.kind === "depends_on" || edge.kind === "error" ? edge.label ?? edge.kind : edge.label,
    data: { kind: edge.kind },
    ...EDGE_STYLE[edge.kind]
  }));
}

export function fromRf(nodes: FlowRfNode[], edges: Edge[], version: number): WorkflowGraph {
  return {
    version,
    nodes: nodes.map((node) => ({
      ...node.data.workflow,
      id: node.id,
      position: node.position
    })),
    edges: edges.map((edge) => {
      const kind = (edge.data?.kind as WorkflowEdgeKind | undefined) ?? "next";
      return {
        id: edge.id,
        source: edge.source,
        target: edge.target,
        kind,
        label: typeof edge.label === "string" ? edge.label : undefined
      };
    })
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
  if (sourceType === "switch" || sourceType === "branch" || sourceType === "gate") {
    return "route";
  }
  return "next";
}
