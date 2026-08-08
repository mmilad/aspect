"use client";

import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import { Badge } from "../ui/badge";
import { formatEntityType, formatStatus, isCompleteStatus } from "../../lib/entity-label";
import { graphDotStatusByStatus, graphDotToneByType } from "../../lib/entity-tones";
import { cn } from "../../lib/utils";
import type { GraphFlowNodeData } from "./types";

export function NodeCard({ data }: NodeProps<Node<GraphFlowNodeData>>) {
  const entity = data.entity;
  const isComplete = isCompleteStatus(entity.status);
  const size = data.score ? Math.min(44, 24 + data.score / 5) : 24;

  return (
    <div
      className={cn(
        "group relative flex items-center justify-center rounded-full border-[3px] shadow-[0_8px_18px_rgba(15,23,42,0.18)] transition-transform hover:scale-125",
        graphDotToneByType[entity.type] ?? "bg-zinc-500",
        graphDotStatusByStatus[entity.status] ?? "border-white",
        data.isCenter && "outline outline-2 outline-offset-4 outline-teal-600",
        data.isSelected && "outline outline-2 outline-offset-4 outline-zinc-900"
      )}
      style={{ width: size, height: size }}
      title={`${formatEntityType(entity.type)} · ${formatStatus(entity.status)} · ${entity.key ? `${entity.key} · ` : ""}${entity.title}`}
    >
      <Handle type="target" position={Position.Left} />
      {isComplete ? <span className="h-2 w-2 rounded-full bg-white/90" /> : null}
      {data.score ? (
        <span className="absolute -right-2 -top-2 rounded-full bg-zinc-950 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-white">
          {data.score}
        </span>
      ) : null}
      <div className="pointer-events-none absolute left-1/2 top-full z-20 mt-2 hidden w-56 -translate-x-1/2 rounded-md border border-border bg-white p-2 text-left shadow-pane group-hover:block">
        <div className="flex items-center gap-1">
          <Badge tone={entity.type}>{formatEntityType(entity.type)}</Badge>
          <Badge>{formatStatus(entity.status)}</Badge>
        </div>
        <div className="mt-2 line-clamp-2 text-xs font-semibold leading-4 text-zinc-950">{entity.title}</div>
        {entity.summary ? <div className="mt-1 line-clamp-2 text-[11px] leading-4 text-muted-foreground">{entity.summary}</div> : null}
      </div>
      <Handle type="source" position={Position.Right} />
    </div>
  );
}

export const graphNodeTypes = { projectNode: NodeCard };
