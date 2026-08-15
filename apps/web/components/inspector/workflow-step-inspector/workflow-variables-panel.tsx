"use client";

import type { BagShape, WorkflowVariable, WorkflowVariableRole } from "@projectplaner/core";
import { GhostButton, Select, TextInput } from "../../ui";

const ROLES: WorkflowVariableRole[] = ["input", "output", "local"];

const SHAPE_OPTIONS: Array<{ label: string; shape: BagShape }> = [
  { label: "string", shape: { kind: "primitive", type: "string" } },
  { label: "boolean", shape: { kind: "primitive", type: "boolean" } },
  { label: "number", shape: { kind: "primitive", type: "number" } },
  { label: "object", shape: { kind: "object", fields: {} } },
  { label: "array", shape: { kind: "array", items: { kind: "any" } } },
  { label: "any", shape: { kind: "any" } }
];

function shapeLabel(shape: BagShape): string {
  if (shape.kind === "primitive") {
    return shape.type;
  }
  return shape.kind;
}

function matchingShape(shape: BagShape): string {
  const label = shapeLabel(shape);
  return SHAPE_OPTIONS.some((option) => option.label === label) ? label : "any";
}

export function WorkflowVariablesPanel({
  variables,
  onChange
}: {
  variables: WorkflowVariable[];
  onChange: (next: WorkflowVariable[]) => void;
}) {
  function update(index: number, patch: Partial<WorkflowVariable>) {
    onChange(variables.map((variable, itemIndex) => (itemIndex === index ? { ...variable, ...patch } : variable)));
  }

  function add(role: WorkflowVariableRole) {
    const base = role === "local" ? "local" : role;
    let n = 1;
    let name = `${base}${n}`;
    const names = new Set(variables.map((variable) => variable.name));
    while (names.has(name)) {
      n += 1;
      name = `${base}${n}`;
    }
    onChange([
      ...variables,
      {
        name,
        role,
        shape: { kind: "any" },
        required: role === "input" ? true : false
      }
    ]);
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
            <li key={`${variable.role}:${variable.name}:${index}`} className="grid gap-1 rounded border border-border bg-white p-1.5">
              <div className="grid grid-cols-[1fr_auto_auto] gap-1">
                <TextInput
                  className="font-mono text-[11px]"
                  value={variable.name}
                  onChange={(event) => update(index, { name: event.target.value.trim() })}
                />
                <Select
                  className="text-[11px]"
                  value={variable.role}
                  onChange={(event) => update(index, { role: event.target.value as WorkflowVariableRole })}
                >
                  {ROLES.map((role) => (
                    <option key={role} value={role}>
                      {role}
                    </option>
                  ))}
                </Select>
                <GhostButton size="xs" tone="danger" onClick={() => onChange(variables.filter((_, itemIndex) => itemIndex !== index))}>
                  ×
                </GhostButton>
              </div>
              <div className="flex items-center gap-2">
                <Select
                  className="text-[11px]"
                  value={matchingShape(variable.shape)}
                  onChange={(event) => {
                    const next = SHAPE_OPTIONS.find((option) => option.label === event.target.value);
                    if (next) {
                      update(index, { shape: next.shape });
                    }
                  }}
                >
                  {SHAPE_OPTIONS.map((option) => (
                    <option key={option.label} value={option.label}>
                      {option.label}
                    </option>
                  ))}
                </Select>
                {variable.role !== "local" ? (
                  <label className="flex items-center gap-1 text-[10px] text-zinc-600">
                    <input
                      type="checkbox"
                      checked={variable.required !== false}
                      onChange={(event) => update(index, { required: event.target.checked })}
                    />
                    required
                  </label>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
      <div className="flex flex-wrap gap-1">
        <GhostButton size="xs" onClick={() => add("input")}>
          + input
        </GhostButton>
        <GhostButton size="xs" onClick={() => add("output")}>
          + output
        </GhostButton>
        <GhostButton size="xs" onClick={() => add("local")}>
          + local
        </GhostButton>
      </div>
    </div>
  );
}
