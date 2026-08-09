function withSelected(path: string, selectedId?: string) {
  return selectedId ? `${path}?selected=${encodeURIComponent(selectedId)}` : path;
}

export const projectPaths = {
  workspace: (projectKey: string) => `/projects/${projectKey}`,
  graph: (projectKey: string, selectedId?: string) =>
    withSelected(`/projects/${projectKey}/graph`, selectedId),
  issues: (projectKey: string, selectedId?: string) =>
    withSelected(`/projects/${projectKey}/issues`, selectedId),
  kanban: (projectKey: string, selectedId?: string) =>
    withSelected(`/projects/${projectKey}/kanban`, selectedId),
  workflows: (projectKey: string) => `/projects/${projectKey}/workflows`,
  entity: (projectKey: string, entityId: string, tab?: string) =>
    tab
      ? `/projects/${projectKey}/entities/${entityId}?tab=${encodeURIComponent(tab)}`
      : `/projects/${projectKey}/entities/${entityId}`,
  flow: (projectKey: string, flowId: string) => `/projects/${projectKey}/flows/${flowId}`
} as const;
