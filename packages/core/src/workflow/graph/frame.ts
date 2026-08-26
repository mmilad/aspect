import { findVariable, pinKey, usesPinFrame } from "./variables";
import type { WorkflowContextBag, WorkflowGraph, WorkflowRunFrame } from "./types";
import type { WorkflowNode } from "../nodes/_shared/types";

export function emptyFrame(): WorkflowRunFrame {
  return { inputs: {}, outputs: {}, locals: {}, pins: {}, pinSeq: {}, seq: 0 };
}

export function ensureFrame(bag: WorkflowContextBag): WorkflowRunFrame {
  if (bag.frame) {
    return bag.frame;
  }
  const frame = emptyFrame();
  bag.frame = frame;
  return frame;
}

export function cloneBagWithFrame(
  bag: WorkflowContextBag,
  frame: WorkflowRunFrame
): WorkflowContextBag {
  return {
    ...bag,
    keys: { ...bag.keys },
    frame: {
      inputs: { ...frame.inputs },
      outputs: { ...frame.outputs },
      locals: { ...frame.locals },
      pins: { ...frame.pins },
      pinSeq: { ...(frame.pinSeq ?? {}) },
      seq: frame.seq ?? 0
    }
  };
}

export function cloneContextBag(bag: WorkflowContextBag): WorkflowContextBag {
  return {
    ...bag,
    keys: { ...bag.keys },
    frontier: bag.frontier ? [...bag.frontier] : undefined,
    history: bag.history ? bag.history.map((entry) => ({ ...entry })) : undefined,
    visits: bag.visits ? { ...bag.visits } : undefined,
    ...(bag.frame ? { frame: cloneBagWithFrame(bag, bag.frame).frame } : {})
  };
}

export function initFrameFromRunInputs(
  graph: WorkflowGraph,
  bag: WorkflowContextBag
): WorkflowRunFrame {
  const frame = emptyFrame();
  for (const variable of graph.variables ?? []) {
    if (variable.role !== "input") {
      continue;
    }
    if (variable.name in bag.keys) {
      frame.inputs[variable.name] = bag.keys[variable.name];
    } else if (variable.name === "goal" && bag.goal) {
      frame.inputs.goal = bag.goal;
    }
  }
  return frame;
}

function readSourcePin(
  graph: WorkflowGraph,
  frame: WorkflowRunFrame,
  source: WorkflowNode,
  sourcePin: string,
  seen: Set<string>
): unknown {
  if (source.type === "reroute") {
    return resolveDataInputFromFrame(graph, frame, source, sourcePin || "value", seen);
  }
  if (source.type === "start") {
    return sourcePin in frame.inputs ? frame.inputs[sourcePin] : frame.pins[pinKey(source.id, sourcePin)];
  }
  if (source.type === "get") {
    const name = source.data.variable ?? sourcePin;
    const variable = findVariable(graph, name);
    if (variable?.role === "input") {
      return frame.inputs[name];
    }
    if (variable?.role === "output") {
      return frame.outputs[name];
    }
    return frame.locals[name];
  }
  return frame.pins[pinKey(source.id, sourcePin)];
}

function resolveDataInputFromFrame(
  graph: WorkflowGraph,
  frame: WorkflowRunFrame,
  node: WorkflowNode,
  portId: string,
  seen: Set<string>
): unknown {
  const guard = pinKey(node.id, portId);
  if (seen.has(guard)) {
    return undefined;
  }
  seen.add(guard);
  const incoming = graph.edges.filter(
    (edge) => edge.target === node.id && edge.kind === "data" && (edge.targetPin ?? "") === portId
  );
  if (incoming.length === 0) {
    return frame.pins[guard];
  }
  let best: unknown = frame.pins[guard];
  let bestSeq = frame.pinSeq?.[guard] ?? -1;
  for (const edge of incoming) {
    const source = graph.nodes.find((item) => item.id === edge.source);
    if (!source) {
      continue;
    }
    const sourcePin = edge.sourcePin ?? "";
    const value = readSourcePin(graph, frame, source, sourcePin, seen);
    const seq = frame.pinSeq?.[pinKey(source.id, sourcePin)] ?? 0;
    if (seq >= bestSeq) {
      best = value;
      bestSeq = seq;
    }
  }
  return best;
}

export function resolveDataInput(
  graph: WorkflowGraph,
  bag: WorkflowContextBag,
  node: WorkflowNode,
  portId: string
): unknown {
  if (!usesPinFrame(graph)) {
    return bag.keys[portId];
  }
  const frame = bag.frame ?? emptyFrame();
  return resolveDataInputFromFrame(graph, frame, node, portId, new Set());
}

function propagateWrittenPin(
  graph: WorkflowGraph,
  pins: Record<string, unknown>,
  pinSeq: Record<string, number>,
  sourceId: string,
  sourcePin: string,
  value: unknown,
  seq: number,
  seen: Set<string>
): void {
  const guard = pinKey(sourceId, sourcePin);
  if (seen.has(guard)) {
    return;
  }
  seen.add(guard);
  for (const edge of graph.edges) {
    if (edge.kind !== "data" || edge.source !== sourceId || (edge.sourcePin ?? "") !== sourcePin) {
      continue;
    }
    const targetPin = edge.targetPin ?? "";
    const targetKey = pinKey(edge.target, targetPin);
    pins[targetKey] = value;
    pinSeq[targetKey] = seq;
    const target = graph.nodes.find((item) => item.id === edge.target);
    if (target?.type === "reroute") {
      propagateWrittenPin(graph, pins, pinSeq, target.id, targetPin || "value", value, seq, seen);
    }
  }
}

export function writeOutputPins(
  graph: WorkflowGraph,
  bag: WorkflowContextBag,
  node: WorkflowNode,
  values: Record<string, unknown>
): WorkflowContextBag {
  const frame = ensureFrame(bag);
  const pins = { ...frame.pins };
  const pinSeq = { ...(frame.pinSeq ?? {}) };
  let seq = frame.seq ?? 0;
  for (const [portId, value] of Object.entries(values)) {
    seq += 1;
    const key = pinKey(node.id, portId);
    pins[key] = value;
    pinSeq[key] = seq;
    propagateWrittenPin(graph, pins, pinSeq, node.id, portId, value, seq, new Set());
  }
  return cloneBagWithFrame(bag, { ...frame, pins, pinSeq, seq });
}

export function copyEndOutputs(
  graph: WorkflowGraph,
  bag: WorkflowContextBag,
  endNode: WorkflowNode
): WorkflowContextBag {
  const frame = ensureFrame(bag);
  const outputs = { ...frame.outputs };
  for (const variable of graph.variables ?? []) {
    if (variable.role !== "output") {
      continue;
    }
    outputs[variable.name] = resolveDataInput(graph, bag, endNode, variable.name);
  }
  return cloneBagWithFrame(bag, { ...frame, outputs });
}
