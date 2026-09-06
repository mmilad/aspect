import type { WorkflowInspectorField, WorkflowNode, WorkflowNodeData } from "@projectplaner/core";
import workflow from "@projectplaner/core/workflow";

const { getDataPath, setDataPath } = workflow.nodes;

export function applyFieldPatch(
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
  if (path === "llm.schemaKey") {
    const key = String(value ?? "").trim();
    const next = setDataPath(selected.data, "llm.schemaKey", key || undefined);
    onUpdateData({
      llm: {
        ...(next.llm ?? {}),
        schemaKey: key || undefined,
        format: key ? "json_schema" : next.llm?.format === "json_schema" ? "text" : next.llm?.format
      }
    });
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

export function readFieldValue(selected: WorkflowNode, field: WorkflowInspectorField): string {
  if (
    field.kind === "executionPolicy" ||
    field.kind === "mapFields" ||
    field.kind === "toolArgs" ||
    field.kind === "bagPorts" ||
    field.kind === "llmSchemaKey" ||
    field.kind === "queryConfig"
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
