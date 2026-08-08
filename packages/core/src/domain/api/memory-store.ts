import { evaluatePlan } from "../query/evaluate";
import type { QueryPlan } from "../query/types";
import type { Entity, EntityRelation } from "../types";
import type { EntityStore } from "./store";

export type MemoryEntityStoreOptions = {
  entities: Entity[];
  relations: EntityRelation[];
  /** Map project key → project id for QueryPlan.projectKey scoping */
  projectIdByKey?: Map<string, string>;
};

export class MemoryEntityStore implements EntityStore {
  private readonly entities: Entity[];
  private readonly relations: EntityRelation[];
  private readonly projectIdByKey: Map<string, string>;

  constructor(options: MemoryEntityStoreOptions) {
    this.entities = options.entities;
    this.relations = options.relations;
    this.projectIdByKey = options.projectIdByKey ?? new Map();
  }

  async getById(id: string): Promise<Entity | null> {
    return this.entities.find((entity) => entity.id === id) ?? null;
  }

  async execute(plan: QueryPlan): Promise<Entity[]> {
    return evaluatePlan(plan, this.entities, this.relations, {
      projectIdByKey: this.projectIdByKey
    });
  }
}
