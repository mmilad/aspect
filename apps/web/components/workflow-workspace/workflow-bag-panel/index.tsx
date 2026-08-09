"use client";

import {
  listShapePaths,
  serializeShapeSlim,
  type BagShape
} from "@projectplaner/core";

interface WorkflowBagPanelProps {
  view: Record<string, BagShape>;
  highlightKeys?: string[];
}

export function WorkflowBagPanel({ view, highlightKeys = [] }: WorkflowBagPanelProps) {
  const entries = Object.entries(view).sort(([a], [b]) => a.localeCompare(b));
  const highlight = new Set(highlightKeys);

  if (entries.length === 0) {
    return (
      <div className="rounded border border-dashed border-border p-2 text-[11px] text-muted-foreground">
        No bag keys reach this step yet.
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        Bag at this step
      </div>
      <ul className="max-h-48 space-y-1 overflow-y-auto rounded border border-border bg-zinc-50 p-2 text-[11px]">
        {entries.map(([key, shape]) => {
          const slim = serializeShapeSlim(shape);
          const paths = listShapePaths(shape).slice(0, 8);
          return (
            <li
              key={key}
              className={
                highlight.has(key)
                  ? "rounded bg-fuchsia-50 px-1.5 py-1 ring-1 ring-fuchsia-200"
                  : "px-1.5 py-1"
              }
            >
              <div className="font-mono">
                <span className="font-semibold text-zinc-800">{key}</span>
                <span className="text-muted-foreground">: {slim}</span>
              </div>
              {paths.length > 0 ? (
                <div className="mt-0.5 text-[10px] text-zinc-500">{paths.join(", ")}</div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

interface PropPickerProps {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
  allowCustom?: boolean;
}

export function PropPicker({ label, value, options, onChange, allowCustom = true }: PropPickerProps) {
  const known = new Set(options);
  return (
    <div className="space-y-1">
      <div className="text-[11px] font-medium text-zinc-700">{label}</div>
      <select
        className="w-full rounded border border-border bg-white px-2 py-1 text-xs"
        value={known.has(value) ? value : allowCustom ? "__custom__" : options[0] ?? ""}
        onChange={(event) => {
          if (event.target.value === "__custom__") {
            return;
          }
          onChange(event.target.value);
        }}
      >
        <option value="">—</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
        {allowCustom ? <option value="__custom__">custom…</option> : null}
      </select>
      {allowCustom && !known.has(value) ? (
        <input
          className="w-full rounded border border-border px-2 py-1 font-mono text-xs"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="custom path"
        />
      ) : null}
    </div>
  );
}
