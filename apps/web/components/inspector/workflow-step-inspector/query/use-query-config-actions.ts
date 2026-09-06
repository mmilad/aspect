import type {
  WorkflowNode,
  WorkflowNodeData,
  WorkflowQueryConfig,
  WorkflowQuerySlot
} from "@projectplaner/core";
import workflow from "@projectplaner/core/workflow";

const { uniqueSlotId, withQueryConfig } = workflow.nodes;

export function useQueryConfigActions({
  selected,
  query,
  slots,
  onUpdateData
}: {
  selected: WorkflowNode;
  query: WorkflowQueryConfig;
  slots: WorkflowQuerySlot[];
  onUpdateData: (patch: Partial<WorkflowNodeData>) => void;
}) {
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

  return { addSlot, commit, removeSlot, updateSlot };
}
