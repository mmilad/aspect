import { getOpenWorkBelowAspect, getPrimaryTaskLink, getTasksForFeature, rankedByQuery } from "@projectplaner/core";
import type {
  Entity,
  EntityRelation,
  EntityRelationType,
  EntityStatus,
  EntityType,
  JsonRecord,
  ProjectPlanSnapshot,
  Task,
  TaskLinkType,
  TaskPriority
} from "@projectplaner/core";
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

function printMatchingTask(task: Task, snapshot: ProjectPlanSnapshot, score?: number): void {
  const primary = getPrimaryTaskLink(task, snapshot);
  const target = primary ? ` -> ${primary.type} ${entityLabel(primary.targetType, primary.targetId, snapshot)}` : "";
  const scoreText = score === undefined ? "" : ` score ${score}`;
  console.log(`- task ${task.id}: ${task.key} ${task.title} [${task.status}/${task.priority}]${scoreText}${target}`);
  console.log(`  ${task.description || "No description."}`);
}

function suggestionLabel(entity: ProjectPlanSnapshot["nodes"][number] | ProjectPlanSnapshot["features"][number] | Task, score?: number): string {
  const scoreText = score === undefined ? "" : ` score ${score}`;
  if ("description" in entity) {
    return `task ${entity.id}: ${entity.key} ${entity.title}${scoreText}`;
  }
  if ("acceptanceShape" in entity) {
    return `feature ${entity.id}: ${entity.key} ${entity.title}${scoreText}`;
  }
  return `${entity.type} ${entity.id}: ${entity.title}${scoreText}`;
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

  const matchingNodes = rankedByQuery(snapshot.nodes, query, (node) => [node.id, node.title, node.path, node.summary, node.body]);
  const matchingFeatures = rankedByQuery(snapshot.features, query, (feature) => [
    feature.id,
    feature.key,
    feature.title,
    feature.slug,
    feature.summary,
    feature.body,
    feature.acceptanceShape,
    JSON.stringify(feature.metadata)
  ]);
  const matchingTasks = rankedByQuery(snapshot.tasks, query, (task) => [
    task.id,
    task.key,
    task.title,
    task.description,
    task.status,
    task.priority,
    JSON.stringify(task.acceptanceCriteria),
    JSON.stringify(task.metadata)
  ]);

  console.log("");
  console.log(`Matches for "${query}":`);

  for (const { item: node, score } of matchingNodes) {
    const openWork = getOpenWorkBelowAspect(node.id, snapshot);
    console.log(`- ${node.type} ${node.id}: ${node.title} (${node.path}) [${node.status}] score ${score}`);
    console.log(`  ${node.summary}`);
    console.log(`  open work below: ${openWork.length}`);
    for (const task of openWork.slice(0, 5)) {
      console.log(`  - ${task.key} [${task.status}/${task.priority}] ${task.title}`);
    }
  }

  for (const { item: feature, score } of matchingFeatures) {
    const linkedAspects = snapshot.featureAspectLinks
      .filter((link) => link.featureId === feature.id)
      .map((link) => entityLabel("aspect", link.aspectId, snapshot));
    const tasks = getTasksForFeature(feature.id, snapshot, { includeNestedFeatures: true });

    console.log(`- feature ${feature.id}: ${feature.key} ${feature.title} [${feature.status}] score ${score}`);
    console.log(`  ${feature.summary}`);
    console.log(`  linked aspects: ${linkedAspects.join("; ") || "none"}`);
    console.log(`  tasks: ${tasks.length}`);
    for (const task of tasks.slice(0, 5)) {
      console.log(`  - ${task.key} [${task.status}/${task.priority}] ${task.title}`);
    }
  }

  for (const { item: task, score } of matchingTasks) {
    printMatchingTask(task, snapshot, score);
  }

  if (matchingNodes.length === 0 && matchingFeatures.length === 0) {
    const shouldPrintNoMatches = matchingTasks.length === 0;
    if (shouldPrintNoMatches) {
      console.log("No matching entities. Use `pnpm plan orient` to scan top-level context.");
    }
    const nearby = [
      ...rankedByQuery(snapshot.nodes, query, (node) => [node.id, node.title, node.path, node.summary, node.body]),
      ...rankedByQuery(snapshot.features, query, (feature) =>
        [feature.id, feature.key, feature.title, feature.slug, feature.summary, feature.body, feature.acceptanceShape, JSON.stringify(feature.metadata)]
      ),
      ...rankedByQuery(snapshot.tasks, query, (task) => [
        task.id,
        task.key,
        task.title,
        task.description,
        JSON.stringify(task.acceptanceCriteria),
        JSON.stringify(task.metadata)
      ])
    ]
      .sort((a, b) => b.score - a.score)
      .slice(0, 6);
    if (nearby.length > 0) {
      console.log("");
      console.log(shouldPrintNoMatches ? "Nearby suggestions:" : "Nearby graph suggestions:");
      for (const { item, score } of nearby) {
        console.log(`- ${suggestionLabel(item, score)}`);
      }
    }
  }
}

function isOrientationPacket(entity: Entity, workflow?: string): boolean {
  if (entity.type !== "reference") {
    return false;
  }
  if (workflow && entity.metadata.workflow !== workflow) {
    return false;
  }
  return entity.metadata.kind === "orientation_packet" || typeof entity.metadata.workflow === "string";
}

function relationTouchesPacket(relation: EntityRelation, entityId: string, packetIds: Set<string>): boolean {
  return (
    (relation.sourceEntityId === entityId && packetIds.has(relation.targetEntityId)) ||
    (relation.targetEntityId === entityId && packetIds.has(relation.sourceEntityId))
  );
}

async function readPackets(db: ReturnType<typeof createDatabase>, entityId: string, workflow?: string): Promise<Entity[]> {
  const entity = await getEntity(db, entityId);
  if (!entity) {
    throw new Error("Entity not found.");
  }
  const references = await listEntities(db, { projectKey: "PLAN", type: "reference" });
  const packetIds = new Set(references.filter((reference) => isOrientationPacket(reference, workflow)).map((reference) => reference.id));
  const relations = await listRelations(db, { projectKey: "PLAN" });
  const attachedIds = new Set(
    relations
      .filter((relation) => relationTouchesPacket(relation, entityId, packetIds))
      .map((relation) => (relation.sourceEntityId === entityId ? relation.targetEntityId : relation.sourceEntityId))
  );
  return references.filter((reference) => attachedIds.has(reference.id));
}

function normalizePacketMetadata(metadata: JsonRecord, entityId: string, workflow?: string): JsonRecord {
  const targetIds = Array.isArray(metadata.targetIds) ? metadata.targetIds : [];
  return {
    ...metadata,
    kind: "orientation_packet",
    workflow: workflow ?? metadata.workflow ?? "task.consumption.handoff",
    targetIds: targetIds.includes(entityId) ? targetIds : [...targetIds, entityId],
    updatedAt: new Date().toISOString()
  };
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
    console.log("  pnpm plan packet-read --entity <entity-id> [--workflow <name>]");
    console.log("  pnpm plan packet-write --entity <entity-id> [--id <reference-id>] [--title <title>] [--workflow <name>] --metadata-file <json-file>");
    console.log("  pnpm plan export --out <file>");
    console.log("  pnpm plan import --from <file>");
    return;
  }

  const db = createDatabase();
  try {

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
      if (type === "task" && !target) {
        throw new Error(
          "create-entity --type task requires --target <aspect-or-feature-id>. Create an Aspect or Feature first if no suitable anchor exists."
        );
      }
      if (type === "task" && target) {
        const targetEntity = await getEntity(db, target);
        if (!targetEntity || (targetEntity.type !== "aspect" && targetEntity.type !== "feature")) {
          throw new Error("Task targets must be existing Aspect or Feature entities.");
        }
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

    if (command === "packet-read") {
      const entityId = first(args.options, "entity");
      if (!entityId) {
        throw new Error("packet-read requires --entity.");
      }
      const packets = await readPackets(db, entityId, first(args.options, "workflow"));
      console.log(JSON.stringify(packets, null, 2));
      return;
    }

    if (command === "packet-write") {
      const entityId = first(args.options, "entity");
      if (!entityId) {
        throw new Error("packet-write requires --entity.");
      }
      const target = await getEntity(db, entityId);
      if (!target) {
        throw new Error("Entity not found.");
      }
      const metadata = normalizePacketMetadata(await parseMetadata(args.options), entityId, first(args.options, "workflow"));
      const existingId = first(args.options, "id");
      const packet = existingId
        ? await updateEntity(db, {
            id: existingId,
            patch: {
              metadata,
              title: first(args.options, "title") ?? (await getEntity(db, existingId))?.title ?? "Orientation Packet"
            }
          })
        : (
            await createEntity(db, {
              projectKey: "PLAN",
              type: "reference",
              title: first(args.options, "title") ?? `Orientation Packet for ${target.key ?? target.title}`,
              summary: first(args.options, "summary") ?? "Compact machine-oriented handoff packet.",
              body: first(args.options, "body") ?? "Compact machine-oriented handoff packet.",
              metadata
            })
          ).entity;
      if (packet.type !== "reference") {
        throw new Error("Packet entity must be a reference.");
      }
      const existingRelations = await listRelations(db, { projectKey: "PLAN", sourceEntityId: entityId, targetEntityId: packet.id });
      if (existingRelations.length === 0) {
        await createRelation(db, {
          projectKey: "PLAN",
          sourceEntityId: entityId,
          targetEntityId: packet.id,
          type: "references",
          label: "orientation packet",
          isPrimary: false
        });
      }
      console.log(`Wrote packet ${packet.id}.`);
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
