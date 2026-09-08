import type { EntityRelation, EntityRelationType, JsonRecord } from "@projectplaner/core";
export interface CreateRelationInput {
  projectKey?: string;
  sourceEntityId: string;
  targetEntityId: string;
  type: EntityRelationType;
  label?: string | null;
  isPrimary?: boolean;
  metadata?: JsonRecord;
}
export interface UpdateRelationInput {
  id: string;
  patch: Partial<Pick<EntityRelation, "type" | "label" | "isPrimary" | "metadata">>;
}
export type RelationQuery = {
  projectKey?: string;
  sourceEntityId?: string;
  targetEntityId?: string;
  type?: EntityRelationType;
};
export interface Operations {
  create(input: CreateRelationInput): Promise<EntityRelation>;
  get(id: string): Promise<EntityRelation | null>;
  list(query?: RelationQuery): Promise<EntityRelation[]>;
  update(input: UpdateRelationInput): Promise<EntityRelation>;
  remove(id: string): Promise<void>;
}
