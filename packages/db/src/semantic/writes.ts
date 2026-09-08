import type { DatabaseOperations } from "../services";
import type { Entity, EntityRelationType, EntityType, JsonRecord, TaskPriority } from "@projectplaner/core";


type EntityOfType<T extends EntityType> = Entity & { type: T };

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

export class SemanticWrites {
  constructor(private readonly db: Pick<DatabaseOperations, "entities" | "semantic">) {}

  project(projectKey: string): ProjectWrites {
    return new ProjectWrites(this.db, projectKey);
  }
}

export class ProjectWrites {
  constructor(
    private readonly db: Pick<DatabaseOperations, "entities" | "semantic">,
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
 const entity = await this.db.semantic.createAspect(this.projectKey, input);
 return new AspectHandle(this, entity.id, entity);
}

  async createFeature(input: CreateFeatureInput): Promise<FeatureHandle> {
 const entity = await this.db.semantic.createFeature(this.projectKey, input);
 return new FeatureHandle(this, entity.id, entity);
}

  async createTask(input: CreateSemanticTaskInput): Promise<TaskHandle> {
 const entity = await this.db.semantic.createTask(this.projectKey, input);
 return new TaskHandle(this, entity.id, entity);
}

  async requireEntity<T extends EntityType>(id: string, allowed: T[]): Promise<EntityOfType<T>> {
    const entity = await this.db.entities.get(id);
    if (!entity || !allowed.includes(entity.type as T)) {
      throw new Error(`Expected ${allowed.join(" or ")} entity: ${id}`);
    }
    return entity as EntityOfType<T>;
  }
}

export class AspectHandle {
  readonly id: string;

  constructor(
    protected readonly project: ProjectWrites,
    id: string,
    readonly entity?: EntityOfType<"aspect">
  ) {
    this.id = id;
  }

  get parent(): ProjectWrites {
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
    protected readonly project: ProjectWrites,
    id: string,
    readonly entity?: EntityOfType<"feature">
  ) {
    this.id = id;
  }

  get parent(): ProjectWrites {
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
    readonly project: ProjectWrites,
    id: string,
    readonly entity?: EntityOfType<"task">
  ) {
    this.id = id;
  }
}
