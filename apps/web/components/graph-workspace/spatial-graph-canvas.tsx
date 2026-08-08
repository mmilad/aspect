"use client";

import { useMemo, type CSSProperties } from "react";
import { Network } from "lucide-react";
import type { EntityType, LegacyEntityRelation } from "@projectplaner/core";
import { formatEntityType, isCompleteStatus } from "../../lib/entity-label";
import { graphDotStatusByStatus, graphDotToneByType } from "../../lib/entity-tones";
import { cn } from "../../lib/utils";
import { spatialEdgeClass, spatialEdgeWidth } from "./lib/edge-style";
import type { GraphMatch } from "./types";

interface SpatialGraphCanvasProps {
  matches: GraphMatch[];
  relations: LegacyEntityRelation[];
  selectedId: string;
  centerId: string;
  onSelect: (id: string) => void;
  onOpen: (id: string) => void;
}

export function SpatialGraphCanvas({
  matches,
  relations,
  selectedId,
  centerId,
  onSelect,
  onOpen
}: SpatialGraphCanvasProps) {
  const layout = useMemo(() => {
    const width = 1000;
    const height = 700;
    const centerX = width / 2;
    const centerY = height / 2;
    const typeGroups = new Map<EntityType, GraphMatch[]>();

    for (const match of matches) {
      typeGroups.set(match.entity.type, [...(typeGroups.get(match.entity.type) ?? []), match]);
    }

    const byId = new Map<string, GraphMatch>();
    const nodes = matches.map((match, index) => {
      byId.set(match.entity.id, match);
      const typeIndex = Array.from(typeGroups.keys()).indexOf(match.entity.type);
      const group = typeGroups.get(match.entity.type) ?? [];
      const groupIndex = Math.max(0, group.findIndex((item) => item.entity.id === match.entity.id));
      const radius = 105 + typeIndex * 46 + (groupIndex % 3) * 18;
      const angle = (groupIndex / Math.max(group.length, 1)) * Math.PI * 2 + typeIndex * 0.74;
      const depth = Math.sin(angle + typeIndex * 0.6);
      const scoreLift = match.score > 0 ? Math.min(44, match.score / 2) : 0;
      const x = centerX + Math.cos(angle) * radius * (1 + depth * 0.08);
      const y = centerY + Math.sin(angle) * radius * 0.62 - depth * 82 - scoreLift;
      const size = Math.max(18, Math.min(36, 22 + depth * 5 + scoreLift / 5));

      return {
        match,
        x,
        y,
        depth,
        size,
        zIndex: Math.round((depth + 1) * 100) + index
      };
    });

    const positions = new Map(nodes.map((node) => [node.match.entity.id, node]));
    const edges = relations
      .map((relation) => {
        const source = positions.get(relation.sourceId);
        const target = positions.get(relation.targetId);
        return source && target ? { relation, source, target } : null;
      })
      .filter((item): item is NonNullable<typeof item> => Boolean(item));

    return { width, height, nodes, edges, byId };
  }, [matches, relations]);

  return (
    <div className="relative h-full min-h-[calc(100vh-3.5rem)] overflow-hidden bg-[#f8faf9]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_42%,rgba(20,184,166,0.12),transparent_42%)]" />
      <div className="absolute inset-0" style={{ perspective: 900 }}>
        <svg className="absolute inset-0 h-full w-full" viewBox={`0 0 ${layout.width} ${layout.height}`} preserveAspectRatio="xMidYMid meet">
          {layout.edges.map(({ relation, source, target }) => {
            const isSelected = relation.sourceId === selectedId || relation.targetId === selectedId;
            return (
              <line
                key={relation.id}
                x1={source.x}
                y1={source.y}
                x2={target.x}
                y2={target.y}
                className={cn(spatialEdgeClass(isSelected))}
                strokeWidth={spatialEdgeWidth(isSelected)}
                opacity={isSelected ? 1 : 0.35}
                strokeDasharray={relation.type === "references" ? "6 7" : undefined}
              />
            );
          })}
        </svg>
        {layout.nodes.map(({ match, x, y, depth, size, zIndex }) => {
          const entity = match.entity;
          const selected = entity.id === selectedId;
          const complete = isCompleteStatus(entity.status);
          const style: CSSProperties = {
            left: `${(x / layout.width) * 100}%`,
            top: `${(y / layout.height) * 100}%`,
            width: size,
            height: size,
            zIndex,
            transform: `translate(-50%, -50%) translateZ(${Math.round(depth * 120)}px)`
          };

          return (
            <button
              key={entity.id}
              className={cn(
                "group absolute flex items-center justify-center rounded-full border-[3px] shadow-[0_18px_38px_rgba(15,23,42,0.20)] transition-transform hover:scale-125",
                graphDotToneByType[entity.type] ?? "bg-zinc-500",
                graphDotStatusByStatus[entity.status] ?? "border-white",
                entity.id === centerId && "outline outline-2 outline-offset-4 outline-teal-600",
                selected && "outline outline-4 outline-offset-4 outline-zinc-950"
              )}
              style={style}
              title={`${formatEntityType(entity.type)} - ${entity.key ? `${entity.key} - ` : ""}${entity.title}`}
              onClick={() => onSelect(entity.id)}
              onDoubleClick={() => onOpen(entity.id)}
            >
              {complete ? <span className="h-2 w-2 rounded-full bg-white/90" /> : null}
              <span className="pointer-events-none absolute left-1/2 top-full mt-2 hidden max-w-52 -translate-x-1/2 rounded-md border border-border bg-white px-2 py-1 text-left text-xs font-medium shadow-pane group-hover:block">
                <span className="block truncate">{entity.title}</span>
                <span className="block truncate text-muted-foreground">
                  {formatEntityType(entity.type)}
                  {entity.key ? ` - ${entity.key}` : ""}
                </span>
              </span>
            </button>
          );
        })}
      </div>
      {matches.length === 0 ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
          <Network className="mr-2 h-4 w-4" />
          No graph nodes in scope.
        </div>
      ) : null}
    </div>
  );
}
