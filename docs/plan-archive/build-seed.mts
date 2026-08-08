/**
 * One-shot rebuild helper: reads full-plan.json, writes salvage markdown + seed-plan.json.
 * Run: pnpm exec tsx docs/plan-archive/build-seed.mts
 */
import fs from "node:fs";
import path from "node:path";

type JsonRecord = Record<string, unknown>;

type Entity = {
  id: string;
  projectId: string;
  type: string;
  key: string | null;
  slug: string | null;
  title: string;
  summary: string;
  body: string;
  status: string;
  metadata: JsonRecord;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

type Relation = {
  id: string;
  projectId: string;
  sourceEntityId: string;
  targetEntityId: string;
  type: string;
  label: string | null;
  isPrimary: boolean;
  metadata: JsonRecord;
  createdAt: string;
  updatedAt: string;
};

type Plan = {
  project: { id: string; key: string; title: string; description: string };
  entities: Entity[];
  relations: Relation[];
  tags: Array<{ id: string; projectId: string; slug: string; label: string; kind: string }>;
  tagAssignments: Array<{ id: string; tagId: string; entityId: string }>;
};

const ROOT = path.resolve("docs/plan-archive");
const NOW = new Date().toISOString();

const DROP_IDS = new Set<string>([
  // MCP smoke leftovers
  "task_9d5639c1-3f2f-46d3-b3a7-9dff39dc4c4a", // PLAN-67 MCP smoke task
  "task_637809fe-24db-4680-8896-ac75b412e4eb", // PLAN-68
  "task_9be14eab-925e-4759-bc17-226be3369e5d", // PLAN-69
  "task_fcc49276-c710-496c-8f75-d798eae24d8f", // PLAN-25 Smoke verify add-task
  "aspect_c5f1b401-82d7-4d86-98e4-cb7ff8d66499", // smoke parenting aspect
  "question_6596aab0-f158-48df-81e4-034dd3761619" // Smoke metadata-file question
]);

const KEEP_CONTRACT_REF_IDS = new Set([
  "reference_48f8d2f4-f9b9-4e5a-a4a4-531ef1522863", // Orientation Packet v1
  "reference_8d012a57-76bd-4385-8cd4-82b8b9add838", // Agent Playbook v1
  "reference_38adc69f-364b-4ab8-aa86-169f16a54a77" // Workflow Step Graph v1
]);

/** Older graph feature folds into full-entity graph spine */
const GRAPH_MERGE = {
  keepFeatureId: "feature_2e2be4dc-dba1-410c-8d1a-3f5e23369b2b", // Full Entity Graph Navigation
  foldFeatureId: "feature_graph_navigation" // Graph Navigation → related_to keep
};

function isPacketRef(e: Entity): boolean {
  if (e.type !== "reference") return false;
  if (KEEP_CONTRACT_REF_IDS.has(e.id)) return false;
  const kind = e.metadata?.kind;
  return (
    kind === "orientation_packet" ||
    /^Handoff for/i.test(e.title) ||
    /^Orientation Packet for/i.test(e.title)
  );
}

function shouldDrop(e: Entity): boolean {
  if (DROP_IDS.has(e.id)) return true;
  if (isPacketRef(e)) return true;
  return false;
}

function existingNarrative(e: Entity): JsonRecord {
  const raw = e.metadata?.narrative;
  return raw && typeof raw === "object" && !Array.isArray(raw) ? { ...(raw as JsonRecord) } : {};
}

function inventReason(e: Entity, relations: Relation[], byId: Map<string, Entity>): string {
  const prior = existingNarrative(e).reason;
  if (typeof prior === "string" && prior.trim()) return prior.trim();

  const summary = (e.summary || "").trim();
  const linked = relations
    .filter((r) => r.sourceEntityId === e.id || r.targetEntityId === e.id)
    .slice(0, 4)
    .map((r) => {
      const otherId = r.sourceEntityId === e.id ? r.targetEntityId : r.sourceEntityId;
      const other = byId.get(otherId);
      return other ? `${r.type}→${other.type}:${other.title}` : null;
    })
    .filter(Boolean);

  if (e.type === "project") {
    return "Root product plan for Projectplaner — nested aspects and linked work.";
  }
  if (e.type === "aspect") {
    return summary
      ? `Meaning anchor: ${summary}`
      : `Aspect meaning anchor for “${e.title}” in the project graph.`;
  }
  if (e.type === "feature") {
    return summary
      ? `Shippable capability: ${summary}`
      : `Feature slice implementing planning capability “${e.title}”.`;
  }
  if (e.type === "task") {
    const statusNote = e.status === "done" ? "Completed work retained for graph history." : "Open planning/implementation work.";
    return summary
      ? `${statusNote} ${summary}`
      : `${statusNote} Task “${e.title}” (${e.key ?? e.id}).`;
  }
  if (e.type === "decision") {
    return summary ? `Accepted/planned decision: ${summary}` : `Decision recorded as “${e.title}”.`;
  }
  if (e.type === "question") {
    return summary ? `Open question: ${summary}` : `Question to resolve: “${e.title}”.`;
  }
  if (e.type === "flow") {
    return summary ? `Agent/product flow: ${summary}` : `Flow definition “${e.title}”.`;
  }
  if (e.type === "reference") {
    return summary ? `Durable contract/reference: ${summary}` : `Reference document “${e.title}”.`;
  }
  return linked.length
    ? `Plan node “${e.title}” (${e.type}); linked: ${linked.join("; ")}.`
    : `Plan node “${e.title}” (${e.type}, ${e.status}).`;
}

function inventProposal(e: Entity): string | undefined {
  const prior = existingNarrative(e).proposal;
  if (typeof prior === "string" && prior.trim()) return prior.trim();
  if (e.type === "task" && e.status !== "done") {
    return "Pick up via next_work / search; leave packet_write when handing off.";
  }
  if (e.type === "feature" && (e.status === "planned" || e.status === "not_implemented" || e.status === "in_work")) {
    return "Prefer smallest next task under this feature before expanding scope.";
  }
  if (e.type === "question") {
    return "Resolve into a decision or reference; link answers relation.";
  }
  return undefined;
}

function scrubMetadata(metadata: JsonRecord): JsonRecord {
  const next = { ...metadata };
  delete next.legacy;
  return next;
}

function withNarrative(e: Entity, relations: Relation[], byId: Map<string, Entity>): Entity {
  const narrative: JsonRecord = {
    ...existingNarrative(e),
    reason: inventReason(e, relations, byId),
    updatedAt: NOW,
    updatedBy: "rebuild"
  };
  const proposal = inventProposal(e);
  if (proposal) narrative.proposal = proposal;
  return {
    ...e,
    updatedAt: NOW,
    metadata: {
      ...scrubMetadata(e.metadata),
      narrative
    }
  };
}

function mdEscape(s: string): string {
  return s.replace(/\|/g, "\\|");
}

function writeSalvageDocs(plan: Plan, dropped: Entity[], kept: Entity[], seedRelations: Relation[]) {
  const byType: Record<string, number> = {};
  for (const e of plan.entities) byType[e.type] = (byType[e.type] || 0) + 1;
  const keptByType: Record<string, number> = {};
  for (const e of kept) keptByType[e.type] = (keptByType[e.type] || 0) + 1;

  const packets = plan.entities.filter(isPacketRef);
  const smoke = plan.entities.filter((e) => DROP_IDS.has(e.id));

  fs.writeFileSync(
    path.join(ROOT, "README.md"),
    `# Plan archive (pre-rebuild)

Frozen snapshot of living Projectplaner graph before curated rebuild.

## Contents

| Path | Purpose |
|------|---------|
| \`full-plan.json\` | Full \`GenericPlanExport\` dump |
| \`.local/projectplaner.pre-rebuild.db\` | Binary DB backup (gitignored) |
| \`seed-plan.json\` | Curated import seed (post-consolidation) |
| \`INDEX.md\` | Keep / drop / merge decisions |
| \`*.md\` area distillations | Human-readable salvage notes |
| \`REBUILD.md\` | What changed after import |

## Commands

\`\`\`bash
# Re-export living DB (from repo root; CLI cwd is packages/db)
pnpm plan export --out ../../docs/plan-archive/full-plan.json

# Rebuild living DB from curated seed
pnpm plan import --from ../../docs/plan-archive/seed-plan.json
\`\`\`

Archive taken: ${NOW}
`,
    "utf8"
  );

  fs.writeFileSync(
    path.join(ROOT, "INDEX.md"),
    `# Index — keep / drop / merge

## Pre-rebuild counts

| Type | Count |
|------|------:|
${Object.entries(byType)
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([t, n]) => `| ${t} | ${n} |`)
  .join("\n")}
| **total entities** | **${plan.entities.length}** |
| relations | ${plan.relations.length} |

## Target (seed) counts

| Type | Count |
|------|------:|
${Object.entries(keptByType)
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([t, n]) => `| ${t} | ${n} |`)
  .join("\n")}
| **total entities** | **${kept.length}** |
| relations | ${seedRelations.length} |

## Drop

### Smoke leftovers
${smoke.map((e) => `- \`${e.id}\` (${e.type}${e.key ? ` ${e.key}` : ""}) — ${e.title}`).join("\n")}

### Orientation / handoff packet references (${packets.length})
${packets.map((e) => `- \`${e.id}\` — ${e.title}`).join("\n")}

## Keep (contract references)

- Orientation Packet v1
- Agent Playbook v1
- Workflow Step Graph v1

## Merge

- **Graph spine:** keep \`feature_2e2be4dc-…\` (Full Entity Graph Navigation) as primary.
- Fold \`feature_graph_navigation\` (Graph Navigation) via \`related_to\` toward the full-entity feature; keep aspect nodes \`node_graph_view\` / \`node_tab_graph\` as workspace meaning anchors.
- Aspect ↔ feature pairs otherwise retained; \`Misc\` kept as last-resort fallback.

## Narrative

Every kept entity gets \`metadata.narrative.reason\` (\`updatedBy: rebuild\`). Existing reasons preserved when present.
`,
    "utf8"
  );

  const aspects = plan.entities.filter((e) => e.type === "aspect");
  const features = plan.entities.filter((e) => e.type === "feature");
  fs.writeFileSync(
    path.join(ROOT, "aspects-features.md"),
    `# Aspects & features (pre-rebuild)

## Project roots
- \`node_app\` — Should have Application Shell
- \`node_domain\` — Should have Queryable Domain Model

## Aspects
| id | title | status | keep? |
|----|-------|--------|-------|
${aspects
  .map((e) => `| \`${e.id}\` | ${mdEscape(e.title)} | ${e.status} | ${shouldDrop(e) ? "DROP" : "keep"} |`)
  .join("\n")}

## Features
| id | key | title | status | note |
|----|-----|-------|--------|------|
${features
  .map((e) => {
    let note = shouldDrop(e) ? "DROP" : "keep";
    if (e.id === GRAPH_MERGE.foldFeatureId) note = "fold → Full Entity Graph Navigation";
    if (e.id === GRAPH_MERGE.keepFeatureId) note = "primary graph spine";
    return `| \`${e.id}\` | ${e.key ?? ""} | ${mdEscape(e.title)} | ${e.status} | ${note} |`;
  })
  .join("\n")}
`,
    "utf8"
  );

  const tasks = plan.entities.filter((e) => e.type === "task");
  const empty = tasks.filter((e) => !(e.summary || "").trim());
  fs.writeFileSync(
    path.join(ROOT, "tasks.md"),
    `# Tasks (pre-rebuild)

Total: ${tasks.length}. Empty summary: ${empty.length}.

## By status
${["doing", "todo", "planned", "done", "blocked", "review"]
  .map((s) => {
    const list = tasks.filter((t) => t.status === s);
    if (!list.length) return "";
    return `### ${s} (${list.length})\n${list
      .map(
        (t) =>
          `- ${shouldDrop(t) ? "**DROP** " : ""}\`${t.key ?? t.id}\` ${mdEscape(t.title)}${!(t.summary || "").trim() ? " _(empty summary)_" : ""}`
      )
      .join("\n")}`;
  })
  .filter(Boolean)
  .join("\n\n")}
`,
    "utf8"
  );

  const decisions = plan.entities.filter((e) => e.type === "decision");
  const questions = plan.entities.filter((e) => e.type === "question");
  const flows = plan.entities.filter((e) => e.type === "flow");
  fs.writeFileSync(
    path.join(ROOT, "decisions-questions-flows.md"),
    `# Decisions, questions, flows

## Decisions
${decisions.map((e) => `- \`${e.id}\` **${e.title}** (${e.status}) — ${e.summary || "_no summary_"}`).join("\n")}

## Questions
${questions.map((e) => `- ${shouldDrop(e) ? "**DROP** " : ""}\`${e.id}\` **${e.title}** (${e.status}) — ${e.summary || "_no summary_"}`).join("\n")}

## Flows
${flows.map((e) => `- \`${e.id}\` **${e.title}** (${e.status}) — ${e.summary || "_no summary_"}`).join("\n")}
`,
    "utf8"
  );

  fs.writeFileSync(
    path.join(ROOT, "references-packets.md"),
    `# References & packets

## Keep (contracts)
${plan.entities
  .filter((e) => KEEP_CONTRACT_REF_IDS.has(e.id))
  .map((e) => `- \`${e.id}\` **${e.title}** (kind=${String(e.metadata?.kind ?? "")})`)
  .join("\n")}

## Drop (orientation / handoff packets)
${packets.map((e) => `- \`${e.id}\` ${e.title} (kind=${String(e.metadata?.kind ?? "")})`).join("\n")}
`,
    "utf8"
  );

  fs.writeFileSync(
    path.join(ROOT, "smoke-leftovers.md"),
    `# Smoke leftovers (drop)

${smoke.map((e) => `- \`${e.id}\` (${e.type}${e.key ? `, ${e.key}` : ""}) — ${e.title}`).join("\n")}

Note: PLAN-29 “Add route smoke tests…” is **kept** (real product test work, not MCP litter).
`,
    "utf8"
  );

  void dropped;
}

function main() {
  const plan = JSON.parse(fs.readFileSync(path.join(ROOT, "full-plan.json"), "utf8")) as Plan;
  const byId = new Map(plan.entities.map((e) => [e.id, e]));

  const dropped = plan.entities.filter(shouldDrop);
  const dropIds = new Set(dropped.map((e) => e.id));
  let kept = plan.entities.filter((e) => !dropIds.has(e.id));

  // Enrich Full Entity Graph summary to absorb Graph Navigation intent
  kept = kept.map((e) => {
    if (e.id !== GRAPH_MERGE.keepFeatureId) return e;
    const fold = byId.get(GRAPH_MERGE.foldFeatureId);
    const extra = fold
      ? ` Absorbs earlier Graph Navigation (${fold.key ?? fold.id}): focused/scoped graph modes remain filters over the full entity graph.`
      : "";
    return {
      ...e,
      summary: `${(e.summary || "").trim()}${extra}`.trim(),
      status: e.status === "planned" ? "in_work" : e.status
    };
  });

  // Soft-demote folded Graph Navigation feature
  kept = kept.map((e) => {
    if (e.id !== GRAPH_MERGE.foldFeatureId) return e;
    return {
      ...e,
      summary: `${(e.summary || "").trim()} Folded under Full Entity Graph Navigation; retained for stable FEAT-1 identity and historical links.`.trim(),
      status: "implemented"
    };
  });

  const keptIds = new Set(kept.map((e) => e.id));
  let relations = plan.relations.filter(
    (r) => keptIds.has(r.sourceEntityId) && keptIds.has(r.targetEntityId)
  );

  // Ensure graph fold relation exists
  const hasFoldLink = relations.some(
    (r) =>
      r.sourceEntityId === GRAPH_MERGE.foldFeatureId &&
      r.targetEntityId === GRAPH_MERGE.keepFeatureId &&
      r.type === "related_to"
  );
  if (!hasFoldLink && keptIds.has(GRAPH_MERGE.foldFeatureId) && keptIds.has(GRAPH_MERGE.keepFeatureId)) {
    relations = [
      ...relations,
      {
        id: "relation_rebuild_graph_fold",
        projectId: plan.project.id,
        sourceEntityId: GRAPH_MERGE.foldFeatureId,
        targetEntityId: GRAPH_MERGE.keepFeatureId,
        type: "related_to",
        label: "folded into",
        isPrimary: false,
        metadata: { rebuild: true },
        createdAt: NOW,
        updatedAt: NOW
      }
    ];
  }

  // Link scoped graph aspects to full-entity feature when missing
  for (const aspectId of ["node_graph_view", "node_tab_graph"]) {
    if (!keptIds.has(aspectId)) continue;
    const exists = relations.some(
      (r) =>
        (r.sourceEntityId === GRAPH_MERGE.keepFeatureId && r.targetEntityId === aspectId) ||
        (r.sourceEntityId === aspectId && r.targetEntityId === GRAPH_MERGE.keepFeatureId)
    );
    if (!exists) {
      relations.push({
        id: `relation_rebuild_${aspectId}_graph`,
        projectId: plan.project.id,
        sourceEntityId: GRAPH_MERGE.keepFeatureId,
        targetEntityId: aspectId,
        type: "affects",
        label: null,
        isPrimary: false,
        metadata: { rebuild: true },
        createdAt: NOW,
        updatedAt: NOW
      });
    }
  }

  const keptById = new Map(kept.map((e) => [e.id, e]));

  // Tasks must keep at least one link to aspect/feature
  const anchorTypes = new Set(["aspect", "feature"]);
  const tasksMissingAnchor: string[] = [];
  for (const task of kept.filter((e) => e.type === "task")) {
    const linked = relations.some((r) => {
      if (r.sourceEntityId !== task.id && r.targetEntityId !== task.id) return false;
      const otherId = r.sourceEntityId === task.id ? r.targetEntityId : r.sourceEntityId;
      const other = keptById.get(otherId);
      return other ? anchorTypes.has(other.type) : false;
    });
    if (!linked) tasksMissingAnchor.push(task.id);
  }
  // Retarget orphan tasks to Misc
  for (const taskId of tasksMissingAnchor) {
    if (!keptIds.has("node_misc")) continue;
    relations.push({
      id: `relation_rebuild_orphan_${taskId}`,
      projectId: plan.project.id,
      sourceEntityId: taskId,
      targetEntityId: "node_misc",
      type: "affects",
      label: null,
      isPrimary: true,
      metadata: { rebuild: true, note: "orphan after packet/smoke drop" },
      createdAt: NOW,
      updatedAt: NOW
    });
  }

  const seededEntities = kept.map((e) => withNarrative(e, relations, keptById));

  const tagAssignments = plan.tagAssignments.filter((a) => keptIds.has(a.entityId));
  const usedTagIds = new Set(tagAssignments.map((a) => a.tagId));
  const tags = plan.tags.filter((t) => usedTagIds.has(t.id));

  const seed: Plan = {
    project: plan.project,
    entities: seededEntities,
    relations,
    tags,
    tagAssignments
  };

  // Validate
  const seedIds = new Set(seed.entities.map((e) => e.id));
  for (const r of seed.relations) {
    if (!seedIds.has(r.sourceEntityId) || !seedIds.has(r.targetEntityId)) {
      throw new Error(`Dangling relation ${r.id}`);
    }
  }
  for (const e of seed.entities) {
    const n = e.metadata.narrative as JsonRecord;
    if (typeof n?.reason !== "string" || !n.reason.trim()) {
      throw new Error(`Missing reason on ${e.id}`);
    }
  }

  writeSalvageDocs(plan, dropped, seededEntities, relations);
  fs.writeFileSync(path.join(ROOT, "seed-plan.json"), `${JSON.stringify(seed, null, 2)}\n`, "utf8");

  console.log(
    JSON.stringify(
      {
        dropped: dropped.length,
        kept: seededEntities.length,
        relations: relations.length,
        orphanTasksRetargeted: tasksMissingAnchor.length,
        out: ["README.md", "INDEX.md", "seed-plan.json", "aspects-features.md", "tasks.md", "decisions-questions-flows.md", "references-packets.md", "smoke-leftovers.md"]
      },
      null,
      2
    )
  );
}

main();
