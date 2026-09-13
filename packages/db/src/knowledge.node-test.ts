import assert from "node:assert/strict";
import test from "node:test";
import { createKnowledgeIngestTextProvider } from "./knowledge";

test("knowledge text ingest adapter sends scoped chunking options", async () => {
  const previousFetch = globalThis.fetch;
  let requestedUrl = "";
  let requestedBody: Record<string, unknown> | undefined;
  globalThis.fetch = async (input, init) => {
    requestedUrl = String(input);
    requestedBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
    return Response.json({ ingested: 2, ids: ["memory-1", "memory-2"], embedding_model: "fixture/embed" });
  };

  try {
    const provider = createKnowledgeIngestTextProvider("http://cortex.test/");
    const result = await provider({
      datasetKey: "project-plan",
      text: "A fact",
      metadata: { source: "note" },
      scope: { kind: "project", projectKey: "PLAN" },
      maxChars: 512,
      overlapChars: 32,
      ingestionId: "ingest-1",
      batchSize: 10,
      processorStrategy: "fallback",
      extractPrimitives: true
    });

    assert.equal(requestedUrl, "http://cortex.test/datasets/project-plan/ingest/text");
    assert.deepEqual(requestedBody, {
      text: "A fact",
      metadata: { source: "note" },
      scope: { kind: "project", project_key: "PLAN" },
      max_chars: 512,
      overlap_chars: 32,
      ingestion_id: "ingest-1",
      batch_size: 10,
      processor_strategy: "fallback",
      extract_primitives: true
    });
    assert.deepEqual(result, { ingested: 2, ids: ["memory-1", "memory-2"], embeddingModel: "fixture/embed" });
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test("knowledge dataset adapter registers a typed dataset", async () => {
  const previousFetch = globalThis.fetch;
  let requestedBody: Record<string, unknown> | undefined;
  globalThis.fetch = async (_input, init) => {
    requestedBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
    return Response.json({
      dataset_key: "project_facts",
      display_name: "Project facts",
      schema_version: "1",
      semantic_description: "Facts",
      usage_guidance: "Search before answering.",
      status: "active"
    });
  };
  try {
    const { createKnowledgeRegisterDatasetProvider } = await import("./knowledge");
    const result = await createKnowledgeRegisterDatasetProvider("http://cortex.test/")({
      datasetKey: "project_facts",
      displayName: "Project facts",
      schemaVersion: "1",
      semanticDescription: "Facts",
      usageGuidance: "Search before answering."
    });
    assert.deepEqual(requestedBody, {
      dataset_key: "project_facts",
      display_name: "Project facts",
      schema_version: "1",
      semantic_description: "Facts",
      usage_guidance: "Search before answering."
    });
    assert.equal(result.datasetKey, "project_facts");
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test("knowledge context index adapter normalizes the compact catalog", async () => {
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async () => Response.json({
    datasets: [{ key: "project_facts", display_name: "Project facts", llm_summary: null, capabilities: ["vector"], entity_types: [], access_patterns: ["semantic_search"], status: "active" }],
    tools: [],
    relationship_count: 0,
    usage_hint: "Search the relevant dataset."
  });
  try {
    const { createKnowledgeContextIndexProvider } = await import("./knowledge");
    const result = await createKnowledgeContextIndexProvider("http://cortex.test/")();
    assert.deepEqual(result.datasets[0], {
      key: "project_facts",
      displayName: "Project facts",
      llmSummary: null,
      capabilities: ["vector"],
      entityTypes: [],
      accessPatterns: ["semantic_search"],
      status: "active"
    });
    assert.equal(result.relationshipCount, 0);
  } finally {
    globalThis.fetch = previousFetch;
  }
});
