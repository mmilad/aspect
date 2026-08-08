"use client";

import { ChevronRight } from "lucide-react";
import type { ProjectNode } from "@projectplaner/core";
import { cn } from "../../lib/utils";

interface BreadcrumbsProps {
  nodes: ProjectNode[];
  onOpen: (id: string) => void;
}

export function Breadcrumbs({ nodes, onOpen }: BreadcrumbsProps) {
  const visibleNodes = nodes.length > 4 ? [nodes[0], ...nodes.slice(-3)] : nodes;
  const collapsed = nodes.length > visibleNodes.length;

  return (
    <nav className="flex min-w-0 flex-1 items-center gap-1 overflow-hidden" aria-label="Aspect breadcrumb">
      {visibleNodes.map((node, index) => {
        const isFirstVisible = index === 0;
        const isLast = index === visibleNodes.length - 1;

        return (
          <div key={node.id} className="flex min-w-0 items-center gap-1">
            {!isFirstVisible ? <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" /> : null}
            {collapsed && index === 1 ? (
              <>
                <span className="rounded-md px-1.5 text-xs text-muted-foreground">...</span>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              </>
            ) : null}
            <button
              className={cn(
                "min-w-0 truncate rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted",
                isLast ? "max-w-72 font-semibold text-zinc-950" : "max-w-44 text-muted-foreground"
              )}
              title={node.path}
              onClick={() => onOpen(node.id)}
            >
              {node.title}
            </button>
          </div>
        );
      })}
    </nav>
  );
}
