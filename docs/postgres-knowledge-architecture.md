# Postgres and shared knowledge architecture

Status: implemented foundation; retrieval and memory expansion remain incremental

## Decision

Use one local Postgres deployment with two logical schemas/services:

- `projectplaner` remains the authoritative relational store for projects,
  entities, relations, workflows, workflow runs, Assistant sessions, and agent
  runs.
- CortexDB remains the knowledge/retrieval service. Its memory, source, session,
  namespace, embedding, and provenance tables live in a separate schema (or a
  separate database on the same Postgres instance).
- Projectplaner talks to CortexDB through a small typed HTTP adapter. Workflow
  nodes orchestrate retrieval, ingestion, classification, and promotion; the
  Assistant does not receive unrestricted database access.

This keeps the graph source of truth in one place while allowing the knowledge
layer to index graph facts, chat, files, and agent memories without creating a
second editable copy of the project graph.

## Current implementation

The split described above is now implemented across the two repositories:

- Projectplaner has an opt-in Postgres storage adapter using `pp_`-prefixed
  tables, so it can share a database with CortexDB without sharing write
  models.
- `pnpm db:migrate-postgres` copies SQLite projects, entities, relations,
  sessions, agent runs, workflow definitions/runs, schemas, tags, and workspace
  records while preserving IDs and timestamps.
- Projectplaner exposes typed `knowledge_search`, `knowledge_get`,
  `knowledge_ingest`, and `knowledge_ingest_text` workflow nodes. The seeded
  `knowledge_retrieve` preset provides a reusable read-only search graph, while
  `knowledge_capture` provides the corresponding text-ingest graph. These call
  CortexDB through a small HTTP adapter; the Assistant receives only scoped
  read results through workflows.
- Specialist agent profiles can opt into scoped memory context with
  `contextPolicy.memoryEnabled` and `memoryPolicy.enabled`. The web agent host
  then searches CortexDB with the project, principal, and optional agent scope;
  the default remains disabled for backwards compatibility. The reserved
  Assistant profile stays read-only and continues to use its workflow loop.
- The seeded `knowledge_index_project` workflow can project bounded graph
  entities into CortexDB with stable `projectplaner:entity:<id>` ingestion IDs
  and source metadata. When the database adapter exposes relations, each entity
  projection also includes relation text and relation metadata so retrieval can
  explain graph connections without making CortexDB a second graph source. It
  is classified as a write operation and cannot run as the Assistant actor.
- CortexDB owns embedding-provider selection, vector storage, hybrid search,
  scope filtering, and its optional Postgres/pgvector backend. Projectplaner
  does not construct or store embedding vectors.

For local development, start the Postgres service from Projectplaner’s compose
file, configure both database URLs in `.env`, and migrate the existing SQLite
data:

```text
docker compose up -d postgres
pnpm db:migrate-postgres
```

Set `PROJECTPLANER_DATABASE_URL` to make Projectplaner use Postgres. Leave it
unset to keep using SQLite for fast tests and backwards-compatible local work.
Set `PROJECTPLANER_KNOWLEDGE_URL` to the running CortexDB API and
`PROJECTPLANER_KNOWLEDGE_DATASET` to the dataset used by the knowledge nodes.

## Evidence from the current systems

Projectplaner has a storage-neutral `Storage` contract, a SQLite adapter, and an
opt-in Postgres adapter. The SQLite→Postgres migration preserves stable IDs and
timestamps without changing workflow/core callers.

CortexDB already provides the service boundary we need: datasets, sessions,
namespaces, raw text, memory items, metadata filtering, relationship edges,
hybrid keyword/vector retrieval, provenance-oriented ingestion, and pluggable
Ollama/OpenAI-compatible embedding providers. It also supports optional
Postgres/pgvector storage and scoped item reads. Embedding can be disabled for
deterministic keyword-only tests.

## Knowledge ownership model

Every knowledge item will have an explicit scope and owner:

| scope | owner | default readers | examples |
| --- | --- | --- | --- |
| `global` | application | all permitted agents | product/domain guidance |
| `personal` | user principal | that user and Assistant | preferences, personal facts |
| `project` | Projectplaner project | project agents and Assistant | decisions, requirements, project notes |
| `agent` | specialist agent | that agent plus delegated Assistant context | agent-specific working memory |
| `session` | Assistant/agent session | current run only | recent turns and temporary observations |

The retrieval API must apply ownership filters before ranking. A vector hit is
never allowed to bypass project, user, or agent visibility.

Projectplaner entity IDs, workflow IDs, and run IDs are references/provenance in
the knowledge layer, not duplicated writable entities. A graph entity can be
indexed as a searchable projection, but edits go through Projectplaner.

## Embedding boundary

CortexDB owns embedding provider selection and vector storage. Callers send raw
text plus metadata; they do not construct vectors. The first provider remains
the existing Ollama/OpenAI-compatible adapter, configured by environment:

- provider;
- model/version;
- endpoint;
- optional API key;
- embedding dimension recorded with each index.

The LLM service and the embedding service are separate concerns. The LLM may
classify or promote a memory through a workflow, but CortexDB should perform
storage, filtering, vector search, and scoring deterministically.

## Workflow responsibilities

Add typed knowledge operations to the Projectplaner workflow layer rather than
adding a generic unrestricted tool:

1. `knowledge_search` — read-only, scoped hybrid retrieval.
2. `knowledge_get` — read-only retrieval of a selected item and provenance.
3. `knowledge_ingest` — write a raw source/chunk, allowed only to specialist
   workflows or an explicit user-authorized file/session flow.
4. `knowledge_promote` — apply an explicit, create-only promotion decision
   (`candidate`, `durable`, or `ignore`) with provenance; it requires caller
   confirmation and never silently overwrites or supersedes facts.
5. `file_list`, `file_read`, and later `file_write` — explicit filesystem
   operations with a configured workspace root and policy checks.

The Assistant can use the read-only operations and can delegate ingestion,
promotion, or file mutation to a registered specialist. It never writes the
project graph or directly mutates files.

## Implementation phases

### Phase 0 — contracts and inventory

- Freeze the scope/ownership vocabulary and access policy.
- Define stable IDs and provenance references between Projectplaner and CortexDB.
- Define the knowledge API DTOs and workflow bag shapes.
- Add migration verification commands: row counts, IDs, embedding model, and
  source checksums.
- Keep SQLite fixtures for fast unit tests.

Exit condition: the API and schema contracts are reviewed before a data move.

### Phase 1 — Postgres foundation

- Add a `postgres` service using a pgvector-enabled image to the compose file.
- Add health checks, persistent volume, configurable port/database/user/password,
  and a development-only `.env.example` configuration.
- Implement CortexDB migrations and a `PostgresStore` with the existing store
  operations needed by registry, session, ingest, and search APIs.
- Keep SQLite as a supported local/test backend.
- Add parity tests that run the same repository contract against SQLite and
  Postgres when Postgres is available.

Exit condition: CortexDB can boot against Postgres and pass registry/session/
ingest/search contract tests without embedding secrets in the repository.

### Phase 2 — generic knowledge model and hybrid search

- Add first-class namespace, principal/owner, source, document/chunk, memory
  item, fact, embedding, and provenance fields.
- Store vectors in pgvector with model and dimension metadata.
- Add PostgreSQL full-text search and deterministic hybrid score components:
  vector similarity, keyword score, recency, source trust, and scope affinity.
- Make scope filters mandatory in the service API, with an explicit internal
  admin bypass only for migration tooling.
- Add idempotent ingest keys and supersession chains for durable facts.

Exit condition: a scoped query returns ranked items with provenance and no
cross-owner leakage; re-embedding can replace vectors by model version.

### Phase 3 — Projectplaner adapter and workflow nodes

- Add a typed CortexDB client in the web/agent host.
- Register knowledge node models, schemas, executors, validation rules, and
  trace-safe output contracts.
- Add read-only Assistant policy checks for knowledge search/get.
- Add specialist-only policies for ingest/promote and explicit file operations.
- Add deterministic fixture adapters so workflow tests do not need a running
  embedding service.

Exit condition: a workflow can retrieve scoped knowledge and expose it to an
LLM node without making the Assistant a direct database client.

### Phase 4 — migration and indexing

- Export Projectplaner SQLite data into Postgres without changing IDs.
- Validate projects, entities, relations, workflow snapshots, sessions, and
  agent runs by count and referential integrity.
- Register graph projections in CortexDB as read-only sources with provenance.
- Ingest Assistant session messages and user-approved files into the correct
  personal/project/session namespaces.
- Re-embed in batches and record model/version and failures.
- Keep an export/rollback path until parity checks pass.

Exit condition: Postgres is the active source for Projectplaner relational data,
and CortexDB contains searchable projections with verified ownership metadata.

### Phase 5 — classifier and durable memory promotion

- Keep deterministic chunking and primitive extraction as the cheap first pass.
- Move LLM classification/promotion into explicit workflow nodes using strict
  JSON schemas and the current CortexDB rule-pack concepts.
- Promote only explicit or high-confidence facts; retain raw text and source
  references.
- Model corrections as supersession chains and exclude superseded facts from
  normal retrieval.
- Add trace fields for retrieval, classification, promotion, and failures.

Exit condition: the Assistant can remember approved personal/project facts and
can explain the source and confidence of retrieved facts.

### Phase 6 — Assistant and file-management integration

- Add on-demand knowledge retrieval to the Assistant loop with bounded lookup
  cycles and scope-aware context.
- Add a “remember this” path that asks for clarification or delegates promotion
  rather than silently persisting every statement.
- Add file discovery/read workflows under a configured workspace root.
- Add file writes only after explicit authorization and specialist delegation.
- Extend Assistant evaluations for grounding, scope isolation, provenance, and
  confirmed filesystem outcomes.

Exit condition: the Assistant can answer from personal/shared/project knowledge,
remember approved facts, and manage files through auditable workflows without
inventing or claiming unconfirmed work.

## Migration rules

- Do not move editable Projectplaner entities into CortexDB as a second source
  of truth.
- Preserve all existing IDs and timestamps.
- Keep raw source content and provenance when deriving canonical facts.
- Use soft deletion and supersession; do not erase evidence during normal
  corrections.
- Run dual-read or parity checks before switching production reads.
- Never commit database files, embedding vectors, credentials, or user files.

## Current uncertainties to resolve before Phase 1

The recommended defaults are already selected above, but these choices affect
the initial schema:

1. **Embedding provider:** use the already-running local Ollama service with
   `nomic-embed-text`, or use the existing external LLM/embedding endpoint?
2. **Postgres topology:** one local pgvector container with separate schemas is
   the default; a separate CortexDB database is also possible if service
   isolation is preferred.
3. **File root:** file management should be restricted to an explicitly
   configured workspace root, not the whole user profile.
