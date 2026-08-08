"use client";

import type { EntityType } from "@projectplaner/core";
import { cn } from "../../lib/utils";
import styles from "./style.module.css";

const workTypes: EntityType[] = ["aspect", "feature", "task"];

interface GraphFiltersProps {
  activeTypes: Set<EntityType>;
  entityTypes: EntityType[];
  onSelectTypes: (types: Set<EntityType>) => void;
  onToggleType: (type: EntityType) => void;
}

export function GraphFilters({ activeTypes, entityTypes, onSelectTypes, onToggleType }: GraphFiltersProps) {
  return (
    <section className={styles.section}>
      <div className={styles.heading}>Graph Filters</div>
      <div className={styles.filterGrid}>
        <button className="h-7 rounded-md border border-border bg-white px-2 text-xs hover:bg-muted" onClick={() => onSelectTypes(new Set(entityTypes))}>
          All
        </button>
        <button className="h-7 rounded-md border border-border bg-white px-2 text-xs hover:bg-muted" onClick={() => onSelectTypes(new Set(workTypes))}>
          Work
        </button>
        {entityTypes.map((type) => {
          const active = activeTypes.has(type);
          return (
            <button
              key={type}
              className={cn(
                "h-7 rounded-md border px-2 text-xs capitalize",
                active ? "border-teal-700 bg-teal-50 text-teal-900" : "border-border bg-white text-muted-foreground hover:bg-muted"
              )}
              onClick={() => onToggleType(type)}
            >
              {type.replace("_", " ")}
            </button>
          );
        })}
      </div>
    </section>
  );
}
