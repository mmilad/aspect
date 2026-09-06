"use client";

import type { WorkflowVariable, WorkflowVariableRole } from "@projectplaner/core";
import { Button } from "../../../ui";
import { addVariable, removeVariable, updateVariable } from "./variable-actions";
import { VARIABLE_ROLES } from "./variable-policy";
import { VariableRow } from "./variable-row";

export function WorkflowVariablesPanel({
  variables,
  onChange
}: {
  variables: WorkflowVariable[];
  onChange: (next: WorkflowVariable[]) => void;
}) {
  function update(index: number, patch: Partial<WorkflowVariable>) {
    onChange(updateVariable(variables, index, patch));
  }

  function add(role: WorkflowVariableRole) {
    onChange(addVariable(variables, role));
  }

  return (
    <div className="space-y-1.5">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Variables</div>
      {variables.length === 0 ? (
        <div className="rounded border border-dashed border-border p-2 text-[11px] text-muted-foreground">
          No variables. Add inputs, outputs, or locals. Start/End pins follow this list.
        </div>
      ) : (
        <ul className="max-h-56 space-y-1 overflow-y-auto rounded border border-border bg-zinc-50 p-2 text-[11px]">
          {variables.map((variable, index) => (
            <VariableRow
              key={`${variable.role}:${variable.name}:${index}`}
              variable={variable}
              onPatch={(patch) => update(index, patch)}
              onRemove={() => onChange(removeVariable(variables, index))}
            />
          ))}
        </ul>
      )}
      <div className="flex flex-wrap gap-1">
        {VARIABLE_ROLES.map((role) => (
          <Button key={role} size="xs" variant="outline" onClick={() => add(role)}>
            + {role}
          </Button>
        ))}
      </div>
    </div>
  );
}
