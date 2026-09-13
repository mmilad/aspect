/**
 * Move legacy CortexDB session-memory items out of the global scope.
 *
 * This is an explicit migration tool, not a runtime Assistant operation.
 * It is dry-run by default; pass --apply to re-ingest the same stable IDs
 * with ownership metadata. No item is deleted.
 */

const args = new Set(process.argv.slice(2));

function option(name, fallback) {
  const prefix = `--${name}=`;
  const value = process.argv.slice(2).find((arg) => arg.startsWith(prefix));
  return value ? value.slice(prefix.length) : fallback;
}

const endpoint = (option("endpoint", process.env.PROJECTPLANER_KNOWLEDGE_URL ?? process.env.CORTEXDB_URL ?? "http://127.0.0.1:5000")).replace(/\/$/, "");
const datasetKey = option("dataset", process.env.PROJECTPLANER_KNOWLEDGE_DATASET ?? "session_memory");
const principalId = option("principal", process.env.PROJECTPLANER_PRINCIPAL_ID);
const apply = args.has("--apply");
const migrationKey = "projectplaner:legacy-session-memory-scope:v1";

if (!principalId?.trim()) {
  throw new Error("A principal is required. Set PROJECTPLANER_PRINCIPAL_ID or pass --principal=<id>.");
}

async function request(path, init) {
  const response = await fetch(`${endpoint}${path}`, {
    ...init,
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) }
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`CortexDB returned HTTP ${response.status}${detail ? `: ${detail}` : "."}`);
  }
  return response.json();
}

async function listItems() {
  const items = [];
  for (let offset = 0; ; offset += 500) {
    const page = await request(`/datasets/${encodeURIComponent(datasetKey)}/items?limit=500&offset=${offset}`);
    if (!Array.isArray(page)) throw new Error("CortexDB returned an invalid item list.");
    items.push(...page);
    if (page.length < 500) return items;
  }
}

function migrationMetadata(item) {
  const metadata = item.metadata && typeof item.metadata === "object" && !Array.isArray(item.metadata)
    ? item.metadata
    : {};
  return {
    ...metadata,
    projectplaner_scope_migration: {
      key: migrationKey,
      previousScope: item.scope ?? { kind: "global" },
      principalId,
      migratedAt: new Date().toISOString()
    }
  };
}

function targetScope(item) {
  const metadata = item.metadata && typeof item.metadata === "object" && !Array.isArray(item.metadata)
    ? item.metadata
    : {};
  const projectKey = metadata.project_key ?? metadata.projectKey;
  const agentId = metadata.agent_id ?? metadata.agentId;
  if (typeof agentId === "string" && agentId.trim()) {
    return { kind: "agent", agent_id: agentId.trim() };
  }
  if (typeof projectKey === "string" && projectKey.trim()) {
    return { kind: "project", project_key: projectKey.trim() };
  }
  return { kind: "personal", owner_id: principalId.trim() };
}

const items = await listItems();
const candidates = items
  .filter((item) => item && item.is_deleted !== true)
  .filter((item) => item.scope?.kind === "global")
  .filter((item) => item.metadata?.source === "logic_ingest")
  .filter((item) => item.metadata?.projectplaner_scope_migration?.key !== migrationKey);

const plan = candidates.map((item) => ({
  id: item.id,
  rawText: item.raw_text,
  from: item.scope ?? { kind: "global" },
  to: targetScope(item),
  metadata: migrationMetadata(item)
}));

console.log(JSON.stringify({
  endpoint,
  datasetKey,
  principalId,
  apply,
  migrationKey,
  totalItems: items.length,
  candidates: plan.map(({ id, rawText, from, to }) => ({ id, rawText, from, to }))
}, null, 2));

if (!apply || plan.length === 0) {
  if (!apply) console.log("Dry run only. Re-run with --apply to update these stable IDs.");
  process.exit(0);
}

for (let index = 0; index < plan.length; index += 25) {
  const batch = plan.slice(index, index + 25).map((item) => ({
    id: item.id,
    raw_text: item.rawText,
    metadata: item.metadata,
    scope: item.to
  }));
  await request(`/datasets/${encodeURIComponent(datasetKey)}/ingest`, {
    method: "POST",
    body: JSON.stringify({ items: batch })
  });
  console.log(`Migrated ${Math.min(index + batch.length, plan.length)}/${plan.length}.`);
}

console.log("Migration complete. Original scopes are preserved in metadata.projectplaner_scope_migration.previousScope.");
