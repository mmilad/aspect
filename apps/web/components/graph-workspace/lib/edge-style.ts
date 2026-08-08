import type { CSSProperties } from "react";

/** Stroke styles for graph edges; selection emphasis must stay readable on the light canvas. */
export function graphEdgeStroke(options: {
  selected: boolean;
  conflict?: boolean;
}): CSSProperties {
  const { selected, conflict = false } = options;
  if (selected) {
    return {
      stroke: conflict ? "#9f1239" : "#09090b",
      strokeWidth: 3.5,
      opacity: 1
    };
  }
  return {
    stroke: conflict ? "#e11d48" : "#0f766e",
    strokeWidth: 1.25,
    opacity: 0.22
  };
}

export function spatialEdgeClass(selected: boolean): string {
  return selected ? "stroke-zinc-950" : "stroke-teal-700/25";
}

export function spatialEdgeWidth(selected: boolean): number {
  return selected ? 3.5 : 1.15;
}
