import type { DatabaseSync } from "node:sqlite";
import type { Entity, EntityRelationType, EntityType, JsonRecord, TaskPriority } from "@projectplaner/core";
import { createEntity, getEntity } from "../repositories/entities";
import { createRelation } from "../repositories/relations";
import { rollupParentStatus } from "../rollup";

type EntityOfType<T extends EntityType> = Entity & { type: T };
type PlanningTargetType = "aspect" | "feature";

export type SemanticEntityInput = {
  title: string;
  key?: string | null;
  slug?: string;
  summary?: string;
  body?: string;
  metadata?: JsonRecord;
};

export type CreateAspectInput = SemanticEntityInput & {
  parentId?: string;
};

export type CreateFeatureInput = SemanticEntityInput & {
  parentId: string;
  acceptanceShape?: string;
};

export type CreateSemanticTaskInput = SemanticEntityInput & {
  targetId: string;
  priority?: TaskPriority;
  acceptanceCriteria?: string[];
  linkType?: Extract<EntityRelationType, "affects" | "implements" | "validates" | "investigates">;
};

export class Api {
  constructor(private readonly db: DatabaseSync) {}

  getProject(projectKey: string): ProjectApi {
    return new ProjectApi(this.db, projectKey);
  }
}

export class ProjectApi {
  constructor(
    private readonly db: DatabaseSync,
    readonly projectKey: string
  ) {}

  aspect(id: string): AspectHandle {
    return new AspectHandle(this, id);
  }

  feature(id: string): FeatureHandle {
    return new FeatureHandle(this, id);
  }

  task(id: string): TaskHandle {
    return new TaskHandle(this, id);
  }

  async createAspect(input: CreateAspectInput): Promise<AspectHandle> {
    const parent = input.parentId ? await this.requireEntity(input.parentId, ["aspect", "project"]) : null;
    const created = await createEntity(this.db, {
      projectKey: this.projectKey,
      type: "aspect",
      title: input.title,
      key: input.key,
      slug: input.slug,
      summary: input.summary,
      body: input.body,
      metadata: input.metadata,
      skipRollup: Boolean(parent)
    });

    if (parent) {
      await createRelation(this.db, {
        projectKey: this.projectKey,
        sourceEntityId: parent.id,
        targetEntityId: created.entity.id,
        type: "contains",
        isPrimary: true
      });
      await rollupParentStatus(this.db, created.entity.id, { projectKey: this.projectKey });
    }

    return new AspectHandle(this, created.entity.id, created.entity as EntityOfType<"aspect">);
  }

  async createFeature(input: CreateFeatureInput): Promise<FeatureHandle> {
    const parent = await this.requireEntity(input.parentId, ["aspect", "feature"]);
    const metadata = {
      ...(input.metadata ?? {}),
      ...(input.acceptanceShape ? { acceptanceShape: input.acceptanceShape } : {})
    };
    const created = await createEntity(this.db, {
      projectKey: this.projectKey,
      type: "feature",
      title: input.title,
      key: input.key,
      slug: input.slug,
      summary: input.summary,
      body: input.body,
      metadata,
      skipRollup: true
    });
    await createRelation(this.db, {
      projectKey: this.projectKey,
      sourceEntityId: parent.id,
      targetEntityId: created.entity.id,
      type: "contains",
      isPrimary: true
    });
    await rollupParentStatus(this.db, created.entity.id, { projectKey: this.projectKey });
    return new FeatureHandle(this, created.entity.id, created.entity as EntityOfType<"feature">);
  }

  async createTask(input: CreateSemanticTaskInput): Promise<TaskHandle> {
    const target = await this.requireEntity(input.targetId, ["aspect", "feature"]);
    const linkType = input.linkType ?? (target.type === "feature" ? "implements" : "affects");
    const created = await createEntity(this.db, {
      projectKey: this.projectKey,
      type: "task",
      title: input.title,
      key: input.key,
      slug: input.slug,
      summary: input.summary,
      body: input.body ?? input.summary,
      metadata: {
        ...(input.metadata ?? {}),
        priority: input.priority ?? "medium",
        acceptanceCriteria: input.acceptanceCriteria ?? []
      },
      relations: [{ targetEntityId: target.id, type: linkType, isPrimary: true }]
    });
    return new TaskHandle(this, created.entity.id, created.entity as EntityOfType<"task">);
  }

  async requireEntity<T extends EntityType>(id: string, allowed: T[]): Promise<EntityOfType<T>> {
    const entity = await getEntity(this.db, id);
    if (!entity || !allowed.includes(entity.type as T)) {
      throw new Error(`Expected ${allowed.join(" or ")} entity: ${id}`);
    }
    return entity as EntityOfType<T>;
  }
}

export class AspectHandle {
  readonly id: string;

  constructor(
    protected readonly project: ProjectApi,
    id: string,
    readonly entity?: EntityOfType<"aspect">
  ) {
    this.id = id;
  }

  get parent(): ProjectApi {
    return this.project;
  }

  createFeature(input: Omit<CreateFeatureInput, "parentId">): Promise<FeatureHandle> {
    return this.project.createFeature({ ...input, parentId: this.id });
  }

  createTask(input: Omit<CreateSemanticTaskInput, "targetId">): Promise<TaskHandle> {
    return this.project.createTask({ ...input, targetId: this.id });
  }
}

export class FeatureHandle {
  readonly id: string;

  constructor(
    protected readonly project: ProjectApi,
    id: string,
    readonly entity?: EntityOfType<"feature">
  ) {
    this.id = id;
  }

  get parent(): ProjectApi {
    return this.project;
  }

  createFeature(input: Omit<CreateFeatureInput, "parentId">): Promise<FeatureHandle> {
    return this.project.createFeature({ ...input, parentId: this.id });
  }

  createTask(input: Omit<CreateSemanticTaskInput, "targetId">): Promise<TaskHandle> {
    return this.project.createTask({ ...input, targetId: this.id });
  }
}

export class TaskHandle {
  readonly id: string;

  constructor(
    readonly project: ProjectApi,
    id: string,
    readonly entity?: EntityOfType<"task">
  ) {
    this.id = id;
  }
}
