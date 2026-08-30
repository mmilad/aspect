"use client";

import { useEffect, useMemo, useState } from "react";
import type { WorkflowGraph } from "@projectplaner/core";
import workflow from "@projectplaner/core/workflow";

const { describeRunInput, missingRequiredRunInputs, seedRunInputBag, workflowRunInputs } = workflow.bag;
const { workflowPresetAllowsDrainLlm } = workflow.presets;
import { Copy, Play } from "lucide-react";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  FormLabel,
  Textarea
} from "./ui";

function parseBag(text: string): { keys: Record<string, unknown>; error: string | null } {
  const trimmed = text.trim();
  if (!trimmed) {
    return { keys: {}, error: null };
  }
  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return { keys: {}, error: "Run bag must be a JSON object." };
    }
    return { keys: parsed as Record<string, unknown>, error: null };
  } catch (error) {
    return { keys: {}, error: error instanceof Error ? error.message : "Invalid JSON." };
  }
}

type RunResult = {
  runId: string;
  status?: string;
  kind?: string;
  message?: string;
  note?: string;
  llmConfigured?: boolean;
  turns?: Array<{ turn: number; nodeId: string; schemaKey?: string }>;
  bag?: {
    plan?: unknown;
    stop?: unknown;
    frontierId?: unknown;
    result?: unknown;
    iterations?: unknown;
    decision?: unknown;
    validation?: unknown;
  };
  llmWrites?: string[];
};

export function RunWorkflowDialog({
  flowId,
  flowTitle,
  graph: graphOverride,
  onClose,
  onRan
}: {
  flowId: string;
  flowTitle: string;
  graph?: WorkflowGraph | null;
  onClose: () => void;
  onRan?: (summary: string) => void;
}) {
  const [graph, setGraph] = useState<WorkflowGraph | null>(graphOverride ?? null);
  const [presetKey, setPresetKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(!graphOverride);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [bagText, setBagText] = useState("{}");
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<RunResult | null>(null);

  useEffect(() => {
    if (graphOverride) {
      const inputs = workflowRunInputs(graphOverride);
      setGraph(graphOverride);
      setBagText(JSON.stringify(seedRunInputBag(inputs), null, 2));
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    void (async () => {
      try {
        const response = await fetch(`/api/workflows/${flowId}`);
        const payload = (await response.json()) as {
          graph?: WorkflowGraph;
          entity?: { metadata?: { presetKey?: unknown } };
          error?: string;
        };
        if (!cancelled) {
          const key =
            typeof payload.entity?.metadata?.presetKey === "string" ? payload.entity.metadata.presetKey : null;
          setPresetKey(key);
        }
        if (!response.ok || !payload.graph) {
          throw new Error(payload.error ?? "Could not load workflow graph.");
        }
        if (cancelled) {
          return;
        }
        const inputs = workflowRunInputs(payload.graph);
        setGraph(payload.graph);
        setBagText(JSON.stringify(seedRunInputBag(inputs), null, 2));
      } catch (caught) {
        if (!cancelled) {
          setLoadError(caught instanceof Error ? caught.message : "Could not load workflow graph.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [flowId, graphOverride]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const inputs = useMemo(() => (graph ? workflowRunInputs(graph) : []), [graph]);
  const allowDrain = workflowPresetAllowsDrainLlm(presetKey);
  const parsed = parseBag(bagText);
  const missing = parsed.error ? [] : missingRequiredRunInputs(inputs, parsed.keys);
  const resultText = result
    ? JSON.stringify(
        {
          runId: result.runId,
          status: result.status,
          kind: result.kind,
          message: result.message,
          note: result.note,
          llmConfigured: result.llmConfigured,
          turns: result.turns,
          bag: result.bag,
          llmWrites: result.llmWrites
        },
        null,
        2
      )
    : "";

  async function runNow() {
    if (parsed.error) {
      setError(parsed.error);
      return;
    }
    if (missing.length > 0) {
      setError(`Missing required inputs: ${missing.join(", ")}.`);
      return;
    }
    setRunning(true);
    setError(null);
    setResult(null);
    try {
      const goal =
        typeof parsed.keys.goal === "string" && parsed.keys.goal.trim()
          ? parsed.keys.goal.trim()
          : flowTitle;
      const response = await fetch(`/api/workflows/${flowId}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "run",
          goal,
          bag: parsed.keys,
          drainLlm: allowDrain
        })
      });
      const payload = (await response.json()) as {
        run?: { id: string; status?: string };
        step?: { kind?: string; message?: string; llm?: { outputSchema?: string[] } };
        error?: string;
        note?: string;
        llmConfigured?: boolean;
        turns?: Array<{ turn: number; nodeId: string; schemaKey?: string }>;
        bag?: RunResult["bag"];
      };
      if (!response.ok || !payload.run) {
        throw new Error(payload.error ?? "Run failed.");
      }
      const kind = payload.step?.kind ?? payload.run.status ?? "running";
      const next: RunResult = {
        runId: payload.run.id,
        status: payload.run.status,
        kind,
        message: payload.step?.message,
        note: payload.note,
        llmConfigured: payload.llmConfigured,
        turns: payload.turns,
        bag: payload.bag,
        llmWrites: payload.step?.llm?.outputSchema
      };
      setResult(next);
      onRan?.(
        [`${flowTitle}: run ${payload.run.id} (${kind})`, payload.note].filter(Boolean).join(" — ")
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Run failed.");
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
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) {
          onClose();
        }
      }}
    >
      <DialogContent className="left-auto right-3 top-3 flex max-h-[calc(100vh-1.5rem)] w-[min(28rem,100%)] translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden p-0 sm:rounded-md">
        <DialogHeader className="flex-row items-start gap-2 space-y-0 border-b border-border px-3 py-2 text-left">
          <Play className="mt-0.5 h-4 w-4 shrink-0 text-teal-700" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <DialogTitle className="text-sm">Run · {flowTitle}</DialogTitle>
            <DialogDescription className="font-mono text-[10px]">{flowId}</DialogDescription>
          </div>
        </DialogHeader>
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
          {loading ? <div className="text-xs text-muted-foreground">Loading Start inputs…</div> : null}
          {loadError ? <div className="text-[11px] text-rose-700">{loadError}</div> : null}
          {!loading && !loadError ? (
            <>
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Start inputs
                </div>
                {inputs.length === 0 ? (
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    This graph has no declared run inputs. An empty bag is fine.
                  </p>
                ) : (
                  <ul className="mt-1 space-y-0.5 font-mono text-[11px] text-zinc-700">
                    {inputs.map((input) => (
                      <li key={input.name}>{describeRunInput(input)}</li>
                    ))}
                  </ul>
                )}
              </div>
              {!allowDrain ? (
                <p className="text-[11px] text-muted-foreground">
                  This preset pauses on LLM. Copy runId and resume with llmWrites; hosts must not drain.
                </p>
              ) : null}
              <FormLabel label="Run bag (JSON)">
                <Textarea
                  className="min-h-36 font-mono text-[11px]"
                  value={bagText}
                  onChange={(event) => setBagText(event.target.value)}
                  spellCheck={false}
                />
              </FormLabel>
              {parsed.error ? <div className="text-[11px] text-amber-800">{parsed.error}</div> : null}
              {missing.length > 0 ? (
                <div className="text-[11px] text-amber-800">Required keys: {missing.join(", ")}</div>
              ) : null}
              {result ? (
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Result
                  </div>
                  <pre className="mt-1 max-h-48 overflow-auto whitespace-pre-wrap rounded-md border border-border bg-zinc-50 px-2 py-1.5 font-mono text-[11px] leading-relaxed text-zinc-800">
                    {resultText}
                  </pre>
                </div>
              ) : null}
            </>
          ) : null}
        </div>
        <DialogFooter className="flex-row items-center gap-2 space-x-0 border-t border-border px-3 py-2 sm:justify-end">
          {error ? <div className="min-w-0 flex-1 text-[11px] text-rose-700">{error}</div> : <div className="flex-1" />}
          <Button size="xs" variant="outline" disabled={!resultText} onClick={() => void copyResult()}>
            <Copy className="h-3 w-3" aria-hidden="true" />
            Copy
          </Button>
          <Button
            size="xs"
            disabled={running || loading || Boolean(loadError) || Boolean(parsed.error) || missing.length > 0}
            onClick={() => void runNow()}
          >
            <Play className="h-3 w-3" aria-hidden="true" />
            {running ? "Running…" : "Run"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
