"use client";

import type { BagShape } from "@projectplaner/core";
import { NativeSelect } from "../../../ui";
import { matchingShape, SHAPE_OPTIONS } from "./shape-options";

export function ShapeSelect({
  shape,
  className = "text-[11px]",
  onChange
}: {
  shape: BagShape | undefined;
  className?: string;
  onChange: (shape: BagShape) => void;
}) {
  return (
    <NativeSelect
      className={className}
      value={matchingShape(shape)}
      onChange={(event) => {
        const next = SHAPE_OPTIONS.find((option) => option.label === event.target.value);
        if (next) {
          onChange(next.shape);
        }
      }}
    >
      {SHAPE_OPTIONS.map((option) => (
        <option key={option.label} value={option.label}>
          {option.label}
        </option>
      ))}
    </NativeSelect>
  );
}

export function RequiredToggle({
  checked,
  label = "required",
  className = "flex items-center gap-1 text-[10px] text-zinc-600",
  onChange
}: {
  checked: boolean;
  label?: string;
  className?: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className={className}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      {label}
    </label>
  );
}
