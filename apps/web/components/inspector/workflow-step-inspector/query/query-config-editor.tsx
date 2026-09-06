"use client";

import type {
  QueryConstField,
  WorkflowNode,
  WorkflowNodeData,
  WorkflowQueryConfig,
  WorkflowQuerySlotKind
} from "@projectplaner/core";
import workflow from "@projectplaner/core/workflow";
import { QueryAddSlotButtons } from "./query-add-slot-buttons";
import { QueryConstFields, QueryOperationSelect } from "./query-const-fields";
import { QuerySlotRow } from "./query-slot-row";
import { useQueryConfigActions } from "./use-query-config-actions";

const { effectiveSlots, QUERY_CATALOG } = workflow.nodes;

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
  const allowed = new Set<WorkflowQuerySlotKind>(spec.allowedSlots);
  const required = new Set<WorkflowQuerySlotKind>(spec.requiredSlots);
  const slots = effectiveSlots(query);
  const actions = useQueryConfigActions({ selected, query, slots, onUpdateData });

  return (
    <div className="space-y-2">
      <QueryOperationSelect query={query} onCommit={actions.commit} />
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{spec.kind}</div>
      <QueryConstFields fields={fields} query={query} onCommit={actions.commit} />
      {spec.kind !== "write" ? (
        <div className="space-y-2">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Slots</div>
          {slots.map((slot, index) => (
            <QuerySlotRow
              key={`${slot.id}-${index}`}
              index={index}
              required={required.has(slot.slot)}
              slot={slot}
              slots={slots}
              onRemove={() => actions.removeSlot(index)}
              onUpdate={(patch) => actions.updateSlot(index, patch)}
            />
          ))}
          <QueryAddSlotButtons allowed={allowed} slots={slots} onAdd={actions.addSlot} />
        </div>
      ) : null}
    </div>
  );
}
