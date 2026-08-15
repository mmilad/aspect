import { parseWorkflowNode } from "../../graph/schema";
import { getNodeModel } from "../registry";
import { isPosition, isRecord, normalizeNodeType } from "../_shared/schema";
import type { WorkflowNode, WorkflowNodeData, WorkflowNodeType } from "../_shared/types";
import type { NodeExecuteContext, WorkflowStepResult } from "../../runtime/types";

type NodePlan = {
  id?: string;
  nodeType: WorkflowNodeType;
  title?: string;
  purpose?: string;
  position?: { x: number; y: number };
  reads?: string[];
  writes?: string[];
  inputs?: WorkflowNodeData["inputs"];
  outputContracts?: WorkflowNodeData["outputContracts"];
  inputBindings?: Record<string, string>;
  writeBindings?: Record<string, string>;
  config?: Record<string, unknown>;
};

function asStringArray(value: unknown): string[] | undefined {
  return Array.isArray(value) && value.every((item) => typeof item === "string")
    ? value
    : undefined;
}

function availableBagKeys(value: unknown): Set<string> | null {
  if (!isRecord(value)) {
    return null;
  }
  const keys = isRecord(value.keys) ? Object.keys(value.keys) : Object.keys(value);
  return new Set(keys);
}

function pathRoot(path: string): string {
  return path.split(/[.[\]]/, 1)[0] ?? path;
}

function validatePlanSemantics(input: {
  plan: NodePlan;
  allowedNodeTypes: unknown;
  availableBagShape: unknown;
}): string[] {
  const errors: string[] = [];
  const allowed = asStringArray(input.allowedNodeTypes);
  if (input.allowedNodeTypes !== undefined && input.allowedNodeTypes !== null && !allowed) {
    errors.push("allowedNodeTypes must be string[] when provided.");
  }
  if (allowed && !allowed.includes(input.plan.nodeType)) {
    errors.push(`nodePlan.nodeType '${input.plan.nodeType}' is not allowed.`);
  }

  const available = availableBagKeys(input.availableBagShape);
  if (!available) {
    return errors;
  }

  for (const read of input.plan.reads ?? []) {
    if (!available.has(pathRoot(read))) {
      errors.push(`nodePlan.reads references unavailable bag key '${read}'.`);
    }
  }
  for (const [port, key] of Object.entries(input.plan.inputBindings ?? {})) {
    if (!available.has(pathRoot(key))) {
      errors.push(`nodePlan.inputBindings.${port} references unavailable bag key '${key}'.`);
    }
  }

  const config = input.plan.config ?? {};
  if (input.plan.nodeType === "foreach") {
    const rawItemsFrom = config.foreach && isRecord(config.foreach)
      ? config.foreach.itemsFrom
      : config.itemsFrom;
    if (typeof rawItemsFrom === "string" && !available.has(pathRoot(rawItemsFrom))) {
      errors.push(`nodePlan.config.foreach.itemsFrom references unavailable bag key '${rawItemsFrom}'.`);
    }
  }
  if (input.plan.nodeType === "push") {
    const rawPush = config.push && isRecord(config.push) ? config.push : config;
    const target = rawPush.target;
    const valueFrom = rawPush.valueFrom;
    if (typeof target === "string" && !available.has(pathRoot(target))) {
      errors.push(`nodePlan.config.push.target references unavailable bag key '${target}'.`);
    }
    if (typeof valueFrom === "string" && !available.has(pathRoot(valueFrom))) {
      errors.push(`nodePlan.config.push.valueFrom references unavailable bag key '${valueFrom}'.`);
    }
  }
  if (input.plan.nodeType === "branch" || input.plan.nodeType === "switch") {
    const configKey = input.plan.nodeType;
    const rawControl = config[configKey] && isRecord(config[configKey]) ? config[configKey] : config;
    const on = rawControl.on;
    if (typeof on === "string" && !available.has(pathRoot(on))) {
      errors.push(`nodePlan.config.${configKey}.on references unavailable bag key '${on}'.`);
    }
  }
  if (input.plan.nodeType === "map") {
    const rawMap = config.map && isRecord(config.map) ? config.map : config;
    const from = rawMap.from;
    if (typeof from === "string" && !available.has(pathRoot(from))) {
      errors.push(`nodePlan.config.map.from references unavailable bag key '${from}'.`);
    }
  }

  return errors;
}

function sanitizeId(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 48);
}

function parseNodePlan(value: unknown): { ok: true; plan: NodePlan } | { ok: false; errors: string[] } {
  const errors: string[] = [];
  if (!isRecord(value)) {
    return { ok: false, errors: ["nodePlan must be an object."] };
  }

  const rawType = typeof value.nodeType === "string" ? value.nodeType : "";
  const nodeType = normalizeNodeType(rawType);
  if (!nodeType) {
    errors.push(`Unknown workflow node type: ${rawType || "(missing)"}.`);
  }
  const reads = value.reads === undefined ? undefined : asStringArray(value.reads);
  const writes = value.writes === undefined ? undefined : asStringArray(value.writes);
  if (value.reads !== undefined && !reads) {
    errors.push("nodePlan.reads must be string[].");
  }
  if (value.writes !== undefined && !writes) {
    errors.push("nodePlan.writes must be string[].");
  }
  if (value.position !== undefined && !isPosition(value.position)) {
    errors.push("nodePlan.position must be { x:number, y:number }.");
  }
  if (value.config !== undefined && !isRecord(value.config)) {
    errors.push("nodePlan.config must be an object.");
  }

  if (!nodeType || errors.length > 0) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    plan: {
      nodeType,
      id: typeof value.id === "string" ? value.id : undefined,
      title: typeof value.title === "string" ? value.title : undefined,
      purpose: typeof value.purpose === "string" ? value.purpose : undefined,
      position: isPosition(value.position) ? value.position : undefined,
      reads,
      writes,
      inputs: isRecord(value.inputs) ? (value.inputs as WorkflowNodeData["inputs"]) : undefined,
      outputContracts: isRecord(value.outputContracts)
        ? (value.outputContracts as WorkflowNodeData["outputContracts"])
        : undefined,
      inputBindings: isRecord(value.inputBindings)
        ? (value.inputBindings as Record<string, string>)
        : undefined,
      writeBindings: isRecord(value.writeBindings)
        ? (value.writeBindings as Record<string, string>)
        : undefined,
      config: isRecord(value.config) ? value.config : undefined
    }
  };
}

function rawNodeFromPlan(plan: NodePlan): WorkflowNode {
  const model = getNodeModel(plan.nodeType);
  const defaults = model.defaultData();
  const config = plan.config ?? {};
  const configData =
    model.configKey && !(model.configKey in config)
      ? { [model.configKey]: config }
      : config;
  const title = plan.title?.trim() || defaults.title || plan.purpose?.trim() || plan.nodeType;
  const id = sanitizeId(plan.id ?? title) || `${plan.nodeType}_node`;

  return {
    id,
    type: plan.nodeType,
    position: plan.position ?? { x: 0, y: 0 },
    data: {
      ...defaults,
      ...configData,
      title,
      ...(plan.reads ? { reads: plan.reads } : {}),
      ...(plan.writes ? { writes: plan.writes } : {}),
      ...(plan.inputs ? { inputs: plan.inputs } : {}),
      ...(plan.outputContracts ? { outputContracts: plan.outputContracts } : {}),
      ...(plan.inputBindings ? { inputBindings: plan.inputBindings } : {}),
      ...(plan.writeBindings ? { writeBindings: plan.writeBindings } : {})
    }
  };
}

function nodeMeta(node: WorkflowNode) {
  const model = getNodeModel(node.type);
  return {
    nodeType: node.type,
    description: model.description,
    execInputs: model.execInputs?.(node) ?? ["in"],
    execOutputs: model.execOutputs?.(node) ?? ["then"],
    dataInputs: model.dataInputs?.(node) ?? [],
    dataOutputs: model.dataOutputs?.(node) ?? [],
    canvasFields: model.canvasFields?.(node) ?? []
  };
}

function repairInstructions(errors: string[]): string {
  return [
    "Repair the workflow node plan so create_workflow_node can materialize it.",
    "Keep the same user intent, but fix these validation errors:",
    ...errors.map((error) => `- ${error}`)
  ].join("\n");
}

export async function executeCreateWorkflowNode(
  ctx: NodeExecuteContext
): Promise<WorkflowStepResult> {
  const config = ctx.node.data.createWorkflowNode;
  if (!config?.planFrom) {
    return ctx.fail(`Create workflow node ${ctx.node.id} requires createWorkflowNode.planFrom.`);
  }

  const outputKey = config.outputKey ?? "workflowNode";
  const metaKey = config.metaKey ?? "nodeMeta";
  const errorsKey = config.errorsKey ?? "validationErrors";
  const validKey = config.validKey ?? "nodePlanValid";
  const hasErrorsKey = config.hasErrorsKey ?? "hasValidationErrors";
  const repairKey = config.repairInstructionsKey ?? "repairInstructions";
  const stepDraftKey = config.stepDraftKey;

  const parsedPlan = parseNodePlan(ctx.read(config.planFrom));
  const values: Record<string, unknown> = {};

  if (!parsedPlan.ok) {
    values[outputKey] = null;
    values[metaKey] = {};
    values[errorsKey] = parsedPlan.errors;
    values[validKey] = false;
    values[hasErrorsKey] = true;
    values[repairKey] = repairInstructions(parsedPlan.errors);
    if (stepDraftKey) {
      values[stepDraftKey] = {
        nodes: [],
        validation: { ok: false, errors: parsedPlan.errors }
      };
    }
    const applied = ctx.applyWrites(values);
    return applied.ok ? ctx.advance() : ctx.fail(applied.error);
  }

  const semanticErrors = validatePlanSemantics({
    plan: parsedPlan.plan,
    allowedNodeTypes: config.allowedNodeTypesFrom ? ctx.read(config.allowedNodeTypesFrom) : undefined,
    availableBagShape: config.availableBagShapeFrom ? ctx.read(config.availableBagShapeFrom) : undefined
  });
  if (semanticErrors.length > 0) {
    values[outputKey] = null;
    values[metaKey] = {};
    values[errorsKey] = semanticErrors;
    values[validKey] = false;
    values[hasErrorsKey] = true;
    values[repairKey] = repairInstructions(semanticErrors);
    if (stepDraftKey) {
      values[stepDraftKey] = {
        nodes: [],
        validation: { ok: false, errors: semanticErrors }
      };
    }
    const applied = ctx.applyWrites(values);
    return applied.ok ? ctx.advance() : ctx.fail(applied.error);
  }

  const parsedNode = parseWorkflowNode(rawNodeFromPlan(parsedPlan.plan));
  if (!parsedNode.ok) {
    values[outputKey] = null;
    values[metaKey] = {};
    values[errorsKey] = parsedNode.errors;
    values[validKey] = false;
    values[hasErrorsKey] = true;
    values[repairKey] = repairInstructions(parsedNode.errors);
    if (stepDraftKey) {
      values[stepDraftKey] = {
        nodes: [],
        validation: { ok: false, errors: parsedNode.errors }
      };
    }
    const applied = ctx.applyWrites(values);
    return applied.ok ? ctx.advance() : ctx.fail(applied.error);
  }

  const meta = nodeMeta(parsedNode.node);
  values[outputKey] = parsedNode.node;
  values[metaKey] = meta;
  values[errorsKey] = [];
  values[validKey] = true;
  values[hasErrorsKey] = false;
  values[repairKey] = "";
  if (stepDraftKey) {
    values[stepDraftKey] = {
      nodes: [parsedNode.node],
      nodeMeta: [meta],
      validation: { ok: true, errors: [] }
    };
  }

  const applied = ctx.applyWrites(values);
  return applied.ok ? ctx.advance() : ctx.fail(applied.error);
}
