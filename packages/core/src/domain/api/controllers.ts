import { compactEntity, workScore } from "../task-candidacy";
import { getNarrative } from "../narrative";
import { rankedByQuery, relevanceSearchValues } from "../search";
import type { Entity, EntityRelation, EntityRelationType, EntityType, TaskPriority } from "../types";
import { compileListQuery } from "../query/compile";
import type {
  CompactEntityView,
  EntityFilter,
  EntityListQuery,
  EntitySearchQuery,
  EntitySelectMode,
  ListMeta,
  ListResult,
  RankedListResult,
  RelatedToSugar,
  TaskListQuery,
  TaskNextWorkQuery
} from "../query/types";
import type { EntityStore } from "./store";

export const TASK_LINK_TYPES: EntityRelationType[] = ["affects", "implements", "validates", "investigates"];

export type EntityOfType<T extends EntityType> = Entity & { type: T };

export type EntityView<T extends EntityType = EntityType> = (CompactEntityView & { type: T }) | EntityOfType<T>;

function isOrientationPacket(entity: Entity): boolean {
  return (
    entity.type === "reference" &&
    (entity.metadata.kind === "orientation_packet" || typeof entity.metadata.workflow === "string")
  );
}

function projectEntity<T extends EntityType>(
  entity: Entity,
  select: EntitySelectMode,
  includeNarrative = false
): EntityView<T> {
  if (select === "full") {
    return entity as EntityOfType<T>;
  }
  const compact = compactEntity(entity) as CompactEntityView & { type: T };
  if (includeNarrative) {
    compact.narrative = getNarrative(entity);
  }
  return compact;
}

function listMeta(input: {
  projectKey: string;
  select: EntitySelectMode;
  mode: ListMeta["mode"];
  applied: EntityFilter | null;
  query?: string;
  limit?: number;
  offset?: number;
}): ListMeta {
  return {
    projectKey: input.projectKey,
    select: input.select,
    mode: input.mode,
    applied: input.applied,
    query: input.query,
    limit: input.limit,
    offset: input.offset
  };
}

export function expandTaskListQuery(query: TaskListQuery = {}): EntityListQuery {
  const parts: NonNullable<EntityListQuery["where"]>[] = [];

  if (query.unblocked) {
    parts.push({ pred: "unblocked" });
  }

  if (query.relatedTo) {
    const relatedTo: RelatedToSugar = query.relatedTo;
    parts.push({
      rel: {
        direction: relatedTo.direction ?? "out",
        types: relatedTo.types ?? TASK_LINK_TYPES,
        some: { field: "id", op: "eq", value: relatedTo.id }
      }
    });
  }

  if (query.priority !== undefined) {
    const priority = query.priority;
    if (Array.isArray(priority)) {
      parts.push({ field: "metadata.priority", op: "in", value: priority });
    } else {
      parts.push({ field: "metadata.priority", op: "eq", value: priority });
    }
  }

  if (query.where) {
    parts.push(query.where);
  }

  const { unblocked: _u, relatedTo: _r, priority: _p, ...rest } = query;
  return {
    ...rest,
    where: parts.length === 0 ? undefined : parts.length === 1 ? parts[0] : { and: parts }
  };
}

/**
 * Typed entity reader. Pass a type to scope get/list; omit type for any-entity queries.
 */
export class EntityController<T extends EntityType = EntityType> {
  constructor(
    protected readonly store: EntityStore,
    protected readonly type?: T
  ) {}

  async get(
    id: string,
    opts?: { select?: EntitySelectMode; includeNarrative?: boolean }
  ): Promise<EntityView<T> | null> {
    const entity = await this.store.getById(id);
    if (!entity) {
      return null;
    }
    if (this.type !== undefined && entity.type !== this.type) {
      return null;
    }
    return projectEntity<T>(entity, opts?.select ?? "compact", opts?.includeNarrative === true);
  }

  async list(query: EntityListQuery = {}): Promise<ListResult<EntityView<T>>> {
    const plan = compileListQuery(query, this.type !== undefined ? { type: this.type } : undefined);
    const rows = await this.store.execute(plan);
    return {
      items: rows.map((entity) => projectEntity<T>(entity, plan.select, query.includeNarrative === true)),
      meta: listMeta({
        projectKey: plan.projectKey,
        select: plan.select,
        mode: "filter",
        applied: plan.applied,
        limit: plan.limit,
        offset: plan.offset
      })
    };
  }

  async search(query: EntitySearchQuery): Promise<RankedListResult<EntityView<T>>> {
    const q = query.q.trim();
    const projectKey = query.projectKey ?? "PLAN";
    const select = query.select ?? "compact";
    const excludePackets = query.excludeOrientationPackets !== false;

    const plan = compileListQuery(
      {
        projectKey,
        where: query.where,
        select: "full",
        includeArchived: query.includeArchived
      },
      this.type !== undefined ? { type: this.type } : undefined
    );
    // Search ranks in memory after filter; do not apply list limit before scoring.
    const poolPlan = { ...plan, limit: undefined, offset: undefined };
    let pool = await this.store.execute(poolPlan);
    if (excludePackets) {
      pool = pool.filter((entity) => !isOrientationPacket(entity));
    }

    const ranked = q
      ? rankedByQuery(pool, q, relevanceSearchValues)
      : pool.map((item) => ({ item, score: 0 }));
    const limited = typeof query.limit === "number" ? ranked.slice(0, query.limit) : ranked;

    return {
      items: limited.map((match) => ({
        ...projectEntity<T>(match.item, select, query.includeNarrative === true),
        score: match.score
      })),
      meta: listMeta({
        projectKey,
        select,
        mode: "relevance",
        applied: plan.applied,
        query: q || undefined,
        limit: query.limit
      })
    };
  }
}

/** Task controller adds list sugar + nextWork candidacy ranking. */
export class TaskController extends EntityController<"task"> {
  constructor(store: EntityStore) {
    super(store, "task");
  }

  override async list(query: TaskListQuery = {}): Promise<ListResult<EntityView<"task">>> {
    return super.list(expandTaskListQuery(query));
  }

  async nextWork(query: TaskNextWorkQuery = {}): Promise<RankedListResult<EntityView<"task">>> {
    const projectKey = query.projectKey ?? "PLAN";
    const select = query.select ?? "compact";
    const listQuery = expandTaskListQuery({
      projectKey,
      relatedTo: query.relatedTo,
      where: { pred: "task_candidate" },
      select: "full",
      includeArchived: query.includeArchived
    });
    const plan = compileListQuery(listQuery, { type: "task" });
    const poolPlan = { ...plan, limit: undefined, offset: undefined };
    const candidates = await this.store.execute(poolPlan);
    const relations = await this.store.listRelations(projectKey);

    const ranked = candidates
      .map((task) => ({
        task,
        score: workScore(task, relations)
      }))
      .sort((a, b) => {
        if (b.score !== a.score) {
          return b.score - a.score;
        }
        const keyA = a.task.key ?? "";
        const keyB = b.task.key ?? "";
        if (keyA !== keyB) {
          return keyA.localeCompare(keyB);
        }
        return a.task.id.localeCompare(b.task.id);
      });

    const limited = typeof query.limit === "number" ? ranked.slice(0, query.limit) : ranked;

    return {
      items: limited.map((item) => ({
        ...projectEntity<"task">(item.task, select, query.includeNarrative === true),
        score: item.score
      })),
      meta: listMeta({
        projectKey,
        select,
        mode: "work",
        applied: plan.applied,
        limit: query.limit
      })
    };
  }
}

export class PlanApi {
  readonly entities: EntityController;
  readonly tasks: TaskController;
  readonly aspects: EntityController<"aspect">;
  readonly features: EntityController<"feature">;
  readonly references: EntityController<"reference">;
  readonly decisions: EntityController<"decision">;
  readonly questions: EntityController<"question">;
  readonly flows: EntityController<"flow">;

  constructor(store: EntityStore) {
    this.entities = new EntityController(store);
    this.tasks = new TaskController(store);
    this.aspects = new EntityController(store, "aspect");
    this.features = new EntityController(store, "feature");
    this.references = new EntityController(store, "reference");
    this.decisions = new EntityController(store, "decision");
    this.questions = new EntityController(store, "question");
    this.flows = new EntityController(store, "flow");
  }
}

export function createPlanApi(store: EntityStore): PlanApi {
  return new PlanApi(store);
}

export type { TaskPriority };
