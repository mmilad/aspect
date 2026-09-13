/**
 * Read-only verification for the SQLite -> Projectplaner Postgres migration
 * and the project graph projection in CortexDB.
 *
 * Postgres may contain records created after the SQLite export, so this checks
 * that every source ID exists in the target and reports target-only records
 * separately instead of requiring fragile exact counts.
 */

import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import pg from "pg";

const { Pool } = pg;

function option(name, fallback) {
  const prefix = `--${name}=`;
  const value = process.argv.slice(2).find((arg) => arg.startsWith(prefix));
  return value === undefined ? fallback : value.slice(prefix.length);
}

const flags = new Set(process.argv.slice(2));

function loadRootEnv() {
  let current = path.resolve(process.cwd());
  while (true) {
    const file = path.join(current, ".env");
    if (fs.existsSync(file)) {
      for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const separator = trimmed.indexOf("=");
        if (separator < 1) continue;
        const key = trimmed.slice(0, separator).trim();
        let value = trimmed.slice(separator + 1).trim();
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1);
        }
        if (process.env[key] === undefined) process.env[key] = value;
      }
      return file;
    }
    const parent = path.dirname(current);
    if (parent === current) return null;
    current = parent;
  }
}

loadRootEnv();

function resolvedPath(value) {
  return path.isAbsolute(value) ? value : path.resolve(process.cwd(), value);
}

const sourcePath = resolvedPath(option("source", process.env.PROJECTPLANER_DB_PATH ?? "projectplaner.db"));
const databaseUrl = option("database-url", process.env.PROJECTPLANER_DATABASE_URL);
const knowledgeUrl = (option("knowledge-url", process.env.PROJECTPLANER_KNOWLEDGE_URL ?? "http://127.0.0.1:5000")).replace(/\/$/, "");
const projectKey = option("project-key", process.env.PROJECTPLANER_PROJECT_KEY ?? "PLAN");
// The runtime may use PROJECTPLANER_KNOWLEDGE_DATASET for session/personal
// memory. This migration check is about the project graph projection, so keep
// its default independent from that runtime dataset setting.
const datasetKey = option("dataset", process.env.PROJECTPLANER_KNOWLEDGE_PROJECT_DATASET ?? `project_${projectKey.toLowerCase()}`);
const principalId = option("principal", process.env.PROJECTPLANER_PRINCIPAL_ID ?? "local-user");
const searchQuery = option("query", `${projectKey} project agents`);
const allowEmptyKnowledge = flags.has("--allow-empty");

if (!databaseUrl) throw new Error("Set PROJECTPLANER_DATABASE_URL or pass --database-url=<url>.");
if (!fs.existsSync(sourcePath)) throw new Error(`SQLite source database was not found at '${sourcePath}'.`);

const tableChecks = [
  ["projects", "pp_projects"],
  ["entities", "pp_entities"],
  ["entity_relations_v2", "pp_relations"],
  ["tags", "pp_tags"],
  ["entity_tag_assignments", "pp_tag_assignments"],
  ["project_workspaces", "pp_workspaces"],
  ["assistant_sessions", "pp_assistant_sessions"],
  ["agent_runs", "pp_agent_runs"],
  ["agent_run_events", "pp_agent_events"],
  ["llm_json_schemas", "pp_llm_schemas"],
  ["workflow_runs", "pp_workflow_runs"],
  ["workflow_node_runs", "pp_workflow_node_runs"]
];

function sourceIds(db, table) {
  return db.prepare(`SELECT id FROM ${table}`).all().map((row) => String(row.id));
}

function sourceFlowIds(db) {
  return db.prepare("SELECT DISTINCT workflow_id FROM workflow_nodes").all().map((row) => String(row.workflow_id));
}

async function targetIds(client, table) {
  const idColumn = table === "pp_workflows" ? "workflow_id" : "id";
  const result = await client.query(`SELECT ${idColumn} AS id FROM ${table}`);
  return result.rows.map((row) => String(row.id));
}

async function requestJson(pathname, init = {}) {
  const response = await fetch(`${knowledgeUrl}${pathname}`, {
    ...init,
    headers: { "content-type": "application/json", ...(init.headers ?? {}) },
    signal: AbortSignal.timeout(20_000)
  });
  const text = await response.text();
  let body;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  if (!response.ok) throw new Error(`CortexDB returned HTTP ${response.status}: ${typeof body === "string" ? body : JSON.stringify(body)}`);
  return body;
}

async function listKnowledgeItems() {
  const items = [];
  for (let offset = 0; ; offset += 500) {
    const page = await requestJson(`/datasets/${encodeURIComponent(datasetKey)}/items?limit=500&offset=${offset}`);
    if (!Array.isArray(page)) throw new Error("CortexDB returned an invalid item list.");
    items.push(...page);
    if (page.length < 500) return items;
  }
}

const source = new DatabaseSync(sourcePath);
const pool = new Pool({ connectionString: databaseUrl, max: 2 });
const client = await pool.connect();
const errors = [];

try {
  const migrationTables = [];
  for (const [sourceTable, targetTable] of tableChecks) {
    const sourceSet = new Set(sourceIds(source, sourceTable));
    const targetSet = new Set(await targetIds(client, targetTable));
    const missing = [...sourceSet].filter((id) => !targetSet.has(id));
    migrationTables.push({
      sourceTable,
      targetTable,
      sourceCount: sourceSet.size,
      targetCount: targetSet.size,
      missingCount: missing.length,
      missingSample: missing.slice(0, 10),
      targetOnlyCount: [...targetSet].filter((id) => !sourceSet.has(id)).length
    });
    if (missing.length) errors.push(`${sourceTable}: ${missing.length} source IDs are missing from ${targetTable}.`);
  }

  const sourceFlowSet = new Set(sourceFlowIds(source));
  const targetFlowSet = new Set(await targetIds(client, "pp_workflows"));
  const missingFlows = [...sourceFlowSet].filter((id) => !targetFlowSet.has(id));
  const workflows = {
    sourceCount: sourceFlowSet.size,
    targetCount: targetFlowSet.size,
    missingCount: missingFlows.length,
    missingSample: missingFlows.slice(0, 10),
    targetOnlyCount: [...targetFlowSet].filter((id) => !sourceFlowSet.has(id)).length
  };
  if (missingFlows.length) errors.push(`${missingFlows.length} source workflow IDs are missing from pp_workflows.`);

  const integrity = (await client.query(`
    SELECT
      (SELECT count(*) FROM pp_entities e LEFT JOIN pp_projects p ON p.id=e.project_id WHERE p.id IS NULL) AS orphan_entities,
      (SELECT count(*) FROM pp_relations r LEFT JOIN pp_entities s ON s.id=r.source_entity_id LEFT JOIN pp_entities t ON t.id=r.target_entity_id WHERE s.id IS NULL OR t.id IS NULL) AS orphan_relations,
      (SELECT count(*) FROM pp_workflow_runs r LEFT JOIN pp_workflows w ON w.workflow_id=r.workflow_id WHERE w.workflow_id IS NULL) AS orphan_workflow_runs,
      (SELECT count(*) FROM pp_workflow_node_runs n LEFT JOIN pp_workflow_runs r ON r.id=n.run_id WHERE r.id IS NULL) AS orphan_node_runs
  `)).rows[0];
  for (const [key, value] of Object.entries(integrity)) {
    if (Number(value) !== 0) errors.push(`Postgres referential integrity check '${key}' found ${value} orphan records.`);
  }

  const dataset = await requestJson(`/datasets/${encodeURIComponent(datasetKey)}`);
  const items = await listKnowledgeItems();
  const scopedItems = items.filter((item) => item?.scope?.project_key === projectKey || item?.scope?.projectKey === projectKey || item?.metadata?.projectKey === projectKey);
  const chunkKeyCounts = new Map();
  for (const item of items) {
    const ingestionId = item?.metadata?.ingestion_id ?? item?.metadata?.ingestionId;
    const chunkIndex = item?.metadata?.chunk_index ?? item?.metadata?.chunkIndex;
    if (ingestionId && chunkIndex !== undefined) {
      const chunkKey = `${ingestionId}:${chunkIndex}`;
      chunkKeyCounts.set(chunkKey, (chunkKeyCounts.get(chunkKey) ?? 0) + 1);
    }
  }
  const duplicateChunkKeys = [...chunkKeyCounts.entries()]
    .filter(([, count]) => count > 1)
    .map(([id]) => id);

  const search = await requestJson(`/datasets/${encodeURIComponent(datasetKey)}/search`, {
    method: "POST",
    body: JSON.stringify({
      query: searchQuery,
      top_k: 5,
      access: { project_key: projectKey, include_global: true, principal_id: principalId }
    })
  });
  const hits = Array.isArray(search?.hits) ? search.hits : [];
  const scopedHits = hits.filter((hit) => hit?.item?.scope?.project_key === projectKey || hit?.item?.metadata?.projectKey === projectKey);
  const embeddingModels = [...new Set(hits.map((hit) => hit?.item?.embedding_model).filter((value) => typeof value === "string"))];
  const checksumCount = hits.filter((hit) => typeof hit?.item?.metadata?.source_sha256 === "string" && hit.item.metadata.source_sha256.length > 0).length;
  const knowledge = {
    datasetKey,
    status: dataset?.status ?? null,
    contentKind: dataset?.content_kind ?? null,
    itemCount: items.length,
    projectScopedItemCount: scopedItems.length,
    searchQuery,
    searchHitCount: hits.length,
    projectScopedSearchHitCount: scopedHits.length,
    embeddingModels,
    searchHitsWithSourceChecksum: checksumCount,
    duplicateChunkKeyCount: duplicateChunkKeys.length,
    datasetMetadata: {
      source: dataset?.metadata?.source ?? null,
      projectKey: dataset?.metadata?.projectKey ?? null
    }
  };

  if (dataset?.status !== "active") errors.push(`CortexDB dataset '${datasetKey}' is not active.`);
  if (!allowEmptyKnowledge && scopedItems.length === 0) errors.push(`CortexDB dataset '${datasetKey}' has no project-scoped items for ${projectKey}.`);
  if (!allowEmptyKnowledge && scopedHits.length === 0) errors.push(`CortexDB search returned no project-scoped hits for '${searchQuery}'.`);
  if (hits.length > 0 && checksumCount !== hits.length) errors.push("At least one CortexDB search hit is missing source_sha256 provenance.");
  if (duplicateChunkKeys.length) errors.push(`CortexDB contains ${duplicateChunkKeys.length} duplicate ingestion/chunk keys.`);

  const result = {
    status: errors.length ? "failed" : "passed",
    sourcePath,
    projectKey,
    postgres: { migrationTables, workflows, integrity },
    knowledge,
    errors
  };
  console.log(JSON.stringify(result, null, 2));
  process.exitCode = errors.length ? 1 : 0;
} finally {
  client.release();
  await pool.end();
  source.close();
}
