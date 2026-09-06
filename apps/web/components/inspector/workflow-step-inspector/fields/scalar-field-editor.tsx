"use client";

import type {
  BagShape,
  WorkflowInspectorField,
  WorkflowNode,
  WorkflowNodeData
} from "@projectplaner/core";
import { FormLabel, Input, NativeSelect, Textarea } from "../../../ui";
import { PropPicker } from "../../../workflow-workspace/workflow-bag-panel";
import { bagKeyOptions } from "../shared/bag-options";
import { applyFieldPatch, readFieldValue } from "./field-patch";

type FieldOf<Kind extends WorkflowInspectorField["kind"]> = WorkflowInspectorField & { kind: Kind };
type ScalarField = FieldOf<"text" | "textarea" | "number">;

export function BagKeyFieldEditor({
  field,
  selected,
  bagView,
  onUpdateData
}: {
  field: FieldOf<"bagKey">;
  selected: WorkflowNode;
  bagView: Record<string, BagShape>;
  onUpdateData: (patch: Partial<WorkflowNodeData>) => void;
}) {
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

export function SelectFieldEditor({
  field,
  selected,
  onUpdateData
}: {
  field: FieldOf<"select">;
  selected: WorkflowNode;
  onUpdateData: (patch: Partial<WorkflowNodeData>) => void;
}) {
  return (
    <FormLabel key={field.path} label={field.label}>
      <NativeSelect
        value={readFieldValue(selected, field) || field.options[0]?.value || ""}
        onChange={(event) => applyFieldPatch(selected, field.path, event.target.value, onUpdateData)}
      >
        {field.options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </NativeSelect>
    </FormLabel>
  );
}

export function TextareaFieldEditor({
  field,
  selected,
  onUpdateData
}: {
  field: ScalarField;
  selected: WorkflowNode;
  onUpdateData: (patch: Partial<WorkflowNodeData>) => void;
}) {
  return (
    <FormLabel key={field.path} label={field.label}>
      <Textarea
        className={field.path.includes("instructions") ? "min-h-28" : "min-h-20"}
        placeholder={field.placeholder}
        value={readFieldValue(selected, field)}
        onChange={(event) => applyFieldPatch(selected, field.path, event.target.value, onUpdateData)}
      />
    </FormLabel>
  );
}

export function TextLikeFieldEditor({
  field,
  selected,
  onUpdateData
}: {
  field: ScalarField;
  selected: WorkflowNode;
  onUpdateData: (patch: Partial<WorkflowNodeData>) => void;
}) {
  return (
    <FormLabel key={field.path} label={field.label}>
      <Input
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
