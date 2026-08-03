# Projectplaner

Projectplaner is a local graph-first planning tool for software projects.

It is not meant to be a Jira, Linear, or Kanban clone. The core model is an
Aspect Graph: aspects describe what should exist, hold true, or matter in the
project. Features and tasks attach to those aspects so humans and AI can
understand impact, dependencies, open work, and why a task exists.

## Product Principles

- Graph is the primary navigation surface.
- Aspects are meaning anchors.
- Features are first-class objects, not tags.
- Tasks are first-class work items, but never contextless.
- Every task must link to at least one Aspect or Feature.
- Tags are orthogonal filters, not structure.
- Store `depends_on`; derive `depended_on_by`.
- Use `blocked_by` for temporary execution blockers.
- Use `depends_on` for structural or logical dependencies.
- Keep one primary Aspect parent for breadcrumbs.
- Use relations for additional meaning, dependency, or parent-like context.
- The product should help AI orient itself without reading scattered docs.

## Current Architecture

- `apps/web`: Next.js app with App Router.
- `packages/core`: domain types, seed data, graph/task planning helpers.
- `packages/db`: SQLite schema, migrations, and repository layer.
- SQLite uses Node 24 `node:sqlite`.
- React Flow is used for the graph canvas.
- The local seed project key is `PLAN`.

## Important Files

- `packages/core/src/types.ts`
- `packages/core/src/task-planning.ts`
- `packages/core/src/seed.ts`
- `packages/db/src/repository.ts`
- `packages/db/src/schema.ts`
- `apps/web/components/app-shell.tsx`
- `apps/web/app/api/tasks/route.ts`

## Current Product Shape

- The first screen is the working graph, not a landing page.
- Double-clicking an Aspect centers the graph on that Aspect.
- Breadcrumbs let the user navigate back through the Aspect tree.
- The Inspector shows Aspect detail, related Features, Tasks, Tags, Relations,
  Draft Plans, and Feature detail.
- Tasks can be created from the Inspector and are linked to the selected Aspect
  or Feature.

## Agent Workflow

Projectplaner should be used to navigate Projectplaner itself. Before changing
code, orient in the local Aspect Graph:

```bash
pnpm plan orient
pnpm plan orient <aspect-or-feature-query>
```

Use the output to identify the Aspect or Feature your work affects. Prefer a
specific Feature when one exists; otherwise use the most specific Aspect. Only
fall back to `Misc` when the affected area is genuinely unclear.

When work reveals a new follow-up, add it as a linked task instead of leaving it
only in chat or scattered notes:

```bash
pnpm plan add-task --title "Short imperative title" --target aspect:node_agent_orientation --description "Why this matters" --priority medium --link affects --criteria "Observable acceptance condition"
pnpm plan add-task --title "Implement a feature slice" --target feature:feature_agent_orientation --link implements
```

Prefer the generic entity controls for new automation and API work:

```bash
pnpm plan create-entity --type task --title "Short imperative title" --target node_domain --link affects
pnpm plan update-entity --id task_id --status doing
pnpm plan get-entity --id node_domain
pnpm plan list-entities --type aspect
pnpm plan create-relation --from task_id --to feature_id --type depends_on
pnpm plan export --out projectplaner.plan.json
pnpm plan import --from projectplaner.plan.json
```

Task creation requires a target Aspect or Feature, preserving the rule that
tasks are never contextless. The command seeds missing baseline data before it
reads or writes, so a fresh checkout can use it immediately.

SQLite is the living planning state. The legacy seed remains a bootstrap and
migration fixture; use `pnpm plan export` and `pnpm plan import` for portable
project state.

For the current self-planning map, the agent-orientation feature is
`feature_agent_orientation` and its anchoring aspect is `node_agent_orientation`.

## Domain Model Notes

- Aspects are broad meaning and impact anchors.
- Features are separate first-class planning objects.
- Tasks are work items with required links to Aspects or Features.
- `taskLinks` express `affects`, `implements`, `validates`, or `investigates`.
- `entityRelations` provide unified relationships across Aspects, Features,
  Tasks, Decisions, Questions, References, and Projects.
- Tags are project-wide free labels assignable to Aspects, Features, and Tasks.
- `Misc` is a visible fallback Aspect for work that is not classified yet.

## Verification

Run these before reporting implementation work complete:

```bash
pnpm typecheck
pnpm test
pnpm build
```

The Next dev server commonly needs a fresh `.next` cache after model or
dependency changes. If the local app shows a stale vendor chunk or runtime
error, stop the old dev process, remove `apps/web/.next`, and restart `pnpm dev`.

## UX Guidance

- Build the usable planning experience directly.
- Avoid marketing pages, hero sections, and decorative layouts.
- Keep UI dense, operational, and readable.
- The graph should feel like a planning map, not a static diagram.
- Sidebar or tab views are secondary operational surfaces, not the primary
  planning model.
