import { decodeHandle, encodeHandle, type FlowRfEdge } from "./rf-adapters";

function matchesPort(edge: FlowRfEdge, nodeId: string, direction: "in" | "out", portId: string) {
  return edge.data?.kind === "data" && (direction === "in"
    ? edge.target === nodeId && decodeHandle(edge.targetHandle, "") === portId
    : edge.source === nodeId && decodeHandle(edge.sourceHandle, "") === portId);
}

export function renameDataPortEdges(edges: FlowRfEdge[], nodeId: string, direction: "in" | "out", from: string, to: string): FlowRfEdge[] {
  return edges.map((edge) => matchesPort(edge, nodeId, direction, from)
    ? { ...edge, [direction === "in" ? "targetHandle" : "sourceHandle"]: encodeHandle(direction, to, "data") }
    : edge);
}

export function removeDataPortEdges(edges: FlowRfEdge[], nodeId: string, direction: "in" | "out", portId: string): FlowRfEdge[] {
  return edges.filter((edge) => !matchesPort(edge, nodeId, direction, portId));
}
