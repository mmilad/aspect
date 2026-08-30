import { isRecord } from "../_shared/schema";
import type { EntityRelationType, EntityType } from "../../../domain/types";
import type { EntityFieldName } from "../../../domain/query/types";
import type {
  WorkflowNodeData,
  WorkflowQueryConfig,
  WorkflowQueryOp,
  WorkflowQuerySlot,
  WorkflowQuerySlotKind,
  WorkflowQuerySlotOp,
  WorkflowQuerySlotRel
} from "../_shared/types";
import { querySlotKinds } from "../_shared/types";
import { isEntityFilter, QUERY_CATALOG, queryEntityTypes } from "./catalog";
import { QUERY_FIELD_NAMES, querySlotFieldOps, querySlotRelDirections } from "./slots";

const QUERY_OP_SET = new Set<string>(Object.keys(QUERY_CATALOG));
const ENTITY_TYPE_SET = new Set<string>(queryEntityTypes);
const SELECT_SET = new Set(["compact", "full"]);
const SLOT_KIND_SET = new Set<string>(querySlotKinds);
const SLOT_SOURCE_SET = new Set(["const", "pin"]);
const FIELD_NAME_SET = new Set<string>(QUERY_FIELD_NAMES);
const FIELD_OP_SET = new Set<string>(querySlotFieldOps);
const REL_DIR_SET = new Set<string>(querySlotRelDirections);

function parseSlotRel(raw: unknown, nodeId: string, index: number, errors: string[]): WorkflowQuerySlotRel | undefined {
  if (raw === undefined) {
    return undefined;
  }
  if (!isRecord(raw)) {
    errors.push(`Node ${nodeId} query.slots[${index}].rel must be an object.`);
    return undefined;
  }
  if (typeof raw.direction !== "string" || !REL_DIR_SET.has(raw.direction)) {
    errors.push(`Node ${nodeId} query.slots[${index}].rel.direction must be out|in|either.`);
    return undefined;
  }
  const rel: WorkflowQuerySlotRel = { direction: raw.direction as WorkflowQuerySlotRel["direction"] };
  if (raw.types !== undefined) {
    if (!Array.isArray(raw.types) || !raw.types.every((item) => typeof item === "string")) {
      errors.push(`Node ${nodeId} query.slots[${index}].rel.types must be a string array.`);
    } else {
      rel.types = raw.types as EntityRelationType[];
    }
  }
  return rel;
}

function parseSlot(raw: unknown, nodeId: string, index: number, errors: string[]): WorkflowQuerySlot | undefined {
  if (!isRecord(raw)) {
    errors.push(`Node ${nodeId} query.slots[${index}] must be an object.`);
    return undefined;
  }
  if (typeof raw.id !== "string" || !raw.id.trim()) {
    errors.push(`Node ${nodeId} query.slots[${index}].id must be a non-empty string.`);
    return undefined;
  }
  if (typeof raw.slot !== "string" || !SLOT_KIND_SET.has(raw.slot)) {
    errors.push(`Node ${nodeId} query.slots[${index}].slot is not a known slot kind.`);
    return undefined;
  }
  if (typeof raw.source !== "string" || !SLOT_SOURCE_SET.has(raw.source)) {
    errors.push(`Node ${nodeId} query.slots[${index}].source must be const|pin.`);
    return undefined;
  }
  const slot: WorkflowQuerySlot = {
    id: raw.id.trim(),
    slot: raw.slot as WorkflowQuerySlotKind,
    source: raw.source as "const" | "pin"
  };
  if (raw.field !== undefined) {
    if (typeof raw.field !== "string" || !FIELD_NAME_SET.has(raw.field)) {
      errors.push(`Node ${nodeId} query.slots[${index}].field is not a known entity field.`);
    } else {
      slot.field = raw.field as EntityFieldName;
    }
  }
  if (raw.op !== undefined) {
    if (typeof raw.op !== "string" || !FIELD_OP_SET.has(raw.op)) {
      errors.push(`Node ${nodeId} query.slots[${index}].op must be eq|neq|in|match.`);
    } else {
      slot.op = raw.op as WorkflowQuerySlotOp;
    }
  }
  const rel = parseSlotRel(raw.rel, nodeId, index, errors);
  if (rel) {
    slot.rel = rel;
  }
  if (raw.value !== undefined) {
    slot.value = raw.value;
  }
  if (slot.slot === "field" && !slot.field) {
    errors.push(`Node ${nodeId} query.slots[${index}].field is required when slot is field.`);
  }
  return slot;
}

export function parseQueryConfig(
  raw: unknown,
  nodeId: string,
  errors: string[]
): WorkflowQueryConfig | undefined {
  if (raw === undefined) {
    errors.push(`Node ${nodeId} requires query config.`);
    return undefined;
  }
  if (!isRecord(raw)) {
    errors.push(`Node ${nodeId} query config must be an object.`);
    return undefined;
  }
  if (typeof raw.op !== "string" || !QUERY_OP_SET.has(raw.op)) {
    errors.push(
      `Node ${nodeId} query.op must be ${Object.keys(QUERY_CATALOG).join("|")}.`
    );
    return undefined;
  }

  const query: WorkflowQueryConfig = { op: raw.op as WorkflowQueryOp };
  const spec = QUERY_CATALOG[query.op];

  if (raw.type !== undefined) {
    if (typeof raw.type !== "string" || !ENTITY_TYPE_SET.has(raw.type)) {
      errors.push(`Node ${nodeId} query.type is not a known entity type.`);
    } else {
      query.type = raw.type as EntityType;
    }
  }
  if (raw.limit !== undefined) {
    if (typeof raw.limit !== "number" || !Number.isInteger(raw.limit) || raw.limit < 1) {
      errors.push(`Node ${nodeId} query.limit must be a positive integer.`);
    } else {
      query.limit = raw.limit;
    }
  }
  if (raw.includeArchived !== undefined) {
    if (typeof raw.includeArchived !== "boolean") {
      errors.push(`Node ${nodeId} query.includeArchived must be a boolean.`);
    } else {
      query.includeArchived = raw.includeArchived;
    }
  }
  if (raw.select !== undefined) {
    if (typeof raw.select !== "string" || !SELECT_SET.has(raw.select)) {
      errors.push(`Node ${nodeId} query.select must be compact|full.`);
    } else {
      query.select = raw.select as "compact" | "full";
    }
  }
  if (raw.depth !== undefined) {
    if (typeof raw.depth !== "number" || !Number.isInteger(raw.depth) || raw.depth < 1) {
      errors.push(`Node ${nodeId} query.depth must be a positive integer.`);
    } else {
      query.depth = raw.depth;
    }
  }
  if (raw.where !== undefined) {
    if (!isEntityFilter(raw.where)) {
      errors.push(`Node ${nodeId} query.where must be an object.`);
    } else {
      query.where = raw.where;
    }
  }
  if (raw.includeRelations !== undefined) {
    if (typeof raw.includeRelations !== "boolean") {
      errors.push(`Node ${nodeId} query.includeRelations must be a boolean.`);
    } else {
      query.includeRelations = raw.includeRelations;
    }
  }
  if (raw.slots !== undefined) {
    if (!Array.isArray(raw.slots)) {
      errors.push(`Node ${nodeId} query.slots must be an array.`);
    } else {
      const slots: WorkflowQuerySlot[] = [];
      const ids = new Set<string>();
      const allowed = new Set<string>(spec.allowedSlots);
      for (let index = 0; index < raw.slots.length; index += 1) {
        const slot = parseSlot(raw.slots[index], nodeId, index, errors);
        if (!slot) {
          continue;
        }
        if (!allowed.has(slot.slot)) {
          errors.push(`Node ${nodeId} query.slots[${index}].slot '${slot.slot}' is not allowed for op ${query.op}.`);
          continue;
        }
        if (ids.has(slot.id)) {
          errors.push(`Node ${nodeId} query.slots[${index}].id '${slot.id}' is duplicated.`);
          continue;
        }
        ids.add(slot.id);
        slots.push(slot);
      }
      if (slots.length > 0) {
        query.slots = slots;
      }
    }
  }

  return query;
}

export function parseQueryNodeConfig(
  raw: Record<string, unknown>,
  nodeId: string,
  errors: string[]
): Partial<WorkflowNodeData> {
  const query = parseQueryConfig(raw.query, nodeId, errors);
  return query ? { query } : {};
}
