"use client";

import type { WorkflowNode, WorkflowNodeData } from "@projectplaner/core";
import { FormLabel, Input, NativeSelect } from "../../../ui";

export function ExecutionPolicyEditor({
  selected,
  onUpdateData
}: {
  selected: WorkflowNode;
  onUpdateData: (patch: Partial<WorkflowNodeData>) => void;
}) {
  return (
    <div className="space-y-3">
      <FormLabel label="Timeout ms">
        <Input
          value={String(selected.data.executionPolicy?.timeoutMs ?? "")}
          onChange={(event) =>
            onUpdateData({
              executionPolicy: {
                ...(selected.data.executionPolicy ?? {}),
                timeoutMs: Number(event.target.value) || undefined
              }
            })
          }
        />
      </FormLabel>
      <FormLabel label="Idempotency key from">
        <Input
          value={selected.data.executionPolicy?.idempotencyKeyFrom ?? ""}
          onChange={(event) =>
            onUpdateData({
              executionPolicy: {
                ...(selected.data.executionPolicy ?? {}),
                idempotencyKeyFrom: event.target.value || undefined
              }
            })
          }
        />
      </FormLabel>
      <FormLabel label="On exhausted">
        <NativeSelect
          value={selected.data.executionPolicy?.onExhausted ?? "fail_run"}
          onChange={(event) =>
            onUpdateData({
              executionPolicy: {
                ...(selected.data.executionPolicy ?? {}),
                onExhausted: event.target.value as "error_edge" | "fail_run"
              }
            })
          }
        >
          <option value="fail_run">fail_run</option>
          <option value="error_edge">error_edge</option>
        </NativeSelect>
      </FormLabel>
    </div>
  );
}
