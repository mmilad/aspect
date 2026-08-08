import { NextResponse } from "next/server";
import type { Entity, EntityRelation } from "@projectplaner/core";
import { listRelations } from "@projectplaner/db";
import { createWebPlanApi, withDb } from "../../../../lib/plan-api";

function parseLimit(value: string | null, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    return fallback;
  }
  return Math.min(parsed, 50);
}

function parseDepth(value: string | null, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    return fallback;
  }
  return Math.min(parsed, 3);
}

function relatedEntityIds(seedIds: Set<string>, relations: EntityRelation[], depth: number): Set<string> {
  const ids = new Set(seedIds);
  let frontier = new Set(seedIds);

  for (let level = 0; level < depth; level++) {
    const next = new Set<string>();
    for (const relation of relations) {
      if (frontier.has(relation.sourceEntityId) && !ids.has(relation.targetEntityId)) {
        ids.add(relation.targetEntityId);
        next.add(relation.targetEntityId);
      }
      if (frontier.has(relation.targetEntityId) && !ids.has(relation.sourceEntityId)) {
        ids.add(relation.sourceEntityId);
        next.add(relation.sourceEntityId);
      }
    }
    frontier = next;
    if (frontier.size === 0) {
      break;
    }
  }

  return ids;
}

function isOrientationPacket(entity: Entity): boolean {
  return entity.type === "reference" && (entity.metadata.kind === "orientation_packet" || typeof entity.metadata.workflow === "string");
}

function taskPriority(entity: Entity): string {
  return typeof entity.metadata.priority === "string" ? entity.metadata.priority : "medium";
}

function truncate(value: string, max = 240): string {
  const trimmed = value.trim();
  if (trimmed.length <= max) {
    return trimmed;
  }
  return `${trimmed.slice(0, max - 1)}…`;
}

function describeEntity(entity: Pick<Entity, "summary" | "body">): string {
  return truncate(entity.summary || entity.body || "");
}

function asEntity(item: unknown): Entity | null {
  if (!item || typeof item !== "object") {
    return null;
  }
  if (!("projectId" in item) || !("body" in item)) {
    return null;
  }
  return item as Entity;
}

function compactEntity(entity: Entity) {
  return {
    id: entity.id,
    type: entity.type,
    key: entity.key,
    title: entity.title,
    status: entity.status,
    summary: describeEntity(entity)
  };
}

function compactTask(task: Entity & { score?: number }) {
  return {
    ...compactEntity(task),
    priority: taskPriority(task),
    acceptanceCriteria: Array.isArray(task.metadata.acceptanceCriteria)
      ? task.metadata.acceptanceCriteria.filter((item): item is string => typeof item === "string")
      : []
  };
}

function compactRelation(relation: EntityRelation, byId: Map<string, Entity>) {
  return {
    id: relation.id,
    from: relation.sourceEntityId,
    fromTitle: byId.get(relation.sourceEntityId)?.title ?? relation.sourceEntityId,
    type: relation.type,
    to: relation.targetEntityId,
    toTitle: byId.get(relation.targetEntityId)?.title ?? relation.targetEntityId,
    primary: relation.isPrimary
  };
}

function compactPacket(entity: Entity) {
  const metadata = entity.metadata;
  return {
    ...compactEntity(entity),
    metadata: {
      kind: metadata.kind,
      workflow: metadata.workflow,
      state: metadata.state,
      next: metadata.next,
      confidence: metadata.confidence,
      targetIds: metadata.targetIds,
      updatedAt: metadata.updatedAt
    }
  };
}

function compactEntityDetailFull(entity: Entity) {
  return {
    ...compactEntity(entity),
    body: truncate(entity.body, 2000),
    metadata:
      entity.type === "task"
        ? {
            priority: taskPriority(entity),
            acceptanceCriteria: Array.isArray(entity.metadata.acceptanceCriteria)
              ? entity.metadata.acceptanceCriteria.filter((item): item is string => typeof item === "string")
              : [],
            disabled: entity.metadata.disabled === true ? true : undefined
          }
        : undefined
  };
}

function bulletList(values: string[]): string {
  return values.length > 0 ? values.map((value) => `- ${value}`).join("\n") : "- none";
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const projectKey = url.searchParams.get("projectKey") ?? "PLAN";
  const query = url.searchParams.get("query")?.trim() ?? "";
  const entityId = url.searchParams.get("entityId")?.trim() ?? "";
  const limit = parseLimit(url.searchParams.get("limit"), 10);
  const depth = parseDepth(url.searchParams.get("depth"), 1);
  const detail = url.searchParams.get("detail") === "full" ? "full" : "compact";
  const format = url.searchParams.get("format") === "prompt" ? "prompt" : "json";

  try {
    return await withDb(async (db) => {
      const api = createWebPlanApi(db);
      const relations = await listRelations(db, { projectKey });

      const search = query
        ? await api.entities.search({ projectKey, q: query, limit, select: "full" })
        : { items: [] as Array<Entity & { score: number }> };

      const searchEntities = search.items
        .map((item) => {
          const entity = asEntity(item);
          return entity ? { entity, score: item.score } : null;
        })
        .filter((item): item is { entity: Entity; score: number } => Boolean(item));

      const directTarget = entityId ? asEntity(await api.entities.get(entityId, { select: "full" })) : null;
      const target = directTarget ?? searchEntities[0]?.entity ?? null;

      const seeds = new Set<string>();
      if (directTarget) {
        seeds.add(directTarget.id);
      }
      for (const match of searchEntities.slice(0, Math.min(3, limit))) {
        seeds.add(match.entity.id);
      }

      if (seeds.size === 0) {
        const project = asEntity(
          (
            await api.entities.list({
              projectKey,
              where: { field: "type", op: "eq", value: "project" },
              limit: 1,
              select: "full"
            })
          ).items[0]
        );
        if (project) {
          seeds.add(project.id);
        }
      }

      const primarySeed = directTarget?.id ?? [...seeds][0];
      const nextWork = await api.tasks.nextWork({
        projectKey,
        relatedTo: primarySeed ? { id: primarySeed } : undefined,
        limit: Math.max(limit * 3, limit),
        select: "full"
      });

      const openTasks = nextWork.items
        .map((item) => asEntity(item))
        .filter((task): task is Entity => Boolean(task))
        .filter(
          (task) =>
            seeds.size === 0 ||
            seeds.has(task.id) ||
            relations.some((relation) => relation.sourceEntityId === task.id && seeds.has(relation.targetEntityId))
        )
        .slice(0, limit);

      const neighborhoodIds = relatedEntityIds(seeds, relations, depth);
      const neighborhoodEntities = (
        await Promise.all([...neighborhoodIds].map((id) => api.entities.get(id, { select: "full" })))
      )
        .map(asEntity)
        .filter((entity): entity is Entity => Boolean(entity));

      const byId = new Map(neighborhoodEntities.map((entity) => [entity.id, entity]));
      for (const task of openTasks) {
        byId.set(task.id, task);
      }
      if (target) {
        byId.set(target.id, target);
      }

      const neighborhoodRelations = relations.filter(
        (relation) => neighborhoodIds.has(relation.sourceEntityId) && neighborhoodIds.has(relation.targetEntityId)
      );
      const orientationPackets = neighborhoodEntities.filter(isOrientationPacket);
      const projectEntity = [...byId.values()].find((entity) => entity.type === "project");

      const productRules = [
        "Graph is the primary navigation surface.",
        "Aspects are meaning anchors.",
        "Features and tasks are first-class entities.",
        "Every task must link to at least one Aspect or Feature.",
        "Use depends_on for structural dependencies and blocked_by for temporary execution blockers.",
        "Agents should orient through the graph before broad code reading and leave linked context after work."
      ];
      const workflow = [
        "Read product rules and target first.",
        "Use matches and relations to select the smallest truthful Aspect or Feature anchor.",
        "Inspect detailed entities only when the compact packet is insufficient.",
        "Record new tasks, questions, decisions, or references as linked graph entities."
      ];

      const compactResponse = {
        project: projectEntity
          ? { key: projectEntity.key, title: projectEntity.title }
          : { key: projectKey },
        retrieval: {
          mode: query ? "relevance" : "filter",
          query,
          entityId,
          detail,
          format,
          next: "Use detail=full only when you need raw entity metadata. Embeddings can later back this same contract."
        },
        product: {
          purpose: "Local graph-first planning for software projects.",
          rules: productRules
        },
        target: target ? compactEntity(target) : null,
        matches: searchEntities.slice(0, limit).map((match) => ({
          score: match.score,
          ...compactEntity(match.entity)
        })),
        relations: neighborhoodRelations.slice(0, limit).map((relation) => compactRelation(relation, byId)),
        openTasks: openTasks.map(compactTask),
        orientationPackets: orientationPackets.map(compactPacket),
        workflow
      };

      if (format === "prompt") {
        const lines = [
          `Project: ${compactResponse.project.key} ${compactResponse.project.title ?? ""}`.trim(),
          `Retrieval: ${compactResponse.retrieval.mode}; query="${query || "none"}"; detail=${detail}`,
          "",
          "Product rules:",
          bulletList(productRules),
          "",
          "Target:",
          target ? `- ${target.type} ${target.id}${target.key ? ` ${target.key}` : ""}: ${target.title} [${target.status}]` : "- none",
          target && describeEntity(target) ? `  ${describeEntity(target)}` : "",
          "",
          "Matches:",
          bulletList(compactResponse.matches.map((match) => `${match.score} ${match.type} ${match.id}: ${match.title} [${match.status}]`)),
          "",
          "Relations:",
          bulletList(compactResponse.relations.map((relation) => `${relation.fromTitle} -[${relation.type}]-> ${relation.toTitle}`)),
          "",
          "Open tasks:",
          bulletList(compactResponse.openTasks.map((task) => `${task.key ?? task.id}: ${task.title} [${task.status}/${task.priority}]`)),
          "",
          "Workflow:",
          bulletList(workflow)
        ].filter((line) => line !== "");

        return new Response(`${lines.join("\n")}\n`, {
          headers: { "content-type": "text/plain; charset=utf-8" }
        });
      }

      if (detail === "compact") {
        return NextResponse.json(compactResponse);
      }

      return NextResponse.json({
        ...compactResponse,
        retrieval: {
          ...compactResponse.retrieval,
          limit,
          depth,
          future: "Embeddings can replace or supplement fuzzy ranking while preserving this response shape."
        },
        target: target ? compactEntityDetailFull(target) : null,
        neighborhood: {
          entities: neighborhoodEntities.filter((entity) => !isOrientationPacket(entity)).map(compactEntity),
          relations: neighborhoodRelations.map((relation) => compactRelation(relation, byId))
        },
        orientationPackets: orientationPackets.map(compactPacket)
      });
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not build agent context." }, { status: 400 });
  }
}
