function withSelected(path: string, selectedId?: string) {
  return selectedId ? `${path}?selected=${encodeURIComponent(selectedId)}` : path;
}

function withKanbanQuery(
  projectKey: string,
  options?: string | { selected?: string; scope?: string }
) {
  const opts = typeof options === "string" ? { selected: options } : (options ?? {});
  const params = new URLSearchParams();
  if (opts.selected) {
    params.set("selected", opts.selected);
  }
  if (opts.scope) {
    params.set("scope", opts.scope);
  }
  const query = params.toString();
  return query ? `/projects/${projectKey}/kanban?${query}` : `/projects/${projectKey}/kanban`;
}

export const projectPaths = {
  workspace: (projectKey: string) => `/projects/${projectKey}`,
  graph: (projectKey: string, selectedId?: string) =>
    withSelected(`/projects/${projectKey}/graph`, selectedId),
  issues: (projectKey: string, selectedId?: string) =>
    withSelected(`/projects/${projectKey}/issues`, selectedId),
  kanban: (projectKey: string, selectedOrOpts?: string | { selected?: string; scope?: string }) =>
    withKanbanQuery(projectKey, selectedOrOpts),
  workflows: (projectKey: string) => `/projects/${projectKey}/workflows`,
  entity: (projectKey: string, entityId: string, tab?: string) =>
    tab
      ? `/projects/${projectKey}/entities/${entityId}?tab=${encodeURIComponent(tab)}`
      : `/projects/${projectKey}/entities/${entityId}`,
  flow: (projectKey: string, flowId: string) => `/projects/${projectKey}/flows/${flowId}`
} as const;
