"use client";

import type { BagShape, WorkflowInspectorField, WorkflowNode, WorkflowNodeData } from "@projectplaner/core";
import workflow from "@projectplaner/core/workflow";
import { Button, FormLabel, Input } from "../../ui";
import { WorkflowBagPanel } from "../../workflow-workspace/workflow-bag-panel";
import { NodeMeta, renderField, SwitchCasesEditor } from "./fields";
import { BagPortsEditor } from "./ports";

const { getNodeModel } = workflow.nodes;

export interface WorkflowStepInspectorProps {
  selected: WorkflowNode | null;
  bagView: Record<string, BagShape>;
  pinMode?: boolean;
  projectKey?: string;
  onUpdateData: (patch: Partial<WorkflowNodeData>) => void;
  onRenameDataPort?: (nodeId: string, direction: "in" | "out", from: string, to: string) => void;
  onRemoveDataPort?: (nodeId: string, direction: "in" | "out", portId: string) => void;
  onDelete: () => void;
}

export function WorkflowStepInspector({
  selected,
  bagView,
  pinMode = false,
  projectKey = "PLAN",
  onUpdateData,
  onRenameDataPort,
  onRemoveDataPort,
  onDelete
}: WorkflowStepInspectorProps) {
  const highlight =
    selected?.type === "foreach"
      ? [selected.data.foreach?.itemKey ?? "item", selected.data.foreach?.indexKey ?? "index"]
      : [];
  const fields = selected ? (getNodeModel(selected.type).inspectorFields ?? []) : [];
  const visibleFields = fields.filter((field): field is Exclude<WorkflowInspectorField, { kind: "bagPorts" }> => {
    if (!pinMode) {
      return field.kind !== "bagPorts";
    }
    return field.kind !== "bagPorts" && field.kind !== "bagKey";
  });

  return (
    <div className="space-y-3 p-3">
      <WorkflowBagPanel view={bagView} highlightKeys={highlight} />
      {!selected ? (
        <p className="text-sm text-muted-foreground">
          {pinMode
            ? "Select a step to edit title, pins, and node config."
            : "Select a step to edit title, bag bindings, control config, and execution policy."}
        </p>
      ) : (
        <div className="space-y-3">
          <SelectedNodeHeader selected={selected} />
          <NodeMeta selected={selected} />
          <FormLabel label="Title">
            <Input value={selected.data.title} onChange={(event) => onUpdateData({ title: event.target.value })} />
          </FormLabel>
          {selected.type === "start" || selected.type === "end" || selected.type === "query" ? null : (
            <BagPortsEditor
              selected={selected}
              bagView={bagView}
              onUpdateData={onUpdateData}
              onRenameDataPort={(direction, from, to) => onRenameDataPort?.(selected.id, direction, from, to)}
              onRemoveDataPort={(direction, portId) => onRemoveDataPort?.(selected.id, direction, portId)}
            />
          )}
          <SwitchCasesEditor selected={selected} onUpdateData={onUpdateData} />
          {visibleFields.map((field) => renderField(field, selected, bagView, onUpdateData, projectKey))}
          {selected.type !== "start" ? (
            <Button size="xs" variant="danger" onClick={onDelete}>
              Delete node
            </Button>
          ) : null}
        </div>
      )}
    </div>
  );
}

function SelectedNodeHeader({ selected }: { selected: WorkflowNode }) {
  return (
    <div>
      <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Node</div>
      <div className="font-mono text-xs text-zinc-700">{selected.id}</div>
      <div className="mt-0.5 text-[11px] text-muted-foreground">
        type <span className="font-mono text-zinc-700">{selected.type}</span>
      </div>
    </div>
  );
}
