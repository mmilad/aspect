import { relations as drizzleRelations, sql } from "drizzle-orm";
import { integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const projects = sqliteTable("projects", {
  id: text("id").primaryKey(),
  key: text("key").notNull().unique(),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`)
});

export const nodes = sqliteTable(
  "nodes",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    parentId: text("parent_id"),
    type: text("type").notNull(),
    slug: text("slug").notNull(),
    path: text("path").notNull(),
    title: text("title").notNull(),
    summary: text("summary").notNull().default(""),
    body: text("body").notNull().default(""),
    status: text("status").notNull().default("planned"),
    sortOrder: integer("sort_order").notNull().default(0),
    metadataJson: text("metadata_json").notNull().default("{}"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`)
  },
  (table) => ({
    projectPath: uniqueIndex("nodes_project_path_idx").on(table.projectId, table.path),
    siblingSlug: uniqueIndex("nodes_sibling_slug_idx").on(table.projectId, table.parentId, table.slug)
  })
);

export const projectRelations = sqliteTable("relations", {
  id: text("id").primaryKey(),
  projectId: text("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  sourceNodeId: text("source_node_id")
    .notNull()
    .references(() => nodes.id, { onDelete: "cascade" }),
  targetNodeId: text("target_node_id")
    .notNull()
    .references(() => nodes.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  label: text("label"),
  metadataJson: text("metadata_json").notNull().default("{}"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`)
});

export const draftPlans = sqliteTable("draft_plans", {
  id: text("id").primaryKey(),
  projectId: text("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  scopeNodeId: text("scope_node_id").references(() => nodes.id, { onDelete: "set null" }),
  hypothesis: text("hypothesis").notNull().default(""),
  status: text("status").notNull().default("draft"),
  metadataJson: text("metadata_json").notNull().default("{}"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`)
});

export const draftChanges = sqliteTable("draft_changes", {
  id: text("id").primaryKey(),
  draftPlanId: text("draft_plan_id")
    .notNull()
    .references(() => draftPlans.id, { onDelete: "cascade" }),
  changeType: text("change_type").notNull(),
  targetType: text("target_type").notNull(),
  targetId: text("target_id"),
  payloadJson: text("payload_json").notNull().default("{}")
});

export const nodeTasks = sqliteTable("node_tasks", {
  id: text("id").primaryKey(),
  nodeId: text("node_id")
    .notNull()
    .references(() => nodes.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  status: text("status").notNull().default("todo"),
  acceptanceCriteriaJson: text("acceptance_criteria_json").notNull().default("[]"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`)
});

export const features = sqliteTable("features", {
  id: text("id").primaryKey(),
  projectId: text("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  parentFeatureId: text("parent_feature_id"),
  key: text("key").notNull(),
  slug: text("slug").notNull(),
  title: text("title").notNull(),
  summary: text("summary").notNull().default(""),
  body: text("body").notNull().default(""),
  status: text("status").notNull().default("planned"),
  acceptanceShape: text("acceptance_shape").notNull().default(""),
  sortOrder: integer("sort_order").notNull().default(0),
  metadataJson: text("metadata_json").notNull().default("{}"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`)
});

export const featureAspectLinks = sqliteTable("feature_aspect_links", {
  id: text("id").primaryKey(),
  featureId: text("feature_id").notNull(),
  aspectId: text("aspect_id").notNull(),
  type: text("type").notNull(),
  isPrimary: integer("is_primary").notNull().default(0)
});

export const tasks = sqliteTable("tasks", {
  id: text("id").primaryKey(),
  projectId: text("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  key: text("key").notNull(),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  status: text("status").notNull().default("todo"),
  priority: text("priority").notNull().default("medium"),
  acceptanceCriteriaJson: text("acceptance_criteria_json").notNull().default("[]"),
  sortOrder: integer("sort_order").notNull().default(0),
  metadataJson: text("metadata_json").notNull().default("{}"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`)
});

export const taskLinks = sqliteTable("task_links", {
  id: text("id").primaryKey(),
  taskId: text("task_id").notNull(),
  targetType: text("target_type").notNull(),
  targetId: text("target_id").notNull(),
  type: text("type").notNull(),
  isPrimary: integer("is_primary").notNull().default(0)
});

export const entityRelations = sqliteTable("entity_relations", {
  id: text("id").primaryKey(),
  projectId: text("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  sourceType: text("source_type").notNull(),
  sourceId: text("source_id").notNull(),
  targetType: text("target_type").notNull(),
  targetId: text("target_id").notNull(),
  type: text("type").notNull(),
  label: text("label"),
  metadataJson: text("metadata_json").notNull().default("{}"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`)
});

export const tags = sqliteTable("tags", {
  id: text("id").primaryKey(),
  projectId: text("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  slug: text("slug").notNull(),
  label: text("label").notNull(),
  kind: text("kind").notNull().default("custom")
});

export const tagAssignments = sqliteTable("tag_assignments", {
  id: text("id").primaryKey(),
  tagId: text("tag_id").notNull(),
  targetType: text("target_type").notNull(),
  targetId: text("target_id").notNull()
});

export const entities = sqliteTable(
  "entities",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    key: text("key"),
    slug: text("slug").notNull(),
    title: text("title").notNull(),
    summary: text("summary").notNull().default(""),
    body: text("body").notNull().default(""),
    status: text("status").notNull().default("planned"),
    sortOrder: integer("sort_order").notNull().default(0),
    metadataJson: text("metadata_json").notNull().default("{}"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`)
  },
  (table) => ({
    projectType: uniqueIndex("entities_project_slug_idx").on(table.projectId, table.type, table.slug)
  })
);

export const entityRelationsV2 = sqliteTable("entity_relations_v2", {
  id: text("id").primaryKey(),
  projectId: text("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  sourceEntityId: text("source_entity_id")
    .notNull()
    .references(() => entities.id, { onDelete: "cascade" }),
  targetEntityId: text("target_entity_id")
    .notNull()
    .references(() => entities.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  label: text("label"),
  isPrimary: integer("is_primary").notNull().default(0),
  metadataJson: text("metadata_json").notNull().default("{}"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`)
});

export const entityTagAssignments = sqliteTable("entity_tag_assignments", {
  id: text("id").primaryKey(),
  tagId: text("tag_id")
    .notNull()
    .references(() => tags.id, { onDelete: "cascade" }),
  entityId: text("entity_id")
    .notNull()
    .references(() => entities.id, { onDelete: "cascade" })
});

export const projectRelationsMap = drizzleRelations(projects, ({ many }) => ({
  nodes: many(nodes),
  draftPlans: many(draftPlans)
}));

export const nodeRelationsMap = drizzleRelations(nodes, ({ one, many }) => ({
  project: one(projects, { fields: [nodes.projectId], references: [projects.id] }),
  tasks: many(nodeTasks)
}));
