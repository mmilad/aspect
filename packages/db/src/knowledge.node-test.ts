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
