import { nodeTypes, type EntityType } from "../../../domain/types";
import type { EntityFilter } from "../../../domain/query/types";
import type {
  BagShape,
  WorkflowBagKeyContract,
  WorkflowNodeData,
  WorkflowQueryConfig,
  WorkflowQueryKind,
  WorkflowQueryOp,
  WorkflowQuerySlot,
  WorkflowQuerySlotKind
} from "../_shared/types";
import { queryOps } from "../_shared/types";
import { hasSlotValue } from "./slots";

const STRING: BagShape = { kind: "primitive", type: "string" };
const NULL_PRIM: BagShape = { kind: "primitive", type: "null" };
const ANY: BagShape = { kind: "any" };
const ENTITY: BagShape = { kind: "ref", ref: "Entity" };
const ENTITY_RELATION: BagShape = { kind: "ref", ref: "EntityRelation" };
const RANKED_TASK: BagShape = { kind: "ref", ref: "RankedTaskCandidate" };
const ENTITIES: BagShape = { kind: "array", items: ENTITY };
const RELATIONS: BagShape = { kind: "array", items: ENTITY_RELATION };
const TASKS: BagShape = { kind: "array", items: RANKED_TASK };
const STRING_ARRAY: BagShape = { kind: "array", items: STRING };
const NULLABLE_ENTITY: BagShape = { kind: "union", options: [ENTITY, NULL_PRIM] };

export { queryOps };
export {
  defaultSlotsForOp,
  hasSlotValue,
  QUERY_FIELD_NAMES,
  querySlotFieldOps,
  querySlotRelDirections,
  uniqueSlotId
} from "./slots";

export const queryEntityTypes: EntityType[] = [...nodeTypes, "task"];

export type QueryConstField =
  | "type"
  | "limit"
  | "includeArchived"
  | "select"
  | "depth"
  | "includeRelations";

export type QueryPin = {
  id: string;
  required: boolean;
  shape: BagShape;
};

export type QueryOpSpec = {
  op: WorkflowQueryOp;
  kind: WorkflowQueryKind;
  label: string;
  constFields: QueryConstField[];
  allowedSlots: WorkflowQuerySlotKind[];
  requiredSlots: WorkflowQuerySlotKind[];
  pinsIn: QueryPin[];
  pinsOut: QueryPin[];
  extraPinsIn?: (query: WorkflowQueryConfig) => QueryPin[];
};

function pin(id: string, shape: BagShape, required = true): QueryPin {
  return { id, required, shape };
}

export const QUERY_CATALOG: Record<WorkflowQueryOp, QueryOpSpec> = {
  get: {
    op: "get",
    kind: "read",
    label: "Get entity",
    constFields: ["type", "select", "includeArchived"],
    allowedSlots: ["id"],
    requiredSlots: ["id"],
    pinsIn: [],
    pinsOut: [pin("entity", NULLABLE_ENTITY)]
  },
  list: {
    op: "list",
    kind: "read",
    label: "List entities",
    constFields: ["type", "limit", "includeArchived", "select"],
    allowedSlots: ["q", "relatedTo", "field", "rel"],
    requiredSlots: [],
    pinsIn: [],
    pinsOut: [pin("entities", ENTITIES)]
  },
  search: {
    op: "search",
    kind: "read",
    label: "Search entities",
    constFields: ["type", "limit", "includeArchived", "select"],
    allowedSlots: ["q", "relatedTo", "field", "rel"],
    requiredSlots: ["q"],
    pinsIn: [],
    pinsOut: [pin("matches", ENTITIES)]
  },
  next_work: {
    op: "next_work",
    kind: "read",
    label: "Next work",
    constFields: ["limit", "includeArchived", "select"],
    allowedSlots: ["relatedTo", "field", "rel"],
    requiredSlots: [],
    pinsIn: [],
    pinsOut: [pin("tasks", TASKS)]
  },
  neighborhood: {
    op: "neighborhood",
    kind: "read",
    label: "Neighborhood",
    constFields: ["depth", "select", "includeArchived"],
    allowedSlots: ["id"],
    requiredSlots: ["id"],
    pinsIn: [],
    pinsOut: [pin("entities", ENTITIES), pin("relations", RELATIONS)]
  },
  filter: {
    op: "filter",
    kind: "filter",
    label: "Filter in bag",
    constFields: ["type", "includeArchived"],
    allowedSlots: ["from", "relations", "q", "relatedTo", "field", "rel"],
    requiredSlots: ["from"],
    pinsIn: [],
    pinsOut: [pin("entities", ENTITIES)]
  },
  create_entity: {
    op: "create_entity",
    kind: "write",
    label: "Create entity",
    constFields: ["type"],
    allowedSlots: [],
    requiredSlots: [],
    pinsIn: [
      pin("title", STRING),
      pin("summary", STRING, false),
      pin("key", STRING, false),
      pin("reason", STRING),
      pin("parentAspectId", STRING, false),
      pin("linkFrom", STRING, false),
      pin("document", ANY, false)
    ],
    pinsOut: [pin("entityId", STRING)],
    extraPinsIn: (query) => (query.type === "task" ? [pin("priority", STRING, false)] : [])
  },
  update_entity: {
    op: "update_entity",
    kind: "write",
    label: "Update entity",
    constFields: [],
    allowedSlots: [],
    requiredSlots: [],
    pinsIn: [
      pin("id", STRING),
      pin("title", STRING, false),
      pin("summary", STRING, false),
      pin("status", STRING, false),
      pin("reason", STRING)
    ],
    pinsOut: [pin("entityId", STRING)]
  },
  rollup_parent_status: {
    op: "rollup_parent_status",
    kind: "write",
    label: "Rollup parent status",
    constFields: [],
    allowedSlots: [],
    requiredSlots: [],
    pinsIn: [pin("entityId", STRING)],
    pinsOut: [pin("updatedIds", STRING_ARRAY), pin("derived", ANY)]
  }
};

export function queryOpSpec(op: WorkflowQueryOp): QueryOpSpec {
  return QUERY_CATALOG[op];
}

/** Required slots missing from `query.slots` are implied as required pins (backward compatible). */
export function effectiveSlots(query: WorkflowQueryConfig): WorkflowQuerySlot[] {
  const spec = QUERY_CATALOG[query.op];
  if (spec.kind === "write") {
    return [];
  }
  const slots = query.slots ?? [];
  const present = new Set(slots.map((slot) => slot.slot));
  const implied: WorkflowQuerySlot[] = [];
  for (const kind of spec.requiredSlots) {
    if (!present.has(kind)) {
      implied.push({ id: kind, slot: kind, source: "pin" });
    }
  }
  return [...slots, ...implied];
}

function slotShape(slot: WorkflowQuerySlot): BagShape {
  if (slot.slot === "from") {
    return ENTITIES;
  }
  if (slot.slot === "relations") {
    return RELATIONS;
  }
  if (slot.op === "in") {
    return ANY;
  }
  return STRING;
}

function isRequiredPin(spec: QueryOpSpec, slot: WorkflowQuerySlot): boolean {
  if (!spec.requiredSlots.includes(slot.slot)) {
    return false;
  }
  return !hasSlotValue(slot.value);
}

export function pinsForQuery(query: WorkflowQueryConfig): { inputs: QueryPin[]; outputs: QueryPin[] } {
  const spec = QUERY_CATALOG[query.op];
  if (spec.kind === "write") {
    return {
      inputs: [...spec.pinsIn, ...(spec.extraPinsIn?.(query) ?? [])],
      outputs: spec.pinsOut
    };
  }
  const seen = new Set<string>();
  const inputs: QueryPin[] = [];
  for (const slot of effectiveSlots(query)) {
    if (slot.source !== "pin" || seen.has(slot.id)) {
      continue;
    }
    seen.add(slot.id);
    inputs.push(pin(slot.id, slotShape(slot), isRequiredPin(spec, slot)));
  }
  return { inputs, outputs: spec.pinsOut };
}

function toContracts(pins: QueryPin[]): Record<string, WorkflowBagKeyContract> {
  return Object.fromEntries(pins.map((item) => [item.id, { required: item.required, shape: item.shape }]));
}

/** Catalog-inferred port contracts for a query config. */
export function portsForQuery(query: WorkflowQueryConfig): {
  inputs: Record<string, WorkflowBagKeyContract>;
  outputContracts: Record<string, WorkflowBagKeyContract>;
} {
  const pins = pinsForQuery(query);
  return {
    inputs: toContracts(pins.inputs),
    outputContracts: toContracts(pins.outputs)
  };
}

/** Overwrite `inputs` / `outputContracts` from the catalog. Bindings are left intact. */
export function applyQueryPorts(data: WorkflowNodeData): WorkflowNodeData {
  const query = data.query;
  if (!query?.op || !(query.op in QUERY_CATALOG)) {
    return data;
  }
  const ports = portsForQuery(query);
  return {
    ...data,
    inputs: ports.inputs,
    outputContracts: ports.outputContracts
  };
}

function pruneBindings(
  bindings: Record<string, string> | undefined,
  pinIds: string[]
): Record<string, string> | undefined {
  if (!bindings) {
    return undefined;
  }
  const allowed = new Set(pinIds);
  const next: Record<string, string> = {};
  for (const [pinId, key] of Object.entries(bindings)) {
    if (allowed.has(pinId) && key.trim()) {
      next[pinId] = key;
    }
  }
  return Object.keys(next).length > 0 ? next : undefined;
}

/**
 * Inspector helper: set `query` and rematerialize ports, dropping bindings to vanished pins.
 */
export function withQueryConfig(data: WorkflowNodeData, query: WorkflowQueryConfig): WorkflowNodeData {
  const next = applyQueryPorts({ ...data, query });
  const inputPins = Object.keys(next.inputs ?? {});
  const outputPins = Object.keys(next.outputContracts ?? {});
  return {
    ...next,
    inputBindings: pruneBindings(data.inputBindings, inputPins),
    writeBindings: pruneBindings(data.writeBindings, outputPins)
  };
}

export function isEntityFilter(value: unknown): value is EntityFilter {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
