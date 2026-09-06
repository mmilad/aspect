import type { BagShape, WorkflowNode, WorkflowNodeData } from "@projectplaner/core";

export type DataPortDirection = "in" | "out";

export interface BagPortsEditorProps {
  selected: WorkflowNode;
  bagView: Record<string, BagShape>;
  onUpdateData: (patch: Partial<WorkflowNodeData>) => void;
  onRenameDataPort?: (direction: DataPortDirection, from: string, to: string) => void;
  onRemoveDataPort?: (direction: DataPortDirection, portId: string) => void;
}
