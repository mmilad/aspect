export const projectPaths = {
  workspace: (projectKey: string) => `/projects/${projectKey}`,
  graph: (projectKey: string, selectedId?: string) =>
    selectedId
      ? `/projects/${projectKey}/graph?selected=${encodeURIComponent(selectedId)}`
      : `/projects/${projectKey}/graph`,
  workflows: (projectKey: string) => `/projects/${projectKey}/workflows`,
  entity: (projectKey: string, entityId: string, tab?: string) =>
    tab
      ? `/projects/${projectKey}/entities/${entityId}?tab=${encodeURIComponent(tab)}`
      : `/projects/${projectKey}/entities/${entityId}`,
  flow: (projectKey: string, flowId: string) => `/projects/${projectKey}/flows/${flowId}`
} as const;
