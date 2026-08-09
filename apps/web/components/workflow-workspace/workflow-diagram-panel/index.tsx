"use client";

import { useEffect, useId, useState } from "react";
import { GhostButton } from "../../ui";

interface WorkflowDiagramPanelProps {
  source: string;
}

export function WorkflowDiagramPanel({ source }: WorkflowDiagramPanelProps) {
  const reactId = useId().replace(/:/g, "");
  const renderId = `wf-mermaid-${reactId}`;
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [svgHtml, setSvgHtml] = useState<string>("");

  useEffect(() => {
    let cancelled = false;
    setError(null);
    setSvgHtml("");

    void (async () => {
      try {
        const mermaid = (await import("mermaid")).default;
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: "strict",
          theme: "neutral",
          flowchart: { curve: "basis", htmlLabels: false }
        });
        const { svg } = await mermaid.render(renderId, source);
        if (!cancelled) {
          setSvgHtml(svg);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Mermaid render failed.");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [source, renderId]);

  async function copySource(): Promise<void> {
    try {
      await navigator.clipboard.writeText(source);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-zinc-50">
      <div className="flex flex-wrap items-center gap-2 border-b border-border bg-white px-3 py-2">
        <div className="text-[10px] font-semibold uppercase tracking-wide text-zinc-700">Diagram</div>
        <p className="text-xs text-muted-foreground">Read-only Mermaid view of the step graph.</p>
        <div className="ml-auto">
          <GhostButton size="xs" onClick={() => void copySource()}>
            {copied ? "Copied" : "Copy source"}
          </GhostButton>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-auto p-4">
        {error ? (
          <div className="rounded border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-900">
            {error}
            <pre className="mt-2 whitespace-pre-wrap font-mono text-[10px] text-rose-950/80">{source}</pre>
          </div>
        ) : svgHtml ? (
          <div
            className="mx-auto flex max-w-full justify-center [&_svg]:max-w-full"
            dangerouslySetInnerHTML={{ __html: svgHtml }}
          />
        ) : (
          <div className="text-xs text-muted-foreground">Rendering…</div>
        )}
      </div>
      <details className="border-t border-border bg-white px-3 py-2">
        <summary className="cursor-pointer text-[10px] font-semibold uppercase tracking-wide text-zinc-600">
          Mermaid source
        </summary>
        <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap font-mono text-[10px] leading-relaxed text-zinc-800">
          {source}
        </pre>
      </details>
    </div>
  );
}
