"use client";

import { useEffect, useId, useRef, useState } from "react";
import generator from "@projectplaner/core/generator";

const { workflowIdFromMermaidDomId } = generator.views;
import { Button } from "../../ui";

interface WorkflowDiagramPanelProps {
  source: string;
  workflowNodeIds: string[];
  selectedId: string | null;
  onSelectNode: (id: string | null) => void;
}

function mermaidNodeElement(target: EventTarget | null): Element | null {
  if (!(target instanceof Element)) {
    return null;
  }
  return target.closest("g.node, .node");
}

function mermaidDomIdFromNode(element: Element): string {
  if (element.id) {
    return element.id;
  }
  const nested = element.querySelector("[id]");
  return nested?.id ?? "";
}

export function WorkflowDiagramPanel({
  source,
  workflowNodeIds,
  selectedId,
  onSelectNode
}: WorkflowDiagramPanelProps) {
  const reactId = useId().replace(/:/g, "");
  const renderId = `wf-mermaid-${reactId}`;
  const svgRootRef = useRef<HTMLDivElement>(null);
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

  useEffect(() => {
    const root = svgRootRef.current;
    if (!root) {
      return;
    }
    for (const element of root.querySelectorAll(".node")) {
      const workflowId = workflowIdFromMermaidDomId(mermaidDomIdFromNode(element), workflowNodeIds);
      const selected = Boolean(selectedId && workflowId === selectedId);
      element.classList.toggle("is-selected", selected);
      if (selected) {
        element.setAttribute("data-selected", "true");
      } else {
        element.removeAttribute("data-selected");
      }
    }
  }, [svgHtml, selectedId, workflowNodeIds]);

  async function copySource(): Promise<void> {
    try {
      await navigator.clipboard.writeText(source);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  }

  function handleDiagramClick(event: React.MouseEvent<HTMLDivElement>): void {
    const nodeEl = mermaidNodeElement(event.target);
    if (!nodeEl) {
      onSelectNode(null);
      return;
    }
    const workflowId = workflowIdFromMermaidDomId(mermaidDomIdFromNode(nodeEl), workflowNodeIds);
    if (workflowId) {
      onSelectNode(workflowId);
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-zinc-50">
      <div className="flex flex-wrap items-center gap-2 border-b border-border bg-white px-3 py-2">
        <div className="text-[10px] font-semibold uppercase tracking-wide text-zinc-700">Diagram</div>
        <p className="text-xs text-muted-foreground">Click a step to inspect it. Edits apply to the graph.</p>
        <div className="ml-auto">
          <Button size="xs" variant="outline" onClick={() => void copySource()}>
            {copied ? "Copied" : "Copy source"}
          </Button>
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
            ref={svgRootRef}
            className="workflow-mermaid mx-auto flex max-w-full cursor-default justify-center [&_svg]:max-w-full"
            dangerouslySetInnerHTML={{ __html: svgHtml }}
            onClick={handleDiagramClick}
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
