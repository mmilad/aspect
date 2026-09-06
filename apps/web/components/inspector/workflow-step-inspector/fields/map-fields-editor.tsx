"use client";

import type { BagShape, WorkflowMapField, WorkflowNode, WorkflowNodeData } from "@projectplaner/core";
import { Button, FormLabel, Input } from "../../../ui";
import { PropPicker } from "../../../workflow-workspace/workflow-bag-panel";
import { pathOptionsForKey } from "./field-options";

export function MapFieldsEditor({
  selected,
  bagView,
  onUpdateData
}: {
  selected: WorkflowNode;
  bagView: Record<string, BagShape>;
  onUpdateData: (patch: Partial<WorkflowNodeData>) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="text-[11px] font-medium text-zinc-700">Fields</div>
      {(selected.data.map?.fields ?? []).map((mapField, index) => (
        <div key={`${mapField.as}-${index}`} className="grid grid-cols-2 gap-1">
          <PropPicker
            label="from"
            value={mapField.from}
            options={pathOptionsForKey(bagView, selected.data.map?.from ?? "")}
            onChange={(value) => patchField(selected, index, { from: value }, onUpdateData)}
          />
          <FormLabel label="as">
            <Input
              value={mapField.as}
              onChange={(event) => patchField(selected, index, { as: event.target.value }, onUpdateData)}
            />
          </FormLabel>
        </div>
      ))}
      <Button
        size="xs"
        variant="outline"
        onClick={() =>
          onUpdateData({
            map: {
              from: selected.data.map?.from ?? "",
              as: selected.data.map?.as ?? "projected",
              mode: selected.data.map?.mode ?? "array",
              fields: [
                ...(selected.data.map?.fields ?? []),
                {
                  from: pathOptionsForKey(bagView, selected.data.map?.from ?? "")[0] ?? "id",
                  as: "field"
                }
              ]
            }
          })
        }
      >
        Add field
      </Button>
    </div>
  );
}

function patchField(
  selected: WorkflowNode,
  index: number,
  patch: Partial<WorkflowMapField>,
  onUpdateData: (patch: Partial<WorkflowNodeData>) => void
) {
  const fields = [...(selected.data.map?.fields ?? [])] as WorkflowMapField[];
  fields[index] = { ...fields[index], ...patch };
  onUpdateData({
    map: {
      from: selected.data.map?.from ?? "",
      as: selected.data.map?.as ?? "projected",
      mode: selected.data.map?.mode,
      fields
    }
  });
}
