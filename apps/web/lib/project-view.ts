export const projectViews = ["workspace", "graph", "entity", "workflow"] as const;

export type ProjectView = (typeof projectViews)[number];

export const projectViewLabel: Record<ProjectView, string> = {
  workspace: "Workspace",
  graph: "Graph",
  entity: "Entity Detail",
  workflow: "Workflow Graph"
};
