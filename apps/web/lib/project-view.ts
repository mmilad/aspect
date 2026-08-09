export const projectViews = ["workspace", "graph", "workflows", "entity", "workflow"] as const;

export type ProjectView = (typeof projectViews)[number];

export const projectViewLabel: Record<ProjectView, string> = {
  workspace: "Workspace",
  graph: "Graph",
  workflows: "Workflows",
  entity: "Entity Detail",
  workflow: "Workflow Graph"
};

/** Primary sidebar/header views that share the Workflows nav item. */
export function isWorkflowsNavActive(view: ProjectView): boolean {
  return view === "workflows" || view === "workflow";
}
