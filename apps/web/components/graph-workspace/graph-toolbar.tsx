"use client";

import { ArrowUpToLine, Search } from "lucide-react";
import type { ProjectNode } from "@projectplaner/core";
import { formatEntityType } from "../../lib/entity-label";
import { cn } from "../../lib/utils";
import { Breadcrumbs } from "./breadcrumbs";
import type { GraphMatch, GraphMode, GraphSurface } from "./types";

interface GraphToolbarProps {
  parentNode: ProjectNode | null | undefined;
  breadcrumbs: ProjectNode[];
  graphMode: GraphMode;
  graphSurface: GraphSurface;
  query: string;
  searchMatches: GraphMatch[];
  onOpenScope: (id: string) => void;
  onSelectEntity: (id: string) => void;
  onGraphMode: (mode: GraphMode) => void;
  onGraphSurface: (surface: GraphSurface) => void;
  onQuery: (query: string) => void;
  onCenterFromSearch: (id: string) => void;
}

export function GraphToolbar({
  parentNode,
  breadcrumbs,
  graphMode,
  graphSurface,
  query,
  searchMatches,
  onOpenScope,
  onSelectEntity,
  onGraphMode,
  onGraphSurface,
  onQuery,
  onCenterFromSearch
}: GraphToolbarProps) {
  return (
    <div className="absolute left-4 right-4 top-4 z-10 flex max-w-5xl flex-col gap-2">
      <div className="flex min-w-0 flex-wrap items-center gap-2 rounded-md border border-border bg-white p-2 shadow-pane">
        <button
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border hover:bg-muted disabled:opacity-40"
          disabled={!parentNode}
          title="Open parent scope"
          onClick={() => {
            if (parentNode) {
              onOpenScope(parentNode.id);
            }
          }}
        >
          <ArrowUpToLine className="h-4 w-4" />
        </button>
        <Breadcrumbs nodes={breadcrumbs} onOpen={onOpenScope} />
        <div className="ml-auto inline-flex h-9 rounded-md border border-border bg-background p-1">
          {(["full", "scope"] as const).map((mode) => (
            <button
              key={mode}
              className={cn(
                "rounded px-2 text-xs font-medium capitalize",
                graphMode === mode ? "bg-teal-700 text-white" : "text-muted-foreground hover:bg-muted"
              )}
              onClick={() => onGraphMode(mode)}
            >
              {mode}
            </button>
          ))}
        </div>
        <div className="inline-flex h-9 rounded-md border border-border bg-background p-1">
          {(["map", "space"] as const).map((surface) => (
            <button
              key={surface}
              className={cn(
                "rounded px-2 text-xs font-medium capitalize",
                graphSurface === surface ? "bg-zinc-900 text-white" : "text-muted-foreground hover:bg-muted"
              )}
              onClick={() => onGraphSurface(surface)}
            >
              {surface}
            </button>
          ))}
        </div>
        <label className="flex h-9 w-80 shrink-0 items-center gap-2 rounded-md border border-border bg-background px-2">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            className="w-full bg-transparent text-sm outline-none"
            value={query}
            onChange={(event) => onQuery(event.target.value)}
            placeholder="Search graph"
          />
        </label>
      </div>
      {searchMatches.length > 0 ? (
        <div className="rounded-md border border-border bg-white p-2 shadow-pane">
          {searchMatches.map(({ entity, score }) => (
            <button
              key={entity.id}
              className="block w-full rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted"
              onClick={() => {
                onSelectEntity(entity.id);
                if (graphMode === "scope" && entity.type === "aspect") {
                  onCenterFromSearch(entity.id);
                }
              }}
            >
              <span className="flex items-center justify-between gap-2">
                <span className="min-w-0 truncate font-medium">{entity.title}</span>
                <span className="shrink-0 rounded bg-zinc-100 px-1.5 py-0.5 text-[11px] text-zinc-700">{score}</span>
              </span>
              <span className="block truncate text-xs text-muted-foreground">
                {formatEntityType(entity.type)}
                {entity.key ? ` · ${entity.key}` : ""}
                {entity.path ? ` · ${entity.path}` : ""}
              </span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
