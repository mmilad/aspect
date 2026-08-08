"use client";

import { workflowNodeTypes, type WorkflowNode, type WorkflowNodeData, type WorkflowNodeType } from "@projectplaner/core";
import { FormLabel, GhostButton, Select, TextArea, TextInput } from "../../ui";

interface WorkflowNodeInspectorProps {
  selected: WorkflowNode | null;
  onUpdateData: (patch: Partial<WorkflowNodeData>) => void;
  onUpdateType: (type: WorkflowNodeType) => void;
  onDelete: () => void;
}

export function WorkflowNodeInspector({ selected, onUpdateData, onUpdateType, onDelete }: WorkflowNodeInspectorProps) {
  return (
    <aside className="w-72 shrink-0 overflow-y-auto border-l border-border bg-white p-3">
      {!selected ? (
        <p className="text-sm text-muted-foreground">Select a step to edit title, reads/writes, and node config.</p>
      ) : (
        <div className="space-y-3">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Node</div>
            <div className="font-mono text-xs text-zinc-700">{selected.id}</div>
          </div>
          <FormLabel label="Type">
            <Select value={selected.type} onChange={(event) => onUpdateType(event.target.value as WorkflowNodeType)}>
              {workflowNodeTypes.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </Select>
          </FormLabel>
          <FormLabel label="Title">
            <TextInput value={selected.data.title} onChange={(event) => onUpdateData({ title: event.target.value })} />
          </FormLabel>
          <FormLabel label="Reads (comma)">
            <TextInput
              value={(selected.data.reads ?? []).join(", ")}
              onChange={(event) =>
                onUpdateData({
                  reads: event.target.value
                    .split(",")
                    .map((part) => part.trim())
                    .filter(Boolean)
                })
              }
            />
          </FormLabel>
          <FormLabel label="Writes (comma)">
            <TextInput
              value={(selected.data.writes ?? []).join(", ")}
              onChange={(event) =>
                onUpdateData({
                  writes: event.target.value
                    .split(",")
                    .map((part) => part.trim())
                    .filter(Boolean)
                })
              }
            />
          </FormLabel>
          {selected.type === "llm" ? (
            <FormLabel label="LLM instructions">
              <TextArea
                className="min-h-28"
                value={selected.data.llm?.instructions ?? ""}
                onChange={(event) =>
                  onUpdateData({
                    llm: {
                      ...(selected.data.llm ?? {}),
                      instructions: event.target.value,
                      inputKeys: selected.data.reads ?? selected.data.llm?.inputKeys,
                      outputSchema: selected.data.writes ?? selected.data.llm?.outputSchema
                    }
                  })
                }
              />
            </FormLabel>
          ) : null}
          {selected.type === "tool" ? (
            <FormLabel label="Tool name">
              <TextInput
                value={selected.data.tool?.name ?? ""}
                onChange={(event) =>
                  onUpdateData({
                    tool: {
                      ...(selected.data.tool ?? { name: "" }),
                      name: event.target.value
                    }
                  })
                }
              />
            </FormLabel>
          ) : null}
          {selected.type !== "start" ? (
            <GhostButton size="xs" tone="danger" onClick={onDelete}>
              Delete node
            </GhostButton>
          ) : null}
        </div>
      )}
    </aside>
  );
}
