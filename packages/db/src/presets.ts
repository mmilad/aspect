import {
  listWorkflowPresets,
  parseWorkflowGraph,
  WORKFLOW_SCHEMA_VERSION,
  type EnsureWorkflowPresetsOptions,
  type EnsureWorkflowPresetsResult,
  type JsonRecord,
  type WorkflowGraph,
  type WorkflowPreset
} from "@projectplaner/core";
import type { DatabaseSync } from "node:sqlite";
import entities from "./repositories/entities";
import relations from "./repositories/relations";
import persist from "./workflows/persist";

function parseJson<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function findFlowByPresetKey(
  db: DatabaseSync,
  projectKey: string,
  presetKey: string
): { id: string; projectId: string; metadata: JsonRecord; title: string } | null {
  const row = db
    .prepare(
      `SELECT entities.id, entities.project_id, entities.metadata_json, entities.title
       FROM entities
       INNER JOIN projects ON projects.id = entities.project_id
       WHERE projects.key = ?
         AND entities.type = 'flow'
         AND json_extract(entities.metadata_json, '$.presetKey') = ?
       LIMIT 1`
    )
    .get(projectKey, presetKey) as
    | { id: string; project_id: string; metadata_json: string; title: string }
    | undefined;

  if (!row) {
    return null;
  }
  return {
    id: row.id,
    projectId: row.project_id,
    metadata: parseJson(row.metadata_json, {}),
    title: row.title
  };
}

/** True when a preset pack has been seeded into the living DB. */
export function findSeededWorkflowPreset(
  db: DatabaseSync,
  presetKey: string,
  projectKey = "PLAN"
): { id: string; title: string; presetKey: string } | null {
  const found = findFlowByPresetKey(db, projectKey, presetKey);
  if (!found) {
    return null;
  }
  return { id: found.id, title: found.title, presetKey };
}

async function findSupportsTargetId(
  db: DatabaseSync,
  projectKey: string,
  slug: string | undefined,
  warnings: string[]
): Promise<string | undefined> {
  if (!slug) {
    return undefined;
  }
  const aspects = await entities.list(db, { projectKey, type: "aspect" });
  const features = await entities.list(db, { projectKey, type: "feature" });
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
  db: DatabaseSync,
  flowId: string,
  targetId: string | undefined
): Promise<void> {
  if (!targetId) {
    return;
  }
  const existing = await relations.list(db, { sourceEntityId: flowId });
  if (existing.some((relation) => relation.targetEntityId === targetId && relation.type === "supports")) {
    return;
  }
  await relations.create(db, {
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
  db: DatabaseSync,
  existing: { id: string; metadata: JsonRecord },
  preset: WorkflowPreset,
  targetId: string | undefined
): Promise<void> {
  if (existing.metadata.presetKind !== preset.kind) {
    await entities.update(db, {
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
  db: DatabaseSync,
  options: EnsureWorkflowPresetsOptions = {}
): Promise<EnsureWorkflowPresetsResult> {
  const projectKey = options.projectKey ?? "PLAN";
  const force = Boolean(options.force) || process.env.PROJECTPLANER_PRESETS_FORCE === "1";
  const only = options.only?.length ? new Set(options.only) : null;

  const seeded: string[] = [];
  const skipped: string[] = [];
  const reseeded: string[] = [];
  const warnings: string[] = [];

  const presets = listWorkflowPresets().filter((preset) => !only || only.has(preset.presetKey));

  for (const preset of presets) {
    const parsed = parseWorkflowGraph(preset.graph);
    if (!parsed.ok) {
      warnings.push(`Preset ${preset.presetKey} invalid: ${parsed.errors.join("; ")}`);
      continue;
    }

    const existing = findFlowByPresetKey(db, projectKey, preset.presetKey);
    const targetId = await findSupportsTargetId(db, projectKey, preset.supportsTargetSlug, warnings);

    if (!existing) {
      const created = await entities.create(db, {
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

      persist.saveGraph(db, {
        workflowId: created.entity.id,
        projectId: created.entity.projectId,
        graph: parsed.graph
      });

      const metadata = {
        ...presetMetadata(preset, false),
        graph: graphSnapshot(parsed.graph)
      };
      await entities.update(db, {
        id: created.entity.id,
        patch: { metadata }
      });

      seeded.push(preset.presetKey);
      continue;
    }

    if (!force) {
      await syncPresetCatalogFields(db, existing, preset, targetId);
      skipped.push(preset.presetKey);
      continue;
    }

    if (existing.metadata.presetDirty === true) {
      warnings.push(
        `Force-reseeding dirty preset ${preset.presetKey} (local edits will be overwritten).`
      );
    }

    persist.saveGraph(db, {
      workflowId: existing.id,
      projectId: existing.projectId,
      graph: parsed.graph
    });

    await entities.update(db, {
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
  }

  return { seeded, skipped, reseeded, warnings };
}

/** Mark a preset-backed flow dirty after human/bot edit. */
export async function markWorkflowPresetDirty(db: DatabaseSync, flowId: string): Promise<void> {
  const entity = await entities.get(db, flowId);
  if (!entity || entity.type !== "flow") {
    return;
  }
  if (typeof entity.metadata.presetKey !== "string") {
    return;
  }
  if (entity.metadata.presetDirty === true) {
    return;
  }
  await entities.update(db, {
    id: flowId,
    patch: {
      metadata: {
        ...entity.metadata,
        presetDirty: true
      }
    }
  });
}
