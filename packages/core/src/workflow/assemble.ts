import { getNodeModel } from "./nodes/registry";
import type { WorkflowEdge, WorkflowGraph } from "./graph/types";
import type { WorkflowEdgeKind, WorkflowNode, WorkflowPosition } from "./nodes/_shared/types";
import { parseWorkflowGraph, WORKFLOW_SCHEMA_VERSION } from "./schema";

/**
 * Created-node JSON plus an edge/placement plan.
 * The assembler does not call an LLM and does not invent workflow nodes.
 */
export interface AssembleWorkflowFragmentInput {
  nodes: WorkflowNode[];
  edges: Array<{
    id?: string;
    source: string;
    target: string;
    kind: WorkflowEdgeKind;
    sourcePin?: string;
    targetPin?: string;
    label?: string;
  }>;
  entryNodeId: string;
  exitNodeIds: string[];
  positions?: Record<string, WorkflowPosition>;
}

export interface WorkflowFragment {
  entryNodeId: string;
  exitNodeIds: string[];
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
}

export type AssembleWorkflowFragmentResult =
  | { ok: true; fragment: WorkflowFragment }
  | { ok: false; errors: string[] };

function execPins(node: WorkflowNode, channel: "in" | "out"): string[] {
  const model = getNodeModel(node.type);
  return channel === "in"
    ? (model.execInputs?.(node) ?? ["in"])
    : (model.execOutputs?.(node) ?? ["then"]);
}

function dataPins(node: WorkflowNode, channel: "in" | "out"): string[] {
  const model = getNodeModel(node.type);
  if (channel === "in") {
    const fromModel = model.dataInputs?.(node);
    if (fromModel && fromModel.length > 0) {
      return fromModel;
    }
    return Object.keys(node.data.inputs ?? {});
  }
  const fromModel = model.dataOutputs?.(node);
  if (fromModel && fromModel.length > 0) {
    return fromModel;
  }
  return Object.keys(node.data.outputContracts ?? {});
}

function cloneNode(node: WorkflowNode, position?: WorkflowPosition): WorkflowNode {
  return {
    ...node,
    position: position ?? { ...node.position },
    data: { ...node.data }
  };
}

/**
 * Stitch already-created nodes with an explicit wiring plan.
 * Used by Create workflow later; tests feed node JSON that already passed create_step/factory.
 */
export function assembleWorkflowFragment(
  input: AssembleWorkflowFragmentInput
): AssembleWorkflowFragmentResult {
  const errors: string[] = [];
  const seen = new Set<string>();
  const nodes: WorkflowNode[] = [];

  for (const node of input.nodes) {
    if (seen.has(node.id)) {
      errors.push(`Duplicate node id '${node.id}'.`);
      continue;
    }
    seen.add(node.id);
    nodes.push(cloneNode(node, input.positions?.[node.id]));
  }

  if (!seen.has(input.entryNodeId)) {
    errors.push(`entryNodeId '${input.entryNodeId}' is not in the provided nodes.`);
  }
  for (const exitId of input.exitNodeIds) {
    if (!seen.has(exitId)) {
      errors.push(`exitNodeId '${exitId}' is not in the provided nodes.`);
    }
  }

  const byId = new Map(nodes.map((node) => [node.id, node]));
  const edges: WorkflowEdge[] = [];

  input.edges.forEach((planned, index) => {
    const id = planned.id?.trim() || `e_${index + 1}`;
    const source = byId.get(planned.source);
    const target = byId.get(planned.target);
    if (!source) {
      errors.push(`Edge ${id} source '${planned.source}' is not in the provided nodes.`);
      return;
    }
    if (!target) {
      errors.push(`Edge ${id} target '${planned.target}' is not in the provided nodes.`);
      return;
    }

    const kind = planned.kind;
    const sourcePin =
      planned.sourcePin ??
      (kind === "data" ? undefined : kind === "route" && planned.label ? planned.label : execPins(source, "out")[0]);
    const targetPin = planned.targetPin ?? (kind === "data" ? undefined : execPins(target, "in")[0]);

    if (kind === "data") {
      if (!sourcePin || !targetPin) {
        errors.push(`Data edge ${id} requires sourcePin and targetPin.`);
        return;
      }
      if (!dataPins(source, "out").includes(sourcePin)) {
        errors.push(`Data edge ${id}: '${source.id}' has no data output '${sourcePin}'.`);
      }
      if (!dataPins(target, "in").includes(targetPin)) {
        errors.push(`Data edge ${id}: '${target.id}' has no data input '${targetPin}'.`);
      }
    } else {
      const outPins = execPins(source, "out");
      const inPins = execPins(target, "in");
      if (sourcePin && !outPins.includes(sourcePin)) {
        errors.push(`Exec edge ${id}: '${source.id}' has no exec output '${sourcePin}'.`);
      }
      if (targetPin && !inPins.includes(targetPin)) {
        errors.push(`Exec edge ${id}: '${target.id}' has no exec input '${targetPin}'.`);
      }
    }

    edges.push({
      id,
      source: planned.source,
      target: planned.target,
      kind,
      ...(planned.label ? { label: planned.label } : {}),
      ...(sourcePin ? { sourcePin } : {}),
      ...(targetPin ? { targetPin } : {})
    });
  });

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  const hasStartAndEnd =
    nodes.some((node) => node.type === "start") &&
    nodes.some((node) => node.type === "end" || node.type === "error_end");
  if (hasStartAndEnd) {
    const graph: WorkflowGraph = {
      version: WORKFLOW_SCHEMA_VERSION,
      nodes,
      edges
    };
    const parsed = parseWorkflowGraph(graph);
    if (!parsed.ok) {
      return { ok: false, errors: parsed.errors };
    }
    return {
      ok: true,
      fragment: {
        entryNodeId: input.entryNodeId,
        exitNodeIds: [...input.exitNodeIds],
        nodes: parsed.graph.nodes,
        edges: parsed.graph.edges
      }
    };
  }

  return {
    ok: true,
    fragment: {
      entryNodeId: input.entryNodeId,
      exitNodeIds: [...input.exitNodeIds],
      nodes,
      edges
    }
  };
}

const ANY_SHAPE = { kind: "any" as const };

export type AssembleFromStepDraftsResult =
  | { ok: true; graph: WorkflowGraph; fragment: WorkflowFragment }
  | { ok: false; errors: string[] };

type WiringHint = {
  inputBindings?: Record<string, string>;
  writeBindings?: Record<string, string>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asWorkflowNode(value: unknown): WorkflowNode | null {
  if (!isRecord(value) || typeof value.id !== "string" || typeof value.type !== "string") {
    return null;
  }
  if (!isRecord(value.data) || typeof value.data.title !== "string") {
    return null;
  }
  return value as unknown as WorkflowNode;
}

function uniqueId(base: string, taken: Set<string>): string {
  if (!taken.has(base)) {
    return base;
  }
  let index = 2;
  while (taken.has(`${base}_${index}`)) {
    index += 1;
  }
  return `${base}_${index}`;
}

/**
 * Wrap create_step drafts into a start → nodes → end fragment.
 * Uses wiringHints for data pins; exec spine is sequential.
 */
export function assembleFromStepDrafts(drafts: unknown[]): AssembleFromStepDraftsResult {
  const errors: string[] = [];
  const workNodes: WorkflowNode[] = [];
  const hints: WiringHint[] = [];
  const taken = new Set<string>();
  const seenTitles = new Set<string>();

  drafts.forEach((draft, index) => {
    if (!isRecord(draft)) {
      errors.push(`stepDrafts[${index}] must be an object.`);
      return;
    }
    const validation = isRecord(draft.validation) ? draft.validation : undefined;
    if (validation && validation.ok === false) {
      const details = Array.isArray(validation.errors)
        ? validation.errors.map((item) => String(item)).join("; ")
        : "validation failed";
      errors.push(`stepDrafts[${index}] is invalid: ${details}`);
      return;
    }
    const rawNodes = Array.isArray(draft.nodes) ? draft.nodes : [];
    if (rawNodes.length === 0) {
      errors.push(`stepDrafts[${index}] has no nodes.`);
      return;
    }
    const hintList = Array.isArray(draft.wiringHints)
      ? draft.wiringHints
      : [];
    rawNodes.forEach((raw, nodeIndex) => {
      const node = asWorkflowNode(raw);
      if (!node) {
        errors.push(`stepDrafts[${index}].nodes[${nodeIndex}] is not a workflow node.`);
        return;
      }
      const titleKey = node.data.title.trim().toLowerCase();
      if (seenTitles.has(titleKey)) {
        errors.push(
          `Duplicate node title '${node.data.title}'. Each work node needs a unique title.`
        );
        return;
      }
      if (taken.has(node.id)) {
        errors.push(
          `Duplicate node id '${node.id}' from title '${node.data.title}'. Titles must sanitize to unique ids.`
        );
        return;
      }
      seenTitles.add(titleKey);
      taken.add(node.id);
      workNodes.push({ ...node, id: node.id, position: { x: 240 + workNodes.length * 240, y: 160 } });
      const hint = isRecord(hintList[nodeIndex]) ? (hintList[nodeIndex] as WiringHint) : {};
      hints.push({
        inputBindings: {
          ...(node.data.inputBindings ?? {}),
          ...(isRecord(hint.inputBindings) ? hint.inputBindings : {})
        },
        writeBindings: {
          ...(node.data.writeBindings ?? {}),
          ...(isRecord(hint.writeBindings) ? hint.writeBindings : {})
        }
      });
    });
  });

  if (errors.length > 0) {
    return { ok: false, errors };
  }
  if (workNodes.length === 0) {
    return { ok: false, errors: ["assembleFromStepDrafts needs at least one created node."] };
  }

  const startId = uniqueId("start", taken);
  taken.add(startId);
  const endId = uniqueId("end", taken);
  taken.add(endId);

  const inputKeys = new Set<string>();
  const outputKeys = new Set<string>();
  const producedKeys = new Set<string>();
  workNodes.forEach((_, index) => {
    const hint = hints[index] ?? {};
    for (const key of Object.values(hint.inputBindings ?? {})) {
      if (!key) {
        continue;
      }
      const root = key.split(/[.[\]]/, 1)[0] ?? key;
      if (!producedKeys.has(root)) {
        inputKeys.add(root);
      }
    }
    for (const key of Object.values(hint.writeBindings ?? {})) {
      if (!key) {
        continue;
      }
      const root = key.split(/[.[\]]/, 1)[0] ?? key;
      outputKeys.add(root);
      producedKeys.add(root);
    }
  });

  const startOutputs: WorkflowNode["data"]["outputContracts"] = {};
  for (const key of inputKeys) {
    startOutputs[key] = { required: false, shape: ANY_SHAPE };
  }
  const endInputs: WorkflowNode["data"]["inputs"] = {};
  for (const key of outputKeys) {
    endInputs[key] = { required: false, shape: ANY_SHAPE };
  }

  const start: WorkflowNode = {
    id: startId,
    type: "start",
    position: { x: 40, y: 160 },
    data: {
      title: "Start",
      outputContracts: startOutputs
    }
  };
  const end: WorkflowNode = {
    id: endId,
    type: "end",
    position: { x: 240 + workNodes.length * 240, y: 160 },
    data: {
      title: "End",
      inputs: endInputs
    }
  };

  const plannedEdges: AssembleWorkflowFragmentInput["edges"] = [];
  const chain = [start, ...workNodes, end];
  for (let index = 0; index < chain.length - 1; index += 1) {
    plannedEdges.push({
      source: chain[index]!.id,
      target: chain[index + 1]!.id,
      kind: "next"
    });
  }

  const lastWriter = new Map<string, { nodeId: string; pin: string }>();
  workNodes.forEach((node, index) => {
    const hint = hints[index] ?? {};
    for (const [pin, bagKey] of Object.entries(hint.inputBindings ?? {})) {
      const root = bagKey.split(/[.[\]]/, 1)[0] ?? bagKey;
      const writer = lastWriter.get(root);
      if (writer) {
        plannedEdges.push({
          source: writer.nodeId,
          target: node.id,
          kind: "data",
          sourcePin: writer.pin,
          targetPin: pin
        });
        continue;
      }
      if (!inputKeys.has(root)) {
        continue;
      }
      plannedEdges.push({
        source: startId,
        target: node.id,
        kind: "data",
        sourcePin: root,
        targetPin: pin
      });
    }
    for (const [pin, bagKey] of Object.entries(hint.writeBindings ?? {})) {
      const root = bagKey.split(/[.[\]]/, 1)[0] ?? bagKey;
      lastWriter.set(root, { nodeId: node.id, pin });
    }
  });
  for (const [root, writer] of lastWriter) {
    if (!outputKeys.has(root)) {
      continue;
    }
    plannedEdges.push({
      source: writer.nodeId,
      target: endId,
      kind: "data",
      sourcePin: writer.pin,
      targetPin: root
    });
  }

  const assembled = assembleWorkflowFragment({
    nodes: [start, ...workNodes, end],
    edges: plannedEdges,
    entryNodeId: startId,
    exitNodeIds: [endId]
  });
  if (!assembled.ok) {
    return assembled;
  }

  const graph: WorkflowGraph = {
    version: WORKFLOW_SCHEMA_VERSION,
    variables: [
      ...[...inputKeys].map((name) => ({
        name,
        role: "input" as const,
        shape: ANY_SHAPE,
        required: false
      })),
      ...[...outputKeys].map((name) => ({
        name,
        role: "output" as const,
        shape: ANY_SHAPE,
        required: false
      }))
    ],
    nodes: assembled.fragment.nodes,
    edges: assembled.fragment.edges
  };

  return { ok: true, graph, fragment: assembled.fragment };
}
