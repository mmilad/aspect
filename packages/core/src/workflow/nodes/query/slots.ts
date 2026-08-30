import type { EntityFieldName } from "../../../domain/query/types";
import type {
  WorkflowQueryOp,
  WorkflowQuerySlot,
  WorkflowQuerySlotOp
} from "../_shared/types";

export const QUERY_FIELD_NAMES: EntityFieldName[] = ["id", "type", "status", "key", "slug", "title"];

export const querySlotFieldOps: WorkflowQuerySlotOp[] = ["eq", "neq", "in", "match"];

export const querySlotRelDirections = ["out", "in", "either"] as const;

export function hasSlotValue(value: unknown): boolean {
  if (value === undefined || value === null) {
    return false;
  }
  if (typeof value === "string" && !value.trim()) {
    return false;
  }
  if (Array.isArray(value) && value.length === 0) {
    return false;
  }
  return true;
}

export function uniqueSlotId(slots: WorkflowQuerySlot[], base: string): string {
  if (!slots.some((slot) => slot.id === base)) {
    return base;
  }
  let index = 2;
  while (slots.some((slot) => slot.id === `${base}_${index}`)) {
    index += 1;
  }
  return `${base}_${index}`;
}

export function defaultSlotsForOp(op: WorkflowQueryOp): WorkflowQuerySlot[] {
  switch (op) {
    case "get":
    case "neighborhood":
      return [{ id: "id", slot: "id", source: "pin" }];
    case "search":
      return [{ id: "q", slot: "q", source: "pin" }];
    case "filter":
      return [{ id: "from", slot: "from", source: "pin" }];
    default:
      return [];
  }
}
