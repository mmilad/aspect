import type {
  EnsureWorkflowPresetsOptions,
  EnsureWorkflowPresetsResult,
  JsonRecord,
  WorkflowGraph,
  WorkflowPreset
} from "@projectplaner/core";
import workflow from "@projectplaner/core/workflow";

const { parse: parseWorkflowGraph } = workflow.graph;
const { WORKFLOW_SCHEMA_VERSION } = workflow.nodes;
const { list: listWorkflowPresets } = workflow.presets;
import type { Storage } from "./contracts/storage";



/** True when a preset pack has been seeded into the living DB. */
export async function findSeededWorkflowPreset(
  db: Storage,
  presetKey: string,
  projectKey = "PLAN"
): Promise<{ id: string; title: string; presetKey: string } | null> {
  const found = await db.catalog.findPreset(projectKey, presetKey);
  if (!found) {
    return null;
  }
  return { id: found.id, title: found.title, presetKey };
}

async function findSupportsTargetId(
  db: Storage,
  projectKey: string,
  slug: string | undefined,
  warnings: string[]
): Promise<string | undefined> {
  if (!slug) {
    return undefined;
  }
  const aspects = await db.entities.list({ projectKey, type: "aspect" });
  const features = await db.entities.list({ projectKey, type: "feature" });
  const match =
    aspects.find((entity) => entity.slug === slug || entity.key === slug) ??
    features.find((entity) => entity.slug === slug || entity.key === slug);
  if (!match) {
    warnings.push(`Preset supports target "${slug}" not found; skipping link.`);
    return undefined;
  }
  return match.id;
}

async function ensureSupportsLink(
  db: Storage,
  flowId: string,
  targetId: string | undefined
): Promise<void> {
  if (!targetId) {
    return;
  }
  const existing = await db.relations.list({ sourceEntityId: flowId });
  if (existing.some((relation) => relation.targetEntityId === targetId && relation.type === "supports")) {
    return;
  }
  await db.relations.create({
    sourceEntityId: flowId,
    targetEntityId: targetId,
    type: "supports"
  });
}

function presetMetadata(preset: WorkflowPreset, dirty = false): JsonRecord {
  return {
    presetKey: preset.presetKey,
    presetVersion: preset.presetVersion,
    presetKind: preset.kind,
    presetDirty: dirty,
    schemaVersion: WORKFLOW_SCHEMA_VERSION
  };
}

function graphSnapshot(graph: WorkflowGraph): JsonRecord {
  return {
    version: graph.version,
    nodes: graph.nodes,
    edges: graph.edges,
    ...(graph.variables ? { variables: graph.variables } : {})
  };
}

async function syncPresetCatalogFields(
  db: Storage,
  existing: { id: string; metadata: JsonRecord },
  preset: WorkflowPreset,
  targetId: string | undefined
): Promise<void> {
  if (existing.metadata.presetKind !== preset.kind) {
    await db.entities.update({
      id: existing.id,
      patch: {
        metadata: {
          ...existing.metadata,
          presetKind: preset.kind
        }
      }
    });
  }
  await ensureSupportsLink(db, existing.id, targetId);
}

/**
 * Seed workflow presets into the living DB once.
 * With force=true, replace pack graphs for matching preset keys (dev reseed).
 */
export async function ensureWorkflowPresets(
  db: Storage,
  options: EnsureWorkflowPresetsOptions = {}
): Promise<EnsureWorkflowPresetsResult> {
  const projectKey = options.projectKey ?? "PLAN";
  const force = Boolean(options.force) || process.env.PROJECTPLANER_PRESETS_FORCE === "1";
  const only = options.only?.length ? new Set(options.only) : null;

  const seeded: string[] = [];
  const skipped: string[] = [];
  const reseeded: string[] = [];
  const warnings: string[] = [];

  if (!(await db.projects.findByKey(projectKey))) return { seeded, skipped, reseeded, warnings };

  const presets = listWorkflowPresets().filter((preset) => !only || only.has(preset.presetKey));

  for (const preset of presets) {
    const parsed = parseWorkflowGraph(preset.graph);
    if (!parsed.ok) {
      warnings.push(`Preset ${preset.presetKey} invalid: ${parsed.errors.join("; ")}`);
      continue;
    }

    const targetId = await findSupportsTargetId(db, projectKey, preset.supportsTargetSlug, warnings);
    const candidate = await db.catalog.findPreset(projectKey, preset.presetKey);
    if (candidate && !force && candidate.metadata.presetKind === preset.kind) {
      const linked = !targetId || (await db.relations.list({ sourceEntityId: candidate.id })).some(r => r.targetEntityId === targetId && r.type === "supports");
      if (linked) { skipped.push(preset.presetKey); continue; }
    }
    // Acquire write ownership only when catalog changes are needed, then recheck.
    await db.transaction(async db => {
      const existing = await db.catalog.findPreset(projectKey, preset.presetKey);

      if (!existing) {
        const created = await db.entities.create({
          projectKey,
          type: "flow",
          title: preset.title,
          summary: preset.summary,
          body: preset.body ?? preset.summary,
          status: preset.status ?? "accepted",
          metadata: presetMetadata(preset, false),
          ...(targetId
            ? {
              relations: [{ targetEntityId: targetId, type: "supports" as const }]
            }
            : {})
        });

        (await db.persist.saveGraph({
          workflowId: created.entity.id,
          projectId: created.entity.projectId,
          graph: parsed.graph
        }));

        const metadata = {
          ...presetMetadata(preset, false),
          graph: graphSnapshot(parsed.graph)
        };
        await db.entities.update({
          id: created.entity.id,
          patch: { metadata }
        });

        seeded.push(preset.presetKey);
        return;
      }

      if (!force) {
        await syncPresetCatalogFields(db, existing, preset, targetId);
        skipped.push(preset.presetKey);
        return;
      }

      if (existing.metadata.presetDirty === true) {
        warnings.push(
          `Force-reseeding dirty preset ${preset.presetKey} (local edits will be overwritten).`
        );
      }

      (await db.persist.saveGraph({
        workflowId: existing.id,
        projectId: existing.projectId,
        graph: parsed.graph
      }));

      await db.entities.update({
        id: existing.id,
        patch: {
          title: preset.title,
          summary: preset.summary,
          body: preset.body ?? preset.summary,
          status: preset.status ?? "accepted",
          metadata: {
            ...existing.metadata,
            ...presetMetadata(preset, false),
            graph: graphSnapshot(parsed.graph)
          }
        }
      });

      await ensureSupportsLink(db, existing.id, targetId);
      reseeded.push(preset.presetKey);
    });
  }

  return { seeded, skipped, reseeded, warnings };
}

/** Mark a preset-backed flow dirty after human/bot edit. */
export async function markWorkflowPresetDirty(db: Storage, flowId: string): Promise<void> {
  const entity = await db.entities.get(flowId);
  if (!entity || entity.type !== "flow") {
    return;
  }
  if (typeof entity.metadata.presetKey !== "string") {
    return;
  }
  if (entity.metadata.presetDirty === true) {
    return;
  }
  await db.entities.update({
    id: flowId,
    patch: {
      metadata: {
        ...entity.metadata,
        presetDirty: true
      }
    }
  });
}
