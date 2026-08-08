import type { Entity } from "../types";
import type { QueryPlan } from "../query/types";

/** Storage port for PlanApi controllers. Implemented by db (SQL) or memory (tests). */
export interface EntityStore {
  getById(id: string): Promise<Entity | null>;
  execute(plan: QueryPlan): Promise<Entity[]>;
}
