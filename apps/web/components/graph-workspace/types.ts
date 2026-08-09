import type { Entity } from "@projectplaner/core";

export type GraphMode = "full" | "tree" | "neighborhood" | "open_work" | "workflow" | "deps";
export type GraphSurface = "map" | "space";

export type GraphEntity = Pick<Entity, "id" | "type" | "key" | "title" | "summary" | "body" | "status" | "metadata" | "sortOrder"> & {
  path?: string;
};

export type GraphMatch = { entity: GraphEntity; score: number };

export type GraphFlowNodeData = { entity: GraphEntity; isCenter: boolean; isSelected: boolean; score?: number };
