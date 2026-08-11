import {
  compactEntity,
  compactRelation,
  composeTaskPrompt,
  neighborhoodContext,
  rankTaskCandidates,
  type RankedTaskCandidate
} from "../../domain/task-candidacy";
import { rankedByQuery, entitySearchValues } from "../../domain/search";
import type { Entity, EntityRelation, EntityType } from "../../domain/types";
import {
  applyBagWrites,
  getNodeWrites,
  resolveNextNodeId
} from "../graph/schema";
import type { WorkflowContextBag, WorkflowGraph } from "../graph/types";
import type { WorkflowFilterWhere } from "../nodes/_shared/types";
import type { WorkflowAdapters, WorkflowMatch, WorkflowToolResult } from "./adapters";
import type { WorkflowStepResult } from "./types";

export function fail(bag: WorkflowContextBag, nodeId: string | null, error: string): WorkflowStepResult {
  return {
    kind: "failed",
    bag: { ...bag, status: "failed", error, cursor: nodeId },
    nodeId,
    message: error
  };
}

export function readPath(value: unknown, field: string): unknown {
  if (!field) {
    return value;
  }
  const parts = field.split(".");
  let current: unknown = value;
  for (const part of parts) {
    if (typeof current !== "object" || current === null || !(part in (current as Record<string, unknown>))) {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

export function matchesWhere(item: unknown, where: WorkflowFilterWhere | undefined): boolean {
  if (!where) {
    return true;
  }
  const actual = readPath(item, where.field);
  if (where.op === "eq") {
    return actual === where.value;
  }
  if (where.op === "neq") {
    return actual !== where.value;
  }
  if (where.op === "in") {
    return Array.isArray(where.value) && where.value.includes(actual);
  }
  return false;
}

export function projectKeys(item: unknown, keys: string[] | undefined): unknown {
  if (!keys || keys.length === 0 || typeof item !== "object" || item === null) {
    return item;
  }
  const record = item as Record<string, unknown>;
  const projected: Record<string, unknown> = {};
  for (const key of keys) {
    if (key in record) {
      projected[key] = record[key];
    }
  }
  return projected;
}

export function mapArgsFromBag(
  mapping: Record<string, string> | undefined,
  bag: WorkflowContextBag
): Record<string, unknown> {
  const args: Record<string, unknown> = {};
  if (!mapping) {
    return args;
  }
  for (const [argName, bagKey] of Object.entries(mapping)) {
    args[argName] = bag.keys[bagKey];
  }
  return args;
}

export function readValuePath(value: unknown, path: string): unknown {
  if (!path) {
    return value;
  }
  return readPath(value, path);
}

export function projectMapFields(
  source: unknown,
  fields: Array<{ from: string; as: string }>
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const field of fields) {
    out[field.as] = readValuePath(source, field.from);
  }
  return out;
}

export function defaultLoadContext(
  entities: Entity[],
  input: { query: string; types?: EntityType[]; limit: number }
): WorkflowMatch[] {
  const pool = input.types?.length
    ? entities.filter((entity) => input.types!.includes(entity.type))
    : entities;
  const ranked = rankedByQuery(pool, input.query, entitySearchValues);
  return ranked.slice(0, input.limit).map(({ item, score }) => ({
    id: item.id,
    type: item.type,
    title: item.title,
    status: item.status,
    summary: item.summary,
    score
  }));
}

export function loadAllEntities(entities: Entity[], types?: EntityType[], limit?: number): WorkflowMatch[] {
  const pool = types?.length ? entities.filter((entity) => types.includes(entity.type)) : entities;
  const sliced = typeof limit === "number" ? pool.slice(0, limit) : pool;
  return sliced.map((item) => ({
    id: item.id,
    type: item.type,
    title: item.title,
    status: item.status,
    summary: item.summary,
    key: item.key
  }));
}

export function asEntityList(value: unknown, fallback: Entity[]): Entity[] {
  if (!Array.isArray(value) || value.length === 0) {
    return fallback;
  }
  if (value.every((item) => typeof item === "object" && item !== null && "id" in item && "type" in item)) {
    return value as Entity[];
  }
  return fallback;
}

export function asRelationList(value: unknown, fallback: EntityRelation[]): EntityRelation[] {
  if (!Array.isArray(value)) {
    return fallback;
  }
  if (
    value.every(
      (item) =>
        typeof item === "object" &&
        item !== null &&
        ("sourceEntityId" in item || "from" in item) &&
        ("targetEntityId" in item || "to" in item)
    )
  ) {
    return value.map((item) => {
      const record = item as Record<string, unknown>;
      if (typeof record.sourceEntityId === "string" && typeof record.targetEntityId === "string") {
        return item as EntityRelation;
      }
      return {
        id: typeof record.id === "string" ? record.id : `${record.from}->${record.to}`,
        projectId: typeof record.projectId === "string" ? record.projectId : "project",
        sourceEntityId: String(record.from),
        targetEntityId: String(record.to),
        type: (typeof record.type === "string" ? record.type : "related_to") as EntityRelation["type"],
        label: typeof record.label === "string" ? record.label : null,
        isPrimary: Boolean(record.primary),
        metadata: {}
      };
    });
  }
  return fallback;
}

export function selectedEntityId(value: unknown): string | null {
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "object" && value !== null && "id" in value && typeof (value as { id: unknown }).id === "string") {
    return (value as { id: string }).id;
  }
  return null;
}

export async function advanceCursor(
  graph: WorkflowGraph,
  bag: WorkflowContextBag,
  fromNodeId: string,
  routeLabel = "default"
): Promise<WorkflowStepResult> {
  const nextId = resolveNextNodeId(graph, fromNodeId, routeLabel);
  if (!nextId) {
    return {
      kind: "completed",
      bag: { ...bag, cursor: null, status: "completed" },
      nodeId: fromNodeId,
      message: "No outgoing edge; treating as completed."
    };
  }
  return {
    kind: "advanced",
    bag: { ...bag, cursor: nextId, status: "running", error: undefined },
    nodeId: nextId
  };
}

export function evaluateSimpleCondition(expression: string | undefined, bag: WorkflowContextBag): boolean {
  if (!expression) {
    return false;
  }
  const trimmed = expression.trim();
  const notMatch = /^!\s*([a-zA-Z0-9_]+)$/.exec(trimmed);
  if (notMatch) {
    return !Boolean(bag.keys[notMatch[1]]);
  }
  const keyMatch = /^([a-zA-Z0-9_]+)$/.exec(trimmed);
  if (keyMatch) {
    return Boolean(bag.keys[keyMatch[1]]);
  }
  const eqMatch = /^([a-zA-Z0-9_]+)\s*==\s*(.+)$/.exec(trimmed);
  if (eqMatch) {
    const left = bag.keys[eqMatch[1]];
    let rightRaw = eqMatch[2].trim();
    if (
      (rightRaw.startsWith('"') && rightRaw.endsWith('"')) ||
      (rightRaw.startsWith("'") && rightRaw.endsWith("'"))
    ) {
      rightRaw = rightRaw.slice(1, -1);
    } else if (rightRaw === "true") {
      return left === true;
    } else if (rightRaw === "false") {
      return left === false;
    } else if (rightRaw === "null") {
      return left === null;
    } else if (!Number.isNaN(Number(rightRaw))) {
      return left === Number(rightRaw);
    }
    return left === rightRaw;
  }
  return Boolean(bag.keys[trimmed]);
}

export async function resolveToolResult(
  adapters: WorkflowAdapters,
  name: string,
  args: Record<string, unknown>
): Promise<WorkflowToolResult | { error: string }> {
  if (adapters.runTool) {
    return adapters.runTool({ name, args });
  }
  const handler = adapters.functions?.[name];
  if (!handler) {
    return { error: `No runTool adapter or registry function for tool '${name}'.` };
  }
  return handler(args);
}

export async function resolveWriteResult(
  adapters: WorkflowAdapters,
  action: "create_entity" | "update_entity" | "rollup_parent_status",
  args: Record<string, unknown>
): Promise<WorkflowToolResult | { error: string }> {
  try {
    if (adapters.runWrite) {
      return await adapters.runWrite({ action, args });
    }
    const handler = adapters.functions?.[action];
    if (!handler) {
      return { error: `No runWrite adapter or registry function for action '${action}'.` };
    }
    return await handler(args);
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) };
  }
}

export function mapBagByMap(
  mapping: Record<string, string> | undefined,
  source: Record<string, unknown>
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (!mapping) {
    return out;
  }
  for (const [targetKey, sourceKey] of Object.entries(mapping)) {
    out[targetKey] = source[sourceKey];
  }
  return out;
}

export {
  applyBagWrites,
  compactEntity,
  compactRelation,
  composeTaskPrompt,
  getNodeWrites,
  neighborhoodContext,
  rankTaskCandidates,
  type RankedTaskCandidate
};
