"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  BaseEdge,
  EdgeLabelRenderer,
  getSmoothStepPath,
  Position,
  useReactFlow,
  type EdgeProps
} from "@xyflow/react";
import type { WorkflowEdgeKind } from "@projectplaner/core";
import { cn } from "../../lib/utils";
import type { FlowRfEdge, FlowRfEdgeData } from "./rf-adapters";

export type SelectedWaypoint = { edgeId: string; index: number } | null;

const WaypointSelectionContext = createContext<{
  selected: SelectedWaypoint;
  select: (next: SelectedWaypoint) => void;
} | null>(null);

export function WorkflowWaypointProvider({ children }: { children: ReactNode }) {
  const [selected, select] = useState<SelectedWaypoint>(null);
  const value = useMemo(() => ({ selected, select }), [selected]);
  return <WaypointSelectionContext.Provider value={value}>{children}</WaypointSelectionContext.Provider>;
}

export function useWaypointSelection() {
  const ctx = useContext(WaypointSelectionContext);
  if (!ctx) {
    throw new Error("useWaypointSelection requires WorkflowWaypointProvider");
  }
  return ctx;
}

type Point = { x: number; y: number };

function inferPositions(from: Point, to: Point): [Position, Position] {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  if (Math.abs(dx) >= Math.abs(dy)) {
    return dx >= 0 ? [Position.Right, Position.Left] : [Position.Left, Position.Right];
  }
  return dy >= 0 ? [Position.Bottom, Position.Top] : [Position.Top, Position.Bottom];
}

function joinPaths(paths: string[]): string {
  return paths
    .map((path, index) => (index === 0 ? path : path.replace(/^M[^A-Z]+/i, "").trim()))
    .join(" ");
}

function execPath(
  points: Point[],
  sourcePosition: Position,
  targetPosition: Position
): string {
  if (points.length < 2) {
    return "";
  }
  if (points.length === 2) {
    const [path] = getSmoothStepPath({
      sourceX: points[0]!.x,
      sourceY: points[0]!.y,
      targetX: points[1]!.x,
      targetY: points[1]!.y,
      sourcePosition,
      targetPosition
    });
    return path;
  }
  const segments: string[] = [];
  for (let i = 0; i < points.length - 1; i += 1) {
    const from = points[i]!;
    const to = points[i + 1]!;
    const [inferredSource, inferredTarget] = inferPositions(from, to);
    const [path] = getSmoothStepPath({
      sourceX: from.x,
      sourceY: from.y,
      targetX: to.x,
      targetY: to.y,
      sourcePosition: i === 0 ? sourcePosition : inferredSource,
      targetPosition: i === points.length - 2 ? targetPosition : inferredTarget
    });
    segments.push(path);
  }
  return joinPaths(segments);
}

function distToSegment(point: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSq = dx * dx + dy * dy;
  if (lengthSq === 0) {
    const ex = point.x - a.x;
    const ey = point.y - a.y;
    return Math.hypot(ex, ey);
  }
  const t = Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / lengthSq));
  return Math.hypot(point.x - (a.x + t * dx), point.y - (a.y + t * dy));
}

function insertWaypoint(points: Point[], pos: Point): { waypoints: Point[]; index: number } {
  const full = points.slice();
  let bestSeg = 0;
  let bestDist = Infinity;
  for (let i = 0; i < full.length - 1; i += 1) {
    const dist = distToSegment(pos, full[i]!, full[i + 1]!);
    if (dist < bestDist) {
      bestDist = dist;
      bestSeg = i;
    }
  }
  full.splice(bestSeg + 1, 0, pos);
  return { waypoints: full.slice(1, -1), index: bestSeg };
}

function strokeForKind(
  kind: WorkflowEdgeKind | undefined,
  color?: string
): { outer: string; inner: string; width: number; innerWidth: number } {
  if (kind === "data") {
    return { outer: color ?? "#a1a1aa", inner: color ?? "#a1a1aa", width: 2, innerWidth: 0 };
  }
  if (kind === "error") {
    return { outer: "#9f1239", inner: "#ffe4e6", width: 4.5, innerWidth: 2.25 };
  }
  return { outer: "#57534e", inner: "#f5f5f4", width: 4.5, innerWidth: 2.25 };
}

export function WorkflowExecEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  markerEnd,
  label
}: EdgeProps<FlowRfEdge>) {
  const { setEdges, screenToFlowPosition } = useReactFlow();
  const { selected, select } = useWaypointSelection();
  const waypoints = data?.waypoints ?? [];
  const points: Point[] = [{ x: sourceX, y: sourceY }, ...waypoints, { x: targetX, y: targetY }];
  const path = execPath(points, sourcePosition, targetPosition);
  const stroke = strokeForKind(data?.kind, data?.color);

  const writeWaypoints = useCallback(
    (next: Point[]) => {
      setEdges((current) =>
        current.map((edge) =>
          edge.id === id
            ? {
                ...edge,
                data: {
                  ...edge.data,
                  kind: (edge.data as FlowRfEdgeData | undefined)?.kind ?? "next",
                  waypoints: next.length > 0 ? next : undefined
                }
              }
            : edge
        )
      );
    },
    [id, setEdges]
  );

  useEffect(() => {
    if (!selected || selected.edgeId !== id) {
      return;
    }
    const index = selected.index;
    function onKey(event: KeyboardEvent) {
      if (event.key !== "Backspace" && event.key !== "Delete") {
        return;
      }
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable='true']")) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      writeWaypoints(waypoints.filter((_, itemIndex) => itemIndex !== index));
      select(null);
    }
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [id, selected, select, waypoints, writeWaypoints]);

  return (
    <>
      <BaseEdge
        id={id}
        path={path}
        markerEnd={markerEnd}
        style={{ stroke: stroke.outer, strokeWidth: stroke.width }}
      />
      {stroke.innerWidth > 0 ? <path d={path} fill="none" stroke={stroke.inner} strokeWidth={stroke.innerWidth} /> : null}
      <path
        d={path}
        fill="none"
        stroke="transparent"
        strokeWidth={18}
        className="react-flow__edge-interaction"
        onDoubleClick={(event) => {
          event.stopPropagation();
          const pos = screenToFlowPosition({ x: event.clientX, y: event.clientY });
          const inserted = insertWaypoint(points, pos);
          writeWaypoints(inserted.waypoints);
          select({ edgeId: id, index: inserted.index });
        }}
      />
      {typeof label === "string" && label ? (
        <EdgeLabelRenderer>
          <div
            className="nodrag nopan pointer-events-none rounded border border-stone-300 bg-white px-1 text-[10px] text-stone-700"
            style={{
              position: "absolute",
              transform: `translate(-50%, -50%) translate(${(sourceX + targetX) / 2}px, ${(sourceY + targetY) / 2}px)`
            }}
          >
            {label}
          </div>
        </EdgeLabelRenderer>
      ) : null}
      {waypoints.map((point, index) => (
        <EdgeLabelRenderer key={`${id}:${index}`}>
          <div
            className="nopan nodrag"
            style={{
              position: "absolute",
              transform: `translate(-50%, -50%) translate(${point.x}px, ${point.y}px)`,
              pointerEvents: "all",
              cursor: "grab",
              zIndex: 1
            }}
            onPointerDown={(event) => {
              event.stopPropagation();
              event.preventDefault();
              select({ edgeId: id, index });
              event.currentTarget.setPointerCapture(event.pointerId);
            }}
            onPointerMove={(event) => {
              if (!event.currentTarget.hasPointerCapture(event.pointerId)) {
                return;
              }
              const pos = screenToFlowPosition({ x: event.clientX, y: event.clientY });
              const next = waypoints.map((item, itemIndex) => (itemIndex === index ? pos : item));
              writeWaypoints(next);
            }}
            onPointerUp={(event) => {
              if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                event.currentTarget.releasePointerCapture(event.pointerId);
              }
            }}
          >
            <div
              className={cn(
                "h-2.5 w-2.5 rotate-45 border border-stone-700 bg-stone-50",
                selected?.edgeId === id && selected.index === index && "ring-2 ring-offset-1 ring-stone-900"
              )}
            />
          </div>
        </EdgeLabelRenderer>
      ))}
    </>
  );
}

export const workflowRfEdgeTypes = { exec: WorkflowExecEdge };
