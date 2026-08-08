# Plan archive (pre-rebuild)

Frozen snapshot of living Projectplaner graph before curated rebuild.

## Contents

| Path | Purpose |
|------|---------|
| `full-plan.json` | Full `GenericPlanExport` dump |
| `.local/projectplaner.pre-rebuild.db` | Binary DB backup (gitignored) |
| `seed-plan.json` | Curated import seed (post-consolidation) |
| `INDEX.md` | Keep / drop / merge decisions |
| `*.md` area distillations | Human-readable salvage notes |
| `REBUILD.md` | What changed after import |

## Commands

```bash
# Re-export living DB (from repo root; CLI cwd is packages/db)
pnpm plan export --out ../../docs/plan-archive/full-plan.json

# Rebuild living DB from curated seed
pnpm plan import --from ../../docs/plan-archive/seed-plan.json
```

Archive taken: 2026-08-08T15:05:23.281Z
