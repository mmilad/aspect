import { getOpenWorkBelowAspect, getPrimaryTaskLink, getTasksForFeature } from "@projectplaner/core";
import type { EntityRelationType, EntityStatus, EntityType, JsonRecord, ProjectPlanSnapshot, TaskLinkType, TaskPriority } from "@projectplaner/core";
import fs from "node:fs/promises";
import { createDatabase } from "./client";
import {
  createEntity,
  createRelation,
  createTask,
  exportGenericPlan,
  getEntity,
  importGenericPlan,
  listEntities,
  listRelations,
  seedSelfPlanningProject,
  updateEntity
} from "./repository";

type ParsedArgs = {
  positionals: string[];
  options: Record<string, string[]>;
};

const priorities = new Set<TaskPriority>(["low", "medium", "high", "critical"]);
const linkTypes = new Set<TaskLinkType>(["affects", "implements", "validates", "investigates"]);
const entityTypes = new Set<EntityType>([
  "project",
  "aspect",
  "entry",
  "area",
  "surface",
  "feature",
  "flow",
  "decision",
  "question",
  "reference",
  "task_group",
  "task"
]);
const relationTypes = new Set<EntityRelationType>([
  "contains",
  "leads_to",
  "depends_on",
  "blocks",
  "implements",
  "affects",
  "answers",
  "references",
  "conflicts_with",
  "validates",
  "investigates",
  "blocked_by",
  "related_to",
  "supports",
  "motivates"
]);

function parseArgs(argv: string[]): ParsedArgs {
  const positionals: string[] = [];
  const options: Record<string, string[]> = {};

  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];
    if (!arg.startsWith("--")) {
      positionals.push(arg);
      continue;
    }

    const rawOption = arg.slice(2);
    const equalsIndex = rawOption.indexOf("=");
    const rawKey = equalsIndex === -1 ? rawOption : rawOption.slice(0, equalsIndex);
    const inlineValue = equalsIndex === -1 ? undefined : rawOption.slice(equalsIndex + 1);
    const value = inlineValue ?? argv[index + 1];
    if (inlineValue === undefined) {
      index++;
    }

    options[rawKey] = [...(options[rawKey] ?? []), value ?? ""];
  }

  return { positionals, options };
}

function first(options: ParsedArgs["options"], key: string): string | undefined {
  return options[key]?.[0];
}

function includesQuery(values: Array<string | null | undefined>, query: string): boolean {
  const normalized = query.toLowerCase();
  return values.some((value) => value?.toLowerCase().includes(normalized));
}

function taskLabel(taskId: string, snapshot: ProjectPlanSnapshot): string {
  const task = snapshot.tasks.find((item) => item.id === taskId);
  return task ? `${task.key} ${task.title}` : taskId;
}

function entityLabel(type: string, id: string, snapshot: ProjectPlanSnapshot): string {
  if (type === "feature") {
    const feature = snapshot.features.find((item) => item.id === id);
    return feature ? `${feature.key} ${feature.title}` : id;
  }

  if (type === "task") {
    return taskLabel(id, snapshot);
  }

  const node = snapshot.nodes.find((item) => item.id === id);
  return node ? `${node.title} (${node.path})` : id;
}

function printTask(taskId: string, snapshot: ProjectPlanSnapshot): void {
  const task = snapshot.tasks.find((item) => item.id === taskId);
  if (!task) {
    return;
  }

  const primary = getPrimaryTaskLink(task, snapshot);
  const target = primary ? ` -> ${primary.type} ${entityLabel(primary.targetType, primary.targetId, snapshot)}` : "";
  console.log(`- ${task.key} [${task.status}/${task.priority}] ${task.title}${target}`);
}

function parseJsonObject(value: string, source: string): JsonRecord {
  const parsed = JSON.parse(value) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`${source} must be a JSON object.`);
  }
  return parsed as JsonRecord;
}

async function parseMetadata(options: ParsedArgs["options"]): Promise<JsonRecord> {
  const inlineValue = first(options, "metadata");
  const file = first(options, "metadata-file");

  if (inlineValue && file) {
    throw new Error("Use either --metadata or --metadata-file, not both.");
  }
  if (file) {
    return parseJsonObject(await fs.readFile(file, "utf8"), "--metadata-file");
  }
  if (!inlineValue) {
    return {};
  }
  return parseJsonObject(inlineValue, "--metadata");
}

function printOrient(snapshot: ProjectPlanSnapshot, query?: string): void {
  console.log(`${snapshot.project.key} ${snapshot.project.title}`);
  console.log(snapshot.project.description);

  if (!query) {
    const root = snapshot.nodes.find((node) => node.parentId === null);
    const rootChildren = root ? snapshot.nodes.filter((node) => node.parentId === root.id) : [];
    const openTasks = snapshot.tasks.filter((task) => task.status !== "done");

    console.log("");
    console.log("Top aspects:");
    for (const node of rootChildren) {
      console.log(`- ${node.title} (${node.id}, ${node.path}) [${node.status}]`);
    }

    console.log("");
    console.log(`Open tasks: ${openTasks.length}`);
    for (const task of openTasks.slice(0, 8)) {
      printTask(task.id, snapshot);
    }
    if (openTasks.length > 8) {
      console.log(`... ${openTasks.length - 8} more`);
    }

    console.log("");
    console.log("Use `pnpm plan orient <query>` to inspect matching entities.");
    return;
  }

  const matchingNodes = snapshot.nodes.filter((node) =>
    includesQuery([node.id, node.title, node.path, node.summary, node.body], query)
  );
  const matchingFeatures = snapshot.features.filter((feature) =>
    includesQuery([feature.id, feature.key, feature.title, feature.slug, feature.summary, feature.body], query)
  );

  console.log("");
  console.log(`Matches for "${query}":`);

  for (const node of matchingNodes) {
    const openWork = getOpenWorkBelowAspect(node.id, snapshot);
    console.log(`- ${node.type} ${node.id}: ${node.title} (${node.path}) [${node.status}]`);
    console.log(`  ${node.summary}`);
    console.log(`  open work below: ${openWork.length}`);
    for (const task of openWork.slice(0, 5)) {
      console.log(`  - ${task.key} [${task.status}/${task.priority}] ${task.title}`);
    }
  }

  for (const feature of matchingFeatures) {
    const linkedAspects = snapshot.featureAspectLinks
      .filter((link) => link.featureId === feature.id)
      .map((link) => entityLabel("aspect", link.aspectId, snapshot));
    const tasks = getTasksForFeature(feature.id, snapshot, { includeNestedFeatures: true });

    console.log(`- feature ${feature.id}: ${feature.key} ${feature.title} [${feature.status}]`);
    console.log(`  ${feature.summary}`);
    console.log(`  linked aspects: ${linkedAspects.join("; ") || "none"}`);
    console.log(`  tasks: ${tasks.length}`);
    for (const task of tasks.slice(0, 5)) {
      console.log(`  - ${task.key} [${task.status}/${task.priority}] ${task.title}`);
    }
  }

  if (matchingNodes.length === 0 && matchingFeatures.length === 0) {
    console.log("No matching entities. Use `pnpm plan orient` to scan top-level context.");
  }
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const command = args.positionals[0] ?? "orient";

  if (command === "help" || command === "--help") {
    console.log("Projectplaner agent commands");
    console.log("  pnpm plan orient [query]");
    console.log("  pnpm plan add-task --title <title> --target aspect:<id>|feature:<id> [--description <text>] [--priority low|medium|high|critical] [--link affects|implements|validates|investigates] [--criteria <text>]");
    console.log("  pnpm plan create-entity --type <type> --title <title> [--target <entity-id>] [--link <relation-type>] [--metadata-file <json-file>]");
    console.log("  pnpm plan update-entity --id <entity-id> [--title <title>] [--status <status>] [--metadata '{...}'|--metadata-file <json-file>]");
    console.log("  pnpm plan get-entity --id <entity-id>");
    console.log("  pnpm plan list-entities [--type <type>] [--query <text>]");
    console.log("  pnpm plan create-relation --from <entity-id> --to <entity-id> --type <relation-type> [--primary true]");
    console.log("  pnpm plan export --out <file>");
    console.log("  pnpm plan import --from <file>");
    return;
  }

  const db = createDatabase();
  try {
    await seedSelfPlanningProject(db);

    if (command === "orient") {
      const snapshot = await import("./repository").then((mod) => mod.getProjectSnapshot(db, "PLAN"));
      if (!snapshot) {
        throw new Error("PLAN project is missing.");
      }
      printOrient(snapshot, args.positionals.slice(1).join(" ").trim() || undefined);
      return;
    }

    if (command === "add-task") {
      const title = first(args.options, "title");
      const target = first(args.options, "target");
      const priority = first(args.options, "priority") ?? "medium";
      const linkType = first(args.options, "link") ?? "affects";

      if (!title || !target) {
        throw new Error("add-task requires --title and --target aspect:<id>|feature:<id>.");
      }
      if (!priorities.has(priority as TaskPriority)) {
        throw new Error(`Unknown priority "${priority}".`);
      }
      if (!linkTypes.has(linkType as TaskLinkType)) {
        throw new Error(`Unknown link type "${linkType}".`);
      }

      const [targetType, targetId] = target.split(":", 2);
      if ((targetType !== "aspect" && targetType !== "feature") || !targetId) {
        throw new Error("--target must look like aspect:node_id or feature:feature_id.");
      }

      const targetEntity = await getEntity(db, targetId);
      const task =
        targetEntity && targetEntity.type === targetType
          ? (
              await createEntity(db, {
                projectKey: "PLAN",
                type: "task",
                title,
                summary: first(args.options, "description") ?? "",
                body: first(args.options, "description") ?? "",
                metadata: {
                  priority,
                  acceptanceCriteria: args.options.criteria ?? []
                },
                relations: [{ targetEntityId: targetId, type: linkType as TaskLinkType, isPrimary: true }]
              })
            ).entity
          : await createTask(db, {
              projectKey: "PLAN",
              title,
              description: first(args.options, "description") ?? "",
              priority: priority as TaskPriority,
              acceptanceCriteria: args.options.criteria ?? [],
              targetType,
              targetId,
              linkType: linkType as TaskLinkType
            });

      console.log(`Created ${task.key ?? task.id} (${task.id}).`);
      return;
    }

    if (command === "create-entity") {
      const type = first(args.options, "type") as EntityType | undefined;
      const title = first(args.options, "title");
      const target = first(args.options, "target");
      const linkType = (first(args.options, "link") ?? (type === "feature" ? "implements" : "affects")) as EntityRelationType;
      const status = first(args.options, "status") as EntityStatus | undefined;

      if (!type || !entityTypes.has(type)) {
        throw new Error("create-entity requires --type with a known entity type.");
      }
      if (!title) {
        throw new Error("create-entity requires --title.");
      }
      if (!relationTypes.has(linkType)) {
        throw new Error(`Unknown relation type "${linkType}".`);
      }

      const metadata = await parseMetadata(args.options);
      if (type === "task") {
        metadata.priority = first(args.options, "priority") ?? "medium";
        metadata.acceptanceCriteria = args.options.criteria ?? [];
      }
      if (type === "feature" && first(args.options, "acceptance")) {
        metadata.acceptanceShape = first(args.options, "acceptance");
      }

      const shouldCreateParentContainsChild = type === "aspect" && target && linkType === "contains";
      const result = await createEntity(db, {
        projectKey: "PLAN",
        type,
        title,
        key: first(args.options, "key"),
        slug: first(args.options, "slug"),
        summary: first(args.options, "summary"),
        body: first(args.options, "body") ?? first(args.options, "description"),
        status,
        metadata,
        relations: target && !shouldCreateParentContainsChild ? [{ targetEntityId: target, type: linkType, isPrimary: true }] : []
      });

      if (shouldCreateParentContainsChild) {
        await createRelation(db, {
          projectKey: "PLAN",
          sourceEntityId: target,
          targetEntityId: result.entity.id,
          type: "contains",
          isPrimary: true
        });
      }

      console.log(`Created ${result.entity.type} ${result.entity.id}.`);
      for (const warning of result.warnings) {
        console.log(`Warning: ${warning}`);
      }
      return;
    }

    if (command === "update-entity") {
      const id = first(args.options, "id");
      if (!id) {
        throw new Error("update-entity requires --id.");
      }
      const entity = await getEntity(db, id);
      if (!entity) {
        throw new Error("Entity not found.");
      }
      const updated = await updateEntity(db, {
        id,
        patch: {
          key: first(args.options, "key") ?? entity.key,
          slug: first(args.options, "slug") ?? entity.slug,
          title: first(args.options, "title") ?? entity.title,
          summary: first(args.options, "summary") ?? entity.summary,
          body: first(args.options, "body") ?? entity.body,
          status: (first(args.options, "status") as EntityStatus | undefined) ?? entity.status,
          metadata: first(args.options, "metadata") || first(args.options, "metadata-file") ? await parseMetadata(args.options) : entity.metadata
        }
      });
      console.log(`Updated ${updated.type} ${updated.id}.`);
      return;
    }

    if (command === "get-entity") {
      const id = first(args.options, "id");
      if (!id) {
        throw new Error("get-entity requires --id.");
      }
      console.log(JSON.stringify(await getEntity(db, id), null, 2));
      return;
    }

    if (command === "list-entities") {
      const type = first(args.options, "type") as EntityType | undefined;
      if (type && !entityTypes.has(type)) {
        throw new Error(`Unknown entity type "${type}".`);
      }
      const entities = await listEntities(db, { projectKey: "PLAN", type, query: first(args.options, "query") });
      for (const entity of entities) {
        console.log(`- ${entity.id} [${entity.type}/${entity.status}] ${entity.key ? `${entity.key} ` : ""}${entity.title}`);
      }
      return;
    }

    if (command === "create-relation") {
      const sourceEntityId = first(args.options, "from");
      const targetEntityId = first(args.options, "to");
      const type = first(args.options, "type") as EntityRelationType | undefined;
      if (!sourceEntityId || !targetEntityId || !type) {
        throw new Error("create-relation requires --from, --to and --type.");
      }
      if (!relationTypes.has(type)) {
        throw new Error(`Unknown relation type "${type}".`);
      }
      const relation = await createRelation(db, {
        projectKey: "PLAN",
        sourceEntityId,
        targetEntityId,
        type,
        label: first(args.options, "label"),
        isPrimary: first(args.options, "primary") === "true",
        metadata: await parseMetadata(args.options)
      });
      console.log(`Created relation ${relation.id}.`);
      return;
    }

    if (command === "list-relations") {
      const relations = await listRelations(db, {
        projectKey: "PLAN",
        sourceEntityId: first(args.options, "from"),
        targetEntityId: first(args.options, "to"),
        type: first(args.options, "type") as EntityRelationType | undefined
      });
      for (const relation of relations) {
        console.log(`- ${relation.id} ${relation.sourceEntityId} -[${relation.type}]-> ${relation.targetEntityId}`);
      }
      return;
    }

    if (command === "export") {
      const out = first(args.options, "out");
      if (!out) {
        throw new Error("export requires --out.");
      }
      await fs.writeFile(out, `${JSON.stringify(await exportGenericPlan(db, "PLAN"), null, 2)}\n`, "utf8");
      console.log(`Exported PLAN to ${out}.`);
      return;
    }

    if (command === "import") {
      const from = first(args.options, "from");
      if (!from) {
        throw new Error("import requires --from.");
      }
      await importGenericPlan(db, JSON.parse(await fs.readFile(from, "utf8")) as Awaited<ReturnType<typeof exportGenericPlan>>);
      console.log(`Imported PLAN from ${from}.`);
      return;
    }

    throw new Error(`Unknown command "${command}". Run pnpm plan help.`);
  } finally {
    db.close();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
