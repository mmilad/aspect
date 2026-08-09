# UI (`apps/web`)

Dense operational UI. **Graph is primary.** No marketing layouts.

## Surfaces

| Route (under `/projects/PLAN`) | Purpose |
|--------------------------------|---------|
| Graph | React Flow entity graph — navigate, filter, open entities |
| Issues | Task list with status / tag filters |
| Kanban | Process-status columns for Aspect / Feature / Task |
| Entity detail | Single entity inspector |
| Flows / workflows | Edit and inspect workflow step graphs |

Project tabs carry aspect/selection context across Graph / Issues / Kanban.

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
