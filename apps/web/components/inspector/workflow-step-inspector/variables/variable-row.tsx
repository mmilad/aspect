"use client";

import type { WorkflowVariable, WorkflowVariableRole } from "@projectplaner/core";
import { Button, Input, NativeSelect } from "../../../ui";
import { RequiredToggle, ShapeSelect } from "../shared";
import { VARIABLE_ROLES } from "./variable-policy";

export function VariableRow({
  variable,
  onPatch,
  onRemove
}: {
  variable: WorkflowVariable;
  onPatch: (patch: Partial<WorkflowVariable>) => void;
  onRemove: () => void;
}) {
  return (
    <li className="grid gap-1 rounded border border-border bg-white p-1.5">
      <div className="grid grid-cols-[1fr_auto_auto] gap-1">
        <Input
          className="font-mono text-[11px]"
          value={variable.name}
          onChange={(event) => onPatch({ name: event.target.value.trim() })}
        />
        <NativeSelect
          className="text-[11px]"
          value={variable.role}
          onChange={(event) => onPatch({ role: event.target.value as WorkflowVariableRole })}
        >
          {VARIABLE_ROLES.map((role) => (
            <option key={role} value={role}>
              {role}
            </option>
          ))}
        </NativeSelect>
        <Button size="xs" variant="danger" onClick={onRemove}>
          x
        </Button>
      </div>
      <div className="flex items-center gap-2">
        <ShapeSelect shape={variable.shape} onChange={(shape) => onPatch({ shape })} />
        {variable.role !== "local" ? (
          <RequiredToggle
            checked={variable.required !== false}
            onChange={(required) => onPatch({ required })}
          />
        ) : null}
      </div>
    </li>
  );
}
