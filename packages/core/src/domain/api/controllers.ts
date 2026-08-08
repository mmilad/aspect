import { compactEntity } from "../task-candidacy";
import type { Entity, EntityRelationType, EntityType, TaskPriority } from "../types";
import { compileListQuery } from "../query/compile";
import type {
  CompactEntityView,
  EntityListQuery,
  EntitySelectMode,
  ListResult,
  RelatedToSugar,
  TaskListQuery
} from "../query/types";
import type { EntityStore } from "./store";

export const TASK_LINK_TYPES: EntityRelationType[] = ["affects", "implements", "validates", "investigates"];

export type EntityOfType<T extends EntityType> = Entity & { type: T };

export type EntityView<T extends EntityType = EntityType> = (CompactEntityView & { type: T }) | EntityOfType<T>;

function projectEntity<T extends EntityType>(entity: Entity, select: EntitySelectMode): EntityView<T> {
  if (select === "full") {
    return entity as EntityOfType<T>;
  }
  return compactEntity(entity) as CompactEntityView & { type: T };
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

  async get(id: string, opts?: { select?: EntitySelectMode }): Promise<EntityView<T> | null> {
    const entity = await this.store.getById(id);
    if (!entity) {
      return null;
    }
    if (this.type !== undefined && entity.type !== this.type) {
      return null;
    }
    return projectEntity<T>(entity, opts?.select ?? "compact");
  }

  async list(query: EntityListQuery = {}): Promise<ListResult<EntityView<T>>> {
    const plan = compileListQuery(query, this.type !== undefined ? { type: this.type } : undefined);
    const rows = await this.store.execute(plan);
    return {
      items: rows.map((entity) => projectEntity<T>(entity, plan.select))
    };
  }
}

/** Task controller adds list sugar (`unblocked`, `relatedTo`, `priority`). */
export class TaskController extends EntityController<"task"> {
  constructor(store: EntityStore) {
    super(store, "task");
  }

  override async list(query: TaskListQuery = {}): Promise<ListResult<EntityView<"task">>> {
    return super.list(expandTaskListQuery(query));
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
