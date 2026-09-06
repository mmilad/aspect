"use client";

import type {
  BagShape,
  WorkflowInspectorField,
  WorkflowNode,
  WorkflowNodeData
} from "@projectplaner/core";

import { LlmJsonSchemaPicker } from "../llm-json-schema-picker";
import { QueryConfigEditor } from "../query";
import { applyFieldPatch } from "./field-patch";
import { ExecutionPolicyEditor } from "./execution-policy-editor";
import { MapFieldsEditor } from "./map-fields-editor";
import {
  BagKeyFieldEditor,
  SelectFieldEditor,
  TextareaFieldEditor,
  TextLikeFieldEditor
} from "./scalar-field-editor";
import { ToolArgsEditor } from "./tool-args-editor";

export function renderField(
  field: Exclude<WorkflowInspectorField, { kind: "bagPorts" }>,
  selected: WorkflowNode,
  bagView: Record<string, BagShape>,
  onUpdateData: (patch: Partial<WorkflowNodeData>) => void,
  projectKey: string
) {
  if (field.kind === "queryConfig") {
    return <QueryConfigEditor key="queryConfig" selected={selected} onUpdateData={onUpdateData} />;
  }

  if (field.kind === "llmSchemaKey") {
    return (
      <LlmJsonSchemaPicker
        key="llmSchemaKey"
        projectKey={projectKey}
        value={selected.data.llm?.schemaKey ?? ""}
        onChange={(key) => applyFieldPatch(selected, "llm.schemaKey", key, onUpdateData)}
      />
    );
  }

  if (field.kind === "executionPolicy") {
    return <ExecutionPolicyEditor key="executionPolicy" selected={selected} onUpdateData={onUpdateData} />;
  }

  if (field.kind === "toolArgs") {
    return <ToolArgsEditor key="toolArgs" selected={selected} bagView={bagView} onUpdateData={onUpdateData} />;
  }

  if (field.kind === "mapFields") {
    return <MapFieldsEditor key="mapFields" selected={selected} bagView={bagView} onUpdateData={onUpdateData} />;
  }

  if (field.kind === "bagKey") {
    return <BagKeyFieldEditor key={field.path} field={field} selected={selected} bagView={bagView} onUpdateData={onUpdateData} />;
  }

  if (field.kind === "select") {
    return <SelectFieldEditor key={field.path} field={field} selected={selected} onUpdateData={onUpdateData} />;
  }

  if (field.kind === "textarea") {
    return <TextareaFieldEditor key={field.path} field={field} selected={selected} onUpdateData={onUpdateData} />;
  }

  return <TextLikeFieldEditor key={field.path} field={field} selected={selected} onUpdateData={onUpdateData} />;
}
