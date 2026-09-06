"use client";

import type { WorkflowNode, WorkflowNodeData } from "@projectplaner/core";
import { Button, Input } from "../../../ui";

export function SwitchCasesEditor({
  selected,
  onUpdateData
}: {
  selected: WorkflowNode;
  onUpdateData: (patch: Partial<WorkflowNodeData>) => void;
}) {
  if (selected.type !== "switch") {
    return null;
  }
  const cases = selected.data.switch?.cases ?? [];
  return (
    <div className="space-y-2">
      <div className="text-[11px] font-medium text-zinc-700">Cases</div>
      {cases.map((caseLabel, index) => (
        <div key={`${caseLabel}-${index}`} className="flex gap-1">
          <Input
            className="text-xs"
            value={caseLabel}
            onChange={(event) => {
              const next = [...cases];
              next[index] = event.target.value;
              onUpdateData({ switch: { ...(selected.data.switch ?? {}), cases: next } });
            }}
          />
          <Button
            size="xs"
            variant="danger"
            onClick={() => {
              const next = cases.filter((_, itemIndex) => itemIndex !== index);
              onUpdateData({ switch: { ...(selected.data.switch ?? {}), cases: next } });
            }}
          >
            Remove
          </Button>
        </div>
      ))}
      <Button
        size="xs"
        variant="outline"
        onClick={() =>
          onUpdateData({
            switch: {
              ...(selected.data.switch ?? { defaultLabel: "default" }),
              cases: [...cases, `case_${cases.length + 1}`]
            }
          })
        }
      >
        Add case
      </Button>
    </div>
  );
}
