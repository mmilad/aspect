"use client";

import {
  getDataPath,
  getNodeModel,
  listShapePaths,
  setDataPath,
  type BagShape,
  type WorkflowInspectorField,
  type WorkflowMapField,
  type WorkflowNode,
  type WorkflowNodeData
} from "@projectplaner/core";
import { FormLabel, GhostButton, Select, TextArea, TextInput } from "../../ui";
import { PropPicker, WorkflowBagPanel } from "../../workflow-workspace/workflow-bag-panel";
import { BagPortsEditor } from "./bag-ports-editor";
import { StartRunInputsEditor } from "./start-run-inputs-editor";

export interface WorkflowStepInspectorProps {
  selected: WorkflowNode | null;
  bagView: Record<string, BagShape>;
  onUpdateData: (patch: Partial<WorkflowNodeData>) => void;
  onDelete: () => void;
}

function bagKeyOptions(view: Record<string, BagShape>): string[] {
  return Object.keys(view).sort();
}

function pathOptionsForKey(view: Record<string, BagShape>, key: string): string[] {
  return listShapePaths(view[key]);
}

function applyFieldPatch(
  selected: WorkflowNode,
  path: string,
  value: unknown,
  onUpdateData: (patch: Partial<WorkflowNodeData>) => void
): void {
  if (path === "join.mode" && typeof value === "string" && value.startsWith("count:")) {
    onUpdateData({
      join: {
        ...(selected.data.join ?? {}),
        mode: { count: Number(value.slice(6)) || 1 }
      }
    });
    return;
  }
  if (path === "foreach.body.workflowId") {
    onUpdateData({
      foreach: {
        itemsFrom: selected.data.foreach?.itemsFrom ?? "",
        body: { type: "subworkflow", workflowId: String(value ?? "") },
        failureMode: selected.data.foreach?.failureMode ?? "fail",
        collect: selected.data.foreach?.collect
      }
    });
    return;
  }
  if (path === "map.from" || path === "map.as") {
    const next = setDataPath(selected.data, path, value);
    const as = String(path === "map.as" ? value : (next.map?.as ?? "projected"));
    const writeBindings = {
      ...(selected.data.writeBindings ?? {}),
      [as]: as
    };
    const writes =
      path === "map.as"
        ? [as]
        : selected.data.writes?.includes(as)
          ? selected.data.writes
          : [...(selected.data.writes ?? []), as];
    onUpdateData({ ...next, writes, writeBindings });
    return;
  }
  if (path === "llm.systemPrompt" || path === "llm.instructions") {
    const next = setDataPath(selected.data, path, value);
    const inputPorts = Object.keys(selected.data.inputs ?? {});
    const outputPorts = Object.keys(selected.data.outputContracts ?? {});
    onUpdateData({
      llm: {
        ...(next.llm ?? {}),
        inputKeys:
          inputPorts.length > 0
            ? inputPorts
            : (selected.data.reads ?? selected.data.llm?.inputKeys),
        outputSchema:
          outputPorts.length > 0
            ? outputPorts
            : (selected.data.writes ?? selected.data.llm?.outputSchema)
      }
    });
    return;
  }
  onUpdateData(setDataPath(selected.data, path, value));
}

function readFieldValue(selected: WorkflowNode, field: WorkflowInspectorField): string {
  if (
    field.kind === "executionPolicy" ||
    field.kind === "mapFields" ||
    field.kind === "toolArgs" ||
    field.kind === "bagPorts" ||
    field.kind === "startRunInputs"
  ) {
    return "";
  }
  if (field.path === "join.mode") {
    const mode = selected.data.join?.mode;
    if (typeof mode === "object" && mode && "count" in mode) {
      return `count:${mode.count}`;
    }
    return String(mode ?? "all");
  }
  const raw = getDataPath(selected.data, field.path);
  if (raw === undefined || raw === null) {
    return "";
  }
  return String(raw);
}

function renderField(
  field: WorkflowInspectorField,
  selected: WorkflowNode,
  bagView: Record<string, BagShape>,
  onUpdateData: (patch: Partial<WorkflowNodeData>) => void
) {
  if (field.kind === "bagPorts") {
    return (
      <BagPortsEditor
        key="bagPorts"
        selected={selected}
        bagView={bagView}
        onUpdateData={onUpdateData}
      />
    );
  }

  if (field.kind === "startRunInputs") {
    return <StartRunInputsEditor key="startRunInputs" selected={selected} onUpdateData={onUpdateData} />;
  }

  if (field.kind === "executionPolicy") {
    return (
      <div key="executionPolicy" className="space-y-3">
        <FormLabel label="Timeout ms">
          <TextInput
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
          <TextInput
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
          <Select
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
          </Select>
        </FormLabel>
      </div>
    );
  }

  if (field.kind === "toolArgs") {
    return (
      <PropPicker
        key="toolArgs"
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

  if (field.kind === "mapFields") {
    return (
      <div key="mapFields" className="space-y-2">
        <div className="text-[11px] font-medium text-zinc-700">Fields</div>
        {(selected.data.map?.fields ?? []).map((mapField, index) => (
          <div key={`${mapField.as}-${index}`} className="grid grid-cols-2 gap-1">
            <PropPicker
              label="from"
              value={mapField.from}
              options={pathOptionsForKey(bagView, selected.data.map?.from ?? "")}
              onChange={(value) => {
                const fields = [...(selected.data.map?.fields ?? [])] as WorkflowMapField[];
                fields[index] = { ...fields[index], from: value };
                onUpdateData({
                  map: {
                    from: selected.data.map?.from ?? "",
                    as: selected.data.map?.as ?? "projected",
                    mode: selected.data.map?.mode,
                    fields
                  }
                });
              }}
            />
            <FormLabel label="as">
              <TextInput
                value={mapField.as}
                onChange={(event) => {
                  const fields = [...(selected.data.map?.fields ?? [])] as WorkflowMapField[];
                  fields[index] = { ...fields[index], as: event.target.value };
                  onUpdateData({
                    map: {
                      from: selected.data.map?.from ?? "",
                      as: selected.data.map?.as ?? "projected",
                      mode: selected.data.map?.mode,
                      fields
                    }
                  });
                }}
              />
            </FormLabel>
          </div>
        ))}
        <GhostButton
          size="xs"
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
        </GhostButton>
      </div>
    );
  }

  if (field.kind === "bagKey") {
    return (
      <PropPicker
        key={field.path}
        label={field.label}
        value={readFieldValue(selected, field)}
        options={bagKeyOptions(bagView)}
        onChange={(value) => applyFieldPatch(selected, field.path, value, onUpdateData)}
      />
    );
  }

  if (field.kind === "select") {
    return (
      <FormLabel key={field.path} label={field.label}>
        <Select
          value={readFieldValue(selected, field) || field.options[0]?.value || ""}
          onChange={(event) => applyFieldPatch(selected, field.path, event.target.value, onUpdateData)}
        >
          {field.options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
      </FormLabel>
    );
  }

  if (field.kind === "textarea") {
    return (
      <FormLabel key={field.path} label={field.label}>
        <TextArea
          className={field.path.includes("instructions") ? "min-h-28" : "min-h-20"}
          placeholder={field.placeholder}
          value={readFieldValue(selected, field)}
          onChange={(event) => applyFieldPatch(selected, field.path, event.target.value, onUpdateData)}
        />
      </FormLabel>
    );
  }

  return (
    <FormLabel key={field.path} label={field.label}>
      <TextInput
        placeholder={field.placeholder}
        value={readFieldValue(selected, field)}
        onChange={(event) => {
          const value =
            field.kind === "number" ? Number(event.target.value) || 0 : event.target.value;
          applyFieldPatch(selected, field.path, value, onUpdateData);
        }}
      />
    </FormLabel>
  );
}

export function WorkflowStepInspector({
  selected,
  bagView,
  onUpdateData,
  onDelete
}: WorkflowStepInspectorProps) {
  const highlight =
    selected?.type === "foreach"
      ? [selected.data.foreach?.itemKey ?? "item", selected.data.foreach?.indexKey ?? "index"]
      : [];
  const fields = selected ? (getNodeModel(selected.type).inspectorFields ?? []) : [];

  return (
    <div className="space-y-3 p-3">
      <div>
        <WorkflowBagPanel view={bagView} highlightKeys={highlight} />
      </div>
      {!selected ? (
        <p className="text-sm text-muted-foreground">
          Select a step to edit title, bag bindings, control config, and execution policy.
        </p>
      ) : (
        <div className="space-y-3">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Node</div>
            <div className="font-mono text-xs text-zinc-700">{selected.id}</div>
            <div className="mt-0.5 text-[11px] text-muted-foreground">
              type <span className="font-mono text-zinc-700">{selected.type}</span>
            </div>
          </div>
          <FormLabel label="Title">
            <TextInput value={selected.data.title} onChange={(event) => onUpdateData({ title: event.target.value })} />
          </FormLabel>
          {selected.type === "start" ? null : (
            <BagPortsEditor selected={selected} bagView={bagView} onUpdateData={onUpdateData} />
          )}
          {fields
            .filter((field) => field.kind !== "bagPorts")
            .map((field) => renderField(field, selected, bagView, onUpdateData))}
          {selected.type !== "start" ? (
            <GhostButton size="xs" tone="danger" onClick={onDelete}>
              Delete node
            </GhostButton>
          ) : null}
        </div>
      )}
    </div>
  );
}
