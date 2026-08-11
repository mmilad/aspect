# UI (`apps/web`)

Dense operational UI. **Graph is primary navigation within a project.** No marketing layouts.

## Shell layout

Shared 3-pane chrome via `ProjectShell` / `ProjectViewShell`:

| Pane | Role |
|------|------|
| Left | Project nav (`ProjectLeftSidebar`: Workspace / Graph / Issues / Kanban, Create rail, filters) |
| Center | Active workspace (stats hub, graph canvas, Issues, Kanban, flow editor, …) |
| Right | Inspector (`components/inspector/`) — entity preview by default |

Flow editor (`WorkflowEditorShell`) uses the same shell: center is toolbar + React Flow (or Diagram Mermaid view); the **shell right pane** shows Author when **Describe** is on, step details when a node is selected, otherwise the flow entity. No nested palette or second inspector column.

Add workflow steps via toolbar **Add** or canvas **right-click** context menu (connect-kind lives there too).

## Surfaces

| Route | Purpose |
|-------|---------|
| `/` | Multi-project hub — list / create / delete projects (`PLAN` is protected) |
| `/projects/[key]` | Project Workspace — operational stats hub (counts by type/status, workflow defs) |
| Graph | React Flow entity graph — navigate, filter, open entities |
| Issues | Task list with status / tag filters |
| Kanban | Process-status columns for Aspect / Feature / Task |
| Entity detail | Single entity inspector |
| Flows / workflows | Edit and inspect workflow step graphs |

Project tabs carry aspect/selection context across Graph / Issues / Kanban. Create/delete project is **web UI + HTTP only** (not MCP).

## Inspector folder

```
components/inspector/
  index.tsx                 # InspectorHost
  entity-inspector/         # Entity / selection preview
  workflow-step-inspector/  # Selected workflow step editor
  workflow-author-inspector/# Describe / brief generate (flow editor)
```

Grow new right-pane kinds under this folder; avoid a second inspector inside center workspaces.

## UX rules

- Operational density over dashboards.
- Status badges follow the process ladder (and decision/question sets where relevant).
- Creation stays compact (left Create rail) with selection context.
- Soft-deleted (`archived`) entities stay out of default graph/list views.

## Run

```bash
pnpm dev
```

Stale runtime: delete `apps/web/.next` and restart.

Code: `apps/web` (App Router + components under `components/`, helpers under `lib/`).
