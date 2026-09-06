"use client";

import type { WorkflowQuerySlot, WorkflowQuerySlotKind } from "@projectplaner/core";
import { Button } from "../../../ui";

export function QueryAddSlotButtons({
  allowed,
  slots,
  onAdd
}: {
  allowed: Set<WorkflowQuerySlotKind>;
  slots: WorkflowQuerySlot[];
  onAdd: (slot: Omit<WorkflowQuerySlot, "id"> & { id?: string }) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1">
      {allowed.has("field") ? (
        <Button
          size="xs"
          variant="outline"
          onClick={() => onAdd({ id: "key", slot: "field", field: "key", op: "eq", source: "const", value: "" })}
        >
          Add filter
        </Button>
      ) : null}
      {allowed.has("relatedTo") ? (
        <Button
          size="xs"
          variant="outline"
          onClick={() => onAdd({ slot: "relatedTo", source: "const", value: "" })}
        >
          Add join
        </Button>
      ) : null}
      {allowed.has("q") && !slots.some((slot) => slot.slot === "q") ? (
        <Button size="xs" variant="outline" onClick={() => onAdd({ slot: "q", source: "pin" })}>
          Add text
        </Button>
      ) : null}
      {allowed.has("relations") && !slots.some((slot) => slot.slot === "relations") ? (
        <Button size="xs" variant="outline" onClick={() => onAdd({ slot: "relations", source: "pin" })}>
          Add relations
        </Button>
      ) : null}
    </div>
  );
}
