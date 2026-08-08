"use client";

import { CircleDot, Tags } from "lucide-react";
import type { ProjectNode, ProjectPlanSnapshot } from "@projectplaner/core";
import { Badge } from "../ui/badge";
import styles from "./style.module.css";

interface ScopeSectionProps {
  snapshot: ProjectPlanSnapshot;
  centerNode?: ProjectNode;
  recentScopes?: ProjectNode[];
  onOpenScope?: (id: string) => void;
}

export function ScopeSection({ snapshot, centerNode, recentScopes = [], onOpenScope }: ScopeSectionProps) {
  return (
    <>
      <section className={styles.section}>
        <div className={styles.heading}>Scope</div>
        {centerNode ? (
          <button className={styles.scopeItem} title={centerNode.path} onClick={() => onOpenScope?.(centerNode.id)}>
            <span className="inline-flex min-w-0 items-center gap-2">
              <CircleDot className="h-3.5 w-3.5 shrink-0 text-teal-700" />
              <span className="truncate">{centerNode.title}</span>
            </span>
          </button>
        ) : null}
        <div className="mt-2 grid gap-1">
          {recentScopes.slice(0, 5).map((scope) => (
            <button key={scope.id} className={styles.scopeItem} title={scope.path} onClick={() => onOpenScope?.(scope.id)}>
              {scope.title}
            </button>
          ))}
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.heading}>Inventory</div>
        <div className="grid gap-2 text-xs text-muted-foreground">
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-2">
              <Tags className="h-3.5 w-3.5" />
              Tags
            </span>
            <Badge>{snapshot.tags.length}</Badge>
          </div>
          <div className="flex items-center justify-between">
            <span>Draft plans</span>
            <Badge>{snapshot.draftPlans.length}</Badge>
          </div>
        </div>
      </section>
    </>
  );
}
