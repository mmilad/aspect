import {
  emptyWorkflowGraph,
  parseWorkflowGraph,
  type JsonRecord,
  type WorkflowGraph,
  type WorkflowNode
} from "@projectplaner/core";
import type { Edge, Node } from "@xyflow/react";

export type FlowRfNode = Node<{ workflow: WorkflowNode }, "workflow">;

export function toRfNodes(graph: WorkflowGraph, selectedId: string | null): FlowRfNode[] {
  return graph.nodes.map((node) => ({
    id: node.id,
    type: "workflow",
    position: node.position,
    selected: node.id === selectedId,
    data: { workflow: node }
  }));
}

export function toRfEdges(graph: WorkflowGraph): Edge[] {
  return graph.edges.map((edge) => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    label: edge.label,
    animated: false
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
    edges: edges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      label: typeof edge.label === "string" ? edge.label : undefined
    }))
  };
}

export function loadInitialGraph(metadata: JsonRecord): WorkflowGraph {
  const parsed = parseWorkflowGraph(metadata.graph);
  if (parsed.ok) {
    return parsed.graph;
  }
  return emptyWorkflowGraph();
}
