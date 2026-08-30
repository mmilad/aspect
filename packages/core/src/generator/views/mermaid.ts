import {
  findNode,
  findStartNode,
  type WorkflowEdge,
  type WorkflowGraph
} from "../../workflow/graph";
import type { WorkflowNode } from "../../workflow/nodes";

export interface WorkflowMermaidOptions {
  /** Optional flowchart title as a Mermaid comment. */
  title?: string;
  /** flowchart direction (default TD). */
  direction?: "TD" | "LR";
}

const MERMAID_RESERVED = new Set(["end", "subgraph", "graph", "flowchart"]);

/** Safe Mermaid node id from workflow node id. */
export function mermaidNodeId(id: string): string {
  const cleaned = id.replace(/[^a-zA-Z0-9_]/g, "_");
  const base = cleaned.length > 0 ? cleaned : "node";
  if (/^[0-9]/.test(base) || MERMAID_RESERVED.has(base.toLowerCase())) {
    return `n_${base}`;
  }
  return base;
}

/** mermaidNodeId → first matching workflow node id (stable over the given list). */
export function mermaidIdLookup(workflowIds: string[]): Map<string, string> {
  const lookup = new Map<string, string>();
  for (const id of workflowIds) {
    const mermaidId = mermaidNodeId(id);
    if (!lookup.has(mermaidId)) {
      lookup.set(mermaidId, id);
    }
  }
  return lookup;
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Resolve a Mermaid SVG node id (`flowchart-n_end-0`, `n_end`, `start-0`, …) back to a workflow node id.
 */
export function workflowIdFromMermaidDomId(domId: string, workflowIds: string[]): string | null {
  if (!domId) {
    return null;
  }
  const lookup = mermaidIdLookup(workflowIds);
  const exact = lookup.get(domId);
  if (exact) {
    return exact;
  }
  const mermaidIds = [...lookup.keys()].sort((a, b) => b.length - a.length);
  for (const mermaidId of mermaidIds) {
    const token = escapeRegex(mermaidId);
    if (new RegExp(`(?:^|[-_])${token}(?:-\\d+)?$`).test(domId)) {
      return lookup.get(mermaidId) ?? null;
    }
  }
  return null;
}

function escapeLabel(text: string): string {
  return text.replace(/["\\]/g, " ").replace(/\s+/g, " ").trim();
}

function nodeTitle(node: WorkflowNode): string {
  return escapeLabel(node.data.title?.trim() || node.id);
}

function nodeDeclaration(node: WorkflowNode): string {
  const id = mermaidNodeId(node.id);
  const title = nodeTitle(node);
  if (node.type === "branch" || node.type === "switch") {
    return `${id}{"${title}"}`;
  }
  if (node.type === "start" || node.type === "end" || node.type === "error_end") {
    return `${id}(["${title}"])`;
  }
  return `${id}["${title}"]`;
}

function edgeLine(edge: WorkflowEdge): string {
  const src = mermaidNodeId(edge.source);
  const tgt = mermaidNodeId(edge.target);
  const label =
    edge.kind === "route" || edge.kind === "error" || edge.kind === "depends_on"
      ? escapeLabel(edge.label ?? edge.kind)
      : edge.label
        ? escapeLabel(edge.label)
        : "";
  if (label) {
    return `${src} -->|"${label}"| ${tgt}`;
  }
  return `${src} --> ${tgt}`;
}

/**
 * Deterministic Mermaid flowchart source for a workflow graph (read-only view / docs).
 */
export function renderWorkflowMermaid(graph: WorkflowGraph, options: WorkflowMermaidOptions = {}): string {
  const direction = options.direction ?? "TD";
  const lines: string[] = [];

  if (options.title?.trim()) {
    lines.push(`%% ${escapeLabel(options.title)}`);
  }
  lines.push(`flowchart ${direction}`);

  const start = findStartNode(graph);
  if (!start) {
    lines.push('  empty(["(no start node)"])');
    return lines.join("\n");
  }

  // Emit every node once (stable order: start first, then remaining by id)
  const ordered = [
    start,
    ...graph.nodes.filter((node) => node.id !== start.id).sort((a, b) => a.id.localeCompare(b.id))
  ];
  for (const node of ordered) {
    if (!findNode(graph, node.id)) {
      continue;
    }
    lines.push(`  ${nodeDeclaration(node)}`);
  }

  // Edges: next / route / error / depends_on (skip unknown), stable by id
  const edges = [...graph.edges].sort((a, b) => a.id.localeCompare(b.id));
  for (const edge of edges) {
    if (edge.kind === "data") {
      continue;
    }
    if (!findNode(graph, edge.source) || !findNode(graph, edge.target)) {
      continue;
    }
    lines.push(`  ${edgeLine(edge)}`);
  }

  return lines.join("\n");
}
