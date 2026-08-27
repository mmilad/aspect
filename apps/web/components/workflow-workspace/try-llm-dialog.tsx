"use client";

import { useEffect, useState } from "react";
import {
  getLlmJsonSchemaPreset,
  renderBagTemplate,
  resolveWorkflowLlmSystemPrompt,
  serializeShapeSlim,
  type BagShape,
  type WorkflowLlmFormat,
  type WorkflowNode
} from "@projectplaner/core";
import { Copy, FlaskConical, Send, X } from "lucide-react";
import { FormLabel, GhostButton, TextArea } from "../ui";

function llmReadKeys(node: WorkflowNode): string[] {
  const inputKeys = node.data.llm?.inputKeys;
  if (inputKeys && inputKeys.length > 0) {
    return inputKeys;
  }
  const inputPorts = Object.keys(node.data.inputs ?? {});
  if (inputPorts.length > 0) {
    return inputPorts;
  }
  return node.data.reads ?? [];
}

function defaultSampleBag(node: WorkflowNode): Record<string, unknown> {
  return Object.fromEntries(llmReadKeys(node).map((key) => [key, ""]));
}

function parseSampleBag(text: string): { keys: Record<string, unknown>; error: string | null } {
  const trimmed = text.trim();
  if (!trimmed) {
    return { keys: {}, error: null };
  }
  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return { keys: {}, error: "Sample bag must be a JSON object." };
    }
    return { keys: parsed as Record<string, unknown>, error: null };
  } catch (error) {
    return { keys: {}, error: error instanceof Error ? error.message : "Invalid JSON." };
  }
}

export function TryLlmDialog({
  projectKey,
  node,
  bagView,
  onClose
}: {
  projectKey: string;
  node: WorkflowNode;
  bagView: Record<string, BagShape>;
  onClose: () => void;
}) {
  const [sampleBagText, setSampleBagText] = useState(() => JSON.stringify(defaultSampleBag(node), null, 2));
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ raw: string; parsed: unknown } | null>(null);

  useEffect(() => {
    setSampleBagText(JSON.stringify(defaultSampleBag(node), null, 2));
    setResult(null);
    setError(null);
  }, [node.id]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const readKeys = llmReadKeys(node);
  const sample = parseSampleBag(sampleBagText);
  const shapes = Object.fromEntries(
    readKeys.map((key) => [key, serializeShapeSlim(bagView[key] ?? node.data.inputs?.[key]?.shape)])
  );
  const templateOpts = { keys: sample.keys, allowedKeys: readKeys, shapes };
  const renderedSystem = renderBagTemplate(resolveWorkflowLlmSystemPrompt(node.data.llm?.systemPrompt), templateOpts);
  const renderedInstructions = renderBagTemplate(node.data.llm?.instructions ?? "", templateOpts);
  const warnings = [
    ...(sample.error ? [sample.error] : []),
    ...renderedSystem.warnings,
    ...renderedInstructions.warnings
  ];
  const schemaKey = node.data.llm?.schemaKey?.trim() || undefined;
  const format: WorkflowLlmFormat = node.data.llm?.format ?? (schemaKey ? "json_schema" : "text");
  const schemaPreview = schemaKey ? getLlmJsonSchemaPreset(schemaKey)?.schema : undefined;
  const title = node.data.title || node.id;
  const resultText =
    result?.parsed !== null && result?.parsed !== undefined
      ? JSON.stringify(result.parsed, null, 2)
      : (result?.raw ?? "");

  async function runTry() {
    if (sample.error) {
      setError(sample.error);
      return;
    }
    if (!renderedInstructions.text.trim()) {
      setError("Task instructions are required.");
      return;
    }
    setRunning(true);
    setError(null);
    try {
      const response = await fetch("/api/workflows/try-llm", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          projectKey,
          systemPrompt: renderedSystem.text,
          instructions: renderedInstructions.text,
          format,
          schemaKey,
          jsonSchema: schemaPreview
        })
      });
      const payload = (await response.json()) as { raw?: string; parsed?: unknown; error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "LLM request failed.");
      }
      setResult({ raw: payload.raw ?? "", parsed: payload.parsed ?? null });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "LLM request failed.");
    } finally {
      setRunning(false);
    }
  }

  async function copyResult() {
    if (!resultText) {
      return;
    }
    try {
      await navigator.clipboard.writeText(resultText);
    } catch {
      setError("Could not copy to clipboard.");
    }
  }

  return (
    <div className="absolute inset-0 z-30 flex items-start justify-end bg-zinc-950/20 p-3">
      <button type="button" className="absolute inset-0 cursor-default" aria-label="Close try LLM" onClick={onClose} />
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="try-llm-title"
        className="relative z-10 flex max-h-full w-[min(28rem,100%)] flex-col overflow-hidden rounded-md border border-border bg-white shadow-pane"
      >
        <header className="flex items-start gap-2 border-b border-border px-3 py-2">
          <FlaskConical className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <div id="try-llm-title" className="text-sm font-medium text-zinc-900">
              Try LLM · {title}
            </div>
            <div className="font-mono text-[10px] text-muted-foreground">
              {format}
              {schemaKey ? ` · ${schemaKey}` : ""}
            </div>
          </div>
          <button
            type="button"
            className="rounded p-1 text-zinc-500 hover:bg-muted hover:text-zinc-900"
            title="Close"
            aria-label="Close"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </button>
        </header>
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
          <FormLabel label="Sample bag (fills {{templates}})">
            <TextArea
              className="min-h-20 font-mono text-[11px]"
              value={sampleBagText}
              onChange={(event) => setSampleBagText(event.target.value)}
              spellCheck={false}
            />
          </FormLabel>
          {warnings.length > 0 ? (
            <div className="text-[11px] text-amber-800">{warnings.join(" · ")}</div>
          ) : null}
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">System</div>
            <pre className="mt-1 max-h-24 overflow-auto whitespace-pre-wrap rounded-md border border-border bg-zinc-50 px-2 py-1.5 font-mono text-[11px] leading-relaxed text-zinc-800">
              {renderedSystem.text}
            </pre>
          </div>
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Instructions</div>
            <pre className="mt-1 max-h-36 overflow-auto whitespace-pre-wrap rounded-md border border-border bg-zinc-50 px-2 py-1.5 font-mono text-[11px] leading-relaxed text-zinc-800">
              {renderedInstructions.text || "(empty)"}
            </pre>
          </div>
          {result ? (
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Response</div>
              <pre className="mt-1 max-h-48 overflow-auto whitespace-pre-wrap rounded-md border border-border bg-zinc-50 px-2 py-1.5 font-mono text-[11px] leading-relaxed text-zinc-800">
                {resultText || "(empty)"}
              </pre>
            </div>
          ) : null}
        </div>
        <footer className="flex items-center gap-2 border-t border-border px-3 py-2">
          {error ? <div className="min-w-0 flex-1 text-[11px] text-rose-700">{error}</div> : <div className="flex-1" />}
          <GhostButton size="xs" disabled={!resultText} onClick={() => void copyResult()}>
            <Copy className="mr-1 h-3 w-3" aria-hidden="true" />
            Copy
          </GhostButton>
          <GhostButton size="xs" tone="accent" disabled={running || Boolean(sample.error)} onClick={() => void runTry()}>
            <Send className="mr-1 h-3 w-3" aria-hidden="true" />
            {running ? "Calling…" : "Try"}
          </GhostButton>
        </footer>
      </section>
    </div>
  );
}
