# UI (`apps/web`)

Dense operational UI. **Graph is primary navigation within a project.** No marketing layouts.

## Shell layout

Shared 3-pane chrome via `ProjectShell` / `ProjectViewShell`:

| Pane | Role |
|------|------|
| Left | Project Tabs (Workspace, Graph, Issues, Kanban), **Assistant** (New chat + session list), **Tools** (Workflows, Schemas), Graph filters when Graph is active |
| Center | Inspect: workspace (graph, kanban, …). Assistant: chat (or a selected session view). |
| Right | Inspect: **Create** + entity/step/Describe. Assistant: inferred session buttons (Summary, Topics, Context, later Plans). The page does not scroll — header stays pinned; left and right panes scroll independently. |

**Inspect** is entity / workflow step / Describe (`components/inspector/`). **Assistant** is a conversation document (`components/assistant/`) — **not a graph entity**. Left sidebar **Assistant** has **New chat** and the session list. Open a session (or Chat in the right rail) and the conversation occupies the **main pane**. Other session views light up as right-sidebar buttons. Right chrome keeps **Inspect** (returns to graph/workspace + inspector) and collapse — there is no Assistant toggle in the chrome.

Flow editor (`WorkflowEditorShell`) uses the same shell: center is toolbar + React Flow (or Diagram Mermaid view); Inspect still shows Author when **Describe** is on, step details when a node is selected, otherwise the flow entity. Assistant is a sibling mode — it does not replace Describe. No nested palette or second inspector column.

Add workflow steps via toolbar **Add** or canvas **right-click** context menu (connect-kind lives there too).

New assistant UI uses shadcn primitives (`Button`, `Textarea`, `Breadcrumb`, `ScrollArea`, `Message`, `Bubble`, `Item`, `Field`, `Dialog`). Assistant non-chat views render from the core block catalog via `SchemaView`.

## Surfaces

| Route | Purpose |
|-------|---------|
| `/` | Multi-project hub — list / create / delete projects (`PLAN` is protected). Manual **Create example (Signal Desk)** seeds key `DEMO` (content pipeline); not auto-seeded — delete `DEMO` to recreate. |
| `/projects/[key]` | Project Workspace — operational stats hub (counts by type/status, workflow defs) |
| Graph | React Flow entity graph — navigate, filter, open entities |
| Issues | Task list with status / tag filters |
| Kanban | Process-status columns for Aspect / Feature / Task |
| Entity detail | Single entity inspector |
| Flows / workflows | Edit and inspect workflow step graphs |

Project tabs carry aspect/selection context across Graph / Issues / Kanban. Create/delete project is **web UI + HTTP only** (not MCP).

## Right pane folders

```
components/inspector/     # Inspect mode
  index.tsx               # InspectorHost (PaneFrame)
  entity-inspector/
  workflow-step-inspector/
  workflow-author-inspector/

components/assistant/     # Assistant mode
  index.tsx               # AssistantHost — main chat / schema view
  assistant-rail.tsx      # Right-sidebar session buttons
  schema-view/            # Catalog → shadcn (prose/fields/chips/list/ref)
```

Avoid a second inspector inside center workspaces.

## UX rules

- Operational density over dashboards.
- Status badges follow the process ladder (and decision/question sets where relevant).
- Creation stays compact at the top of Inspect (entity inspector) with selection context.
- Soft-deleted (`archived`) entities stay out of default graph/list views.
- Assistant sessions archive; never hard-delete.

## Run

```bash
pnpm dev
```

Stale runtime: delete `apps/web/.next` and restart.

Code: `apps/web` (App Router + components under `components/`, helpers under `lib/`).
