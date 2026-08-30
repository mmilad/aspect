"use client";

import type {
  QueryConstField,
  WorkflowNode,
  WorkflowNodeData,
  WorkflowQueryConfig,
  WorkflowQueryOp,
  WorkflowQuerySlot
} from "@projectplaner/core";
import workflow from "@projectplaner/core/workflow";

const {
  defaultSlotsForOp,
  effectiveSlots,
  QUERY_CATALOG,
  QUERY_FIELD_NAMES,
  queryEntityTypes,
  queryOps,
  uniqueSlotId,
  withQueryConfig
} = workflow.nodes;
import { FormLabel, GhostButton, NativeSelect, Input } from "../../ui";

function slotLabel(slot: WorkflowQuerySlot): string {
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

function valueAsString(value: unknown): string {
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

export function QueryConfigEditor({
  selected,
  onUpdateData
}: {
  selected: WorkflowNode;
  onUpdateData: (patch: Partial<WorkflowNodeData>) => void;
}) {
  const query: WorkflowQueryConfig = selected.data.query ?? { op: "list" };
  const spec = QUERY_CATALOG[query.op];
  const fields = new Set<QueryConstField>(spec.constFields);
  const allowed = new Set(spec.allowedSlots);
  const required = new Set(spec.requiredSlots);
  const slots = effectiveSlots(query);

  function commit(next: WorkflowQueryConfig) {
    onUpdateData(withQueryConfig(selected.data, next));
  }

  function commitSlots(nextSlots: WorkflowQuerySlot[]) {
    commit({ ...query, slots: nextSlots });
  }

  function updateSlot(index: number, patch: Partial<WorkflowQuerySlot>) {
    commitSlots(slots.map((slot, slotIndex) => (slotIndex === index ? { ...slot, ...patch } : slot)));
  }

  function removeSlot(index: number) {
    commitSlots(slots.filter((_, slotIndex) => slotIndex !== index));
  }

  function addSlot(slot: Omit<WorkflowQuerySlot, "id"> & { id?: string }) {
    const base = slot.id ?? slot.slot;
    commitSlots([...slots, { ...slot, id: uniqueSlotId(slots, base) }]);
  }

  return (
    <div className="space-y-2">
      <FormLabel label="Operation">
        <NativeSelect
          value={query.op}
          onChange={(event) => {
            const op = event.target.value as WorkflowQueryOp;
            commit({ ...query, op, slots: defaultSlotsForOp(op) });
          }}
        >
          {queryOps.map((op) => (
            <option key={op} value={op}>
              {QUERY_CATALOG[op].label}
            </option>
          ))}
        </NativeSelect>
      </FormLabel>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{spec.kind}</div>
      {fields.has("type") ? (
        <FormLabel label="Entity type">
          <NativeSelect
            value={query.type ?? ""}
            onChange={(event) => {
              const value = event.target.value;
              commit({ ...query, type: value ? (value as WorkflowQueryConfig["type"]) : undefined });
            }}
          >
            <option value="">any</option>
            {queryEntityTypes.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </NativeSelect>
        </FormLabel>
      ) : null}
      {fields.has("limit") ? (
        <FormLabel label="Limit">
          <Input
            value={query.limit !== undefined ? String(query.limit) : ""}
            onChange={(event) => {
              const raw = event.target.value.trim();
              commit({ ...query, limit: raw ? Number(raw) || undefined : undefined });
            }}
          />
        </FormLabel>
      ) : null}
      {fields.has("depth") ? (
        <FormLabel label="Depth">
          <Input
            value={query.depth !== undefined ? String(query.depth) : "1"}
            onChange={(event) => {
              const parsed = Number(event.target.value);
              commit({ ...query, depth: Number.isInteger(parsed) && parsed >= 1 ? parsed : 1 });
            }}
          />
        </FormLabel>
      ) : null}
      {fields.has("select") ? (
        <FormLabel label="NativeSelect">
          <NativeSelect
            value={query.select ?? "compact"}
            onChange={(event) =>
              commit({ ...query, select: event.target.value === "full" ? "full" : "compact" })
            }
          >
            <option value="compact">compact</option>
            <option value="full">full</option>
          </NativeSelect>
        </FormLabel>
      ) : null}
      {fields.has("includeArchived") ? (
        <FormLabel label="Include archived">
          <NativeSelect
            value={query.includeArchived === true ? "true" : "false"}
            onChange={(event) => commit({ ...query, includeArchived: event.target.value === "true" })}
          >
            <option value="false">no</option>
            <option value="true">yes</option>
          </NativeSelect>
        </FormLabel>
      ) : null}
      {spec.kind !== "write" ? (
        <div className="space-y-2">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Slots</div>
          {slots.map((slot, index) => (
            <div key={`${slot.id}-${index}`} className="space-y-2 rounded-md border border-border p-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  {slotLabel(slot)}
                </span>
                {!required.has(slot.slot) ? (
                  <GhostButton size="xs" onClick={() => removeSlot(index)}>
                    Remove
                  </GhostButton>
                ) : null}
              </div>
              {slot.slot === "field" ? (
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
                        updateSlot(index, { field, id });
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
                        updateSlot(index, { op: event.target.value as NonNullable<WorkflowQuerySlot["op"]> })
                      }
                    >
                      <option value="eq">eq</option>
                      <option value="neq">neq</option>
                      <option value="in">in</option>
                    </NativeSelect>
                  </FormLabel>
                </div>
              ) : null}
              {slot.slot === "relatedTo" || slot.slot === "rel" ? (
                <FormLabel label="Direction">
                  <NativeSelect
                    value={slot.rel?.direction ?? "out"}
                    onChange={(event) =>
                      updateSlot(index, {
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
                      updateSlot(index, { source: event.target.value === "pin" ? "pin" : "const" })
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
                      onChange={(event) => updateSlot(index, { value: event.target.value })}
                    />
                  </FormLabel>
                ) : null}
              </div>
            </div>
          ))}
          <div className="flex flex-wrap gap-1">
            {allowed.has("field") ? (
              <GhostButton
                size="xs"
                onClick={() => addSlot({ id: "key", slot: "field", field: "key", op: "eq", source: "const", value: "" })}
              >
                Add filter
              </GhostButton>
            ) : null}
            {allowed.has("relatedTo") ? (
              <GhostButton
                size="xs"
                onClick={() => addSlot({ slot: "relatedTo", source: "const", value: "" })}
              >
                Add join
              </GhostButton>
            ) : null}
            {allowed.has("q") && !slots.some((slot) => slot.slot === "q") ? (
              <GhostButton size="xs" onClick={() => addSlot({ slot: "q", source: "pin" })}>
                Add text
              </GhostButton>
            ) : null}
            {allowed.has("relations") && !slots.some((slot) => slot.slot === "relations") ? (
              <GhostButton size="xs" onClick={() => addSlot({ slot: "relations", source: "pin" })}>
                Add relations
              </GhostButton>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
