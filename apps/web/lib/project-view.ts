export const projectViews = ["workspace", "graph", "workflows", "entity", "workflow"] as const;

export type ProjectView = (typeof projectViews)[number];

export const projectViewLabel: Record<ProjectView, string> = {
  workspace: "Workspace",
  graph: "Graph",
  workflows: "Workflows",
  entity: "Entity Detail",
  workflow: "Workflow Graph"
};

/** Chrome surfaces for Header Subnav (Entity Graph vs Workflows). */
export const chromeSurfaces = ["entity-graph", "workflows"] as const;
export type ChromeSurface = (typeof chromeSurfaces)[number];

export const chromeSurfaceLabel: Record<ChromeSurface, string> = {
  "entity-graph": "Entity Graph",
  workflows: "Workflows"
};

export function chromeSurfaceForView(view: ProjectView): ChromeSurface {
  return view === "workflows" || view === "workflow" ? "workflows" : "entity-graph";
}

/** Primary sidebar/header views that share the Workflows nav item. */
export function isWorkflowsNavActive(view: ProjectView): boolean {
  return view === "workflows" || view === "workflow";
}
