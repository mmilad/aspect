"use client";

import type { BagShape, WorkflowNode, WorkflowNodeData } from "@projectplaner/core";
import { PropPicker } from "../../../workflow-workspace/workflow-bag-panel";
import { bagKeyOptions } from "../shared/bag-options";

export function ToolArgsEditor({
  selected,
  bagView,
  onUpdateData
}: {
  selected: WorkflowNode;
  bagView: Record<string, BagShape>;
  onUpdateData: (patch: Partial<WorkflowNodeData>) => void;
}) {
  return (
    <PropPicker
      label="Arg from bag (first mapping value)"
      value={Object.values(selected.data.tool?.argsFromBag ?? {})[0] ?? ""}
      options={bagKeyOptions(bagView)}
      onChange={(value) => {
        const keys = Object.keys(selected.data.tool?.argsFromBag ?? {});
        const argName = keys[0] ?? "value";
        onUpdateData({
          tool: {
            ...(selected.data.tool ?? { name: "" }),
            argsFromBag: { ...(selected.data.tool?.argsFromBag ?? {}), [argName]: value }
          }
        });
      }}
    />
  );
}
