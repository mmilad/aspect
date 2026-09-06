"use client";

import type { WorkflowQuerySlot } from "@projectplaner/core";
import workflow from "@projectplaner/core/workflow";
import { Button, FormLabel, Input, NativeSelect } from "../../../ui";
import { slotLabel, valueAsString } from "./slot-utils";

const { QUERY_FIELD_NAMES, uniqueSlotId } = workflow.nodes;

export function QuerySlotRow({
  index,
  required,
  slot,
  slots,
  onRemove,
  onUpdate
}: {
  index: number;
  required: boolean;
  slot: WorkflowQuerySlot;
  slots: WorkflowQuerySlot[];
  onRemove: () => void;
  onUpdate: (patch: Partial<WorkflowQuerySlot>) => void;
}) {
  return (
    <div className="space-y-2 rounded-md border border-border p-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          {slotLabel(slot)}
        </span>
        {!required ? (
          <Button size="xs" variant="outline" onClick={onRemove}>
            Remove
          </Button>
        ) : null}
      </div>
      {slot.slot === "field" ? (
        <FieldSlotControls
          index={index}
          slot={slot}
          slots={slots}
          onUpdate={onUpdate}
        />
      ) : null}
      {slot.slot === "relatedTo" || slot.slot === "rel" ? (
        <FormLabel label="Direction">
          <NativeSelect
            value={slot.rel?.direction ?? "out"}
            onChange={(event) =>
              onUpdate({
                rel: {
                  ...slot.rel,
                  direction: event.target.value as NonNullable<WorkflowQuerySlot["rel"]>["direction"]
                }
              })
            }
          >
            <option value="out">out</option>
            <option value="in">in</option>
            <option value="either">either</option>
          </NativeSelect>
        </FormLabel>
      ) : null}
      <div className="grid grid-cols-2 gap-2">
        <FormLabel label="Source">
          <NativeSelect
            value={slot.source}
            onChange={(event) =>
              onUpdate({ source: event.target.value === "pin" ? "pin" : "const" })
            }
          >
            <option value="const">const</option>
            <option value="pin">pin</option>
          </NativeSelect>
        </FormLabel>
        {slot.slot !== "from" && slot.slot !== "relations" ? (
          <FormLabel label={slot.source === "pin" ? "Default" : "Value"}>
            <Input
              value={valueAsString(slot.value)}
              onChange={(event) => onUpdate({ value: event.target.value })}
            />
          </FormLabel>
        ) : null}
      </div>
    </div>
  );
}

function FieldSlotControls({
  index,
  slot,
  slots,
  onUpdate
}: {
  index: number;
  slot: WorkflowQuerySlot;
  slots: WorkflowQuerySlot[];
  onUpdate: (patch: Partial<WorkflowQuerySlot>) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <FormLabel label="Field">
        <NativeSelect
          value={slot.field ?? "key"}
          onChange={(event) => {
            const field = event.target.value as NonNullable<WorkflowQuerySlot["field"]>;
            const id = slot.id === slot.field || slot.id === "field" ? uniqueSlotId(
              slots.filter((_, slotIndex) => slotIndex !== index),
              field
            ) : slot.id;
            onUpdate({ field, id });
          }}
        >
          {QUERY_FIELD_NAMES.map((field) => (
            <option key={field} value={field}>
              {field}
            </option>
          ))}
        </NativeSelect>
      </FormLabel>
      <FormLabel label="Op">
        <NativeSelect
          value={slot.op ?? "eq"}
          onChange={(event) =>
            onUpdate({ op: event.target.value as NonNullable<WorkflowQuerySlot["op"]> })
          }
        >
          <option value="eq">eq</option>
          <option value="neq">neq</option>
          <option value="in">in</option>
        </NativeSelect>
      </FormLabel>
    </div>
  );
}
