import type { WorkflowQuerySlot } from "@projectplaner/core";

export function slotLabel(slot: WorkflowQuerySlot): string {
  switch (slot.slot) {
    case "field":
      return `Filter ${slot.field ?? "field"}`;
    case "relatedTo":
      return "Join relatedTo";
    case "rel":
      return "Join";
    case "q":
      return "Text q";
    case "id":
      return "Id";
    case "from":
      return "From";
    case "relations":
      return "Relations";
    default:
      return slot.slot;
  }
}

export function valueAsString(value: unknown): string {
  if (value === undefined || value === null) {
    return "";
  }
  if (typeof value === "string") {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map(String).join(", ");
  }
  return String(value);
}
