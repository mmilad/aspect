import type { Entity, EntityRelation, ProjectPlanSnapshot } from "@projectplaner/core";
export interface GenericProjectSnapshot {
  project: ProjectPlanSnapshot["project"];
  entities: Entity[];
  relations: EntityRelation[];
  tags: ProjectPlanSnapshot["tags"];
  tagAssignments: Array<{
    id: string;
    tagId: string;
    entityId: string;
  }>;
}
export interface GenericPlanExport {
  project: ProjectPlanSnapshot["project"];
  entities: Entity[];
  relations: EntityRelation[];
  tags: ProjectPlanSnapshot["tags"];
  tagAssignments: Array<{
    id: string;
    tagId: string;
    entityId: string;
  }>;
}
export interface Operations {
  get(key?: string, options?: {
    includeArchived?: boolean;
  }): Promise<ProjectPlanSnapshot | null>;
  getGeneric(key?: string, options?: {
    includeArchived?: boolean;
  }): Promise<GenericProjectSnapshot | null>;
  export(key?: string): Promise<GenericPlanExport>;
  import(input: GenericPlanExport): Promise<void>;
}
