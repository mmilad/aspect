---
name: plan-orchestrate
description: >-
  Orchestrates Projectplaner tasks by sealing a brief for a subagent executor
  while the parent owns MCP plan reads/writes, review, and approvals. Use when
  the user asks to orchestrate a PLAN task, spawn a sealed-brief agent, run a
  plan-controlled retry, or parent-controls-child execution against the
  Projectplaner graph.
---

# Plan orchestrate

Parent = planner + reviewer. Child = code-only executor.

## When to use

- User wants you to **control** a subagent on a PLAN-* task
- Retry / cold-exec with less MCP friction than letting the child look up work
- Keep graph hygiene (status, AC, packets) on the parent

## Hard rules

1. **Parent owns Projectplaner MCP** (serialize calls). Child must not call it.
2. **Child must not commit** unless the user explicitly asked the parent to have it commit.
3. Prefer **leaf Feature** ids for `relatedTo` / `next_work` — not `contains`-parents.
4. `get_entity` needs the **entity UUID**, not `PLAN-66` / `FEAT-23` keys (use `search` first).
5. Prefer seeded **`run_workflow`** (`update_task`, `update_feature`, …) over direct writes when presets are seeded.
6. If code already ahead of the task body/AC, **refresh the graph before spawn**.

## Workflow

Copy and track:

```
Orchestrate:
- [ ] 1. Resolve task (search → get_entity by id)
- [ ] 2. Align graph with repo (body/AC/status=doing)
- [ ] 3. Seal brief → Task subagent
- [ ] 4. Review report + diff + typecheck
- [ ] 5. Approve / resume with change request
- [ ] 6. Parent: status + packet_write (commit only if user asked)
```

### 1. Resolve

- `orient` once per session if needed
- `search` for the PLAN key/title → take `id`
- `get_entity` with UUID (`includeBody` / `includeMetadata` for AC)

### 2. Align before spawn

Inspect the real tree (don't trust stale AC alone).

If partial work already landed:

- `run_workflow` `update_task` with refreshed `body` / `summary` / `acceptanceCriteria`
- Set `status: doing`
- Say what is **already true** vs **remaining**

### 3. Seal brief and spawn

Use Task `generalPurpose` (or `best-of-n-runner` if isolation requested). Put **everything** the child needs in the prompt — no “look up PLAN-66”.

**Child constraints (include verbatim):**

```
You are a code-only executor. Do NOT use Projectplaner MCP. Do NOT mark tasks done.
Do NOT commit. Do NOT expand scope. Return the structured report only.
```

**Brief must include:**

- Task key + title + UUID (for parent reference; child does not write graph)
- Repo path
- Repo reality (what is already done)
- Residual acceptance criteria
- Paths / constraints (dense UI, no redesign, match local patterns)
- Required verification command(s)
- Required return format (below)

### 4. Review

Check:

- Diff matches sealed AC (no scope creep)
- Claimed verification actually passed
- Complications honest

If incomplete → `resume` the same agent with a short change request. Do not silently rewrite large chunks yourself unless the user wants the parent to finish.

### 5. Close (parent only)

On approve:

- `run_workflow` `update_task` → `status: done`, accurate reason, refreshed AC if needed
- `packet_write` with `state` + `next`
- Commit **only** if the user asked

## Sealed brief template

```markdown
# Sealed execution brief — PLAN-XX

You are a **code-only executor**. Do NOT use Projectplaner MCP. Do NOT mark tasks done.
Do NOT commit. Do NOT expand scope. Return a structured report to the parent orchestrator.

## Task
**PLAN-XX** — <title>
UUID: <entity-id> (do not write the graph)
Repo: <absolute-repo-root>

## Repo reality (trust this)
- <already true>
- <already true>

## Residual acceptance
1. ...
2. ...

## Constraints
- Dense operational UI — no redesign
- Match existing patterns in touched folders
- No new dependencies
- No commits / no MCP

## Verification
- <exact command(s)>

## Return format (required)
## Status
done | blocked | partial

## Files changed
- path — one-line why

## AC checklist
- [ ] ...

## Verification
- <command>: pass/fail

## Complications
- bullets (or "none")

## Notes for orchestrator
- graph narrative / follow-ups the parent should write
```

## Child report → parent actions

| Child status | Parent action |
|--------------|---------------|
| done + review OK | update_task done + packet_write |
| partial / blocked | resume with change request, or re-seal |
| AC wrong vs code | fix graph, then resume or re-spawn |
| scope creep | resume: revert extras / narrow to brief |

## Anti-patterns

- Letting the child `search` / `next_work` / `packet_write`
- Spawning on a stale “god-file” AC when modules already exist
- Marking done without reviewing the diff
- Using `relatedTo` on a `contains` parent expecting children/tasks
```
