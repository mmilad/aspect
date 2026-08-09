import {
  findNode,
  findStartNode,
  getNodeWrites,
  outgoingByKind,
  outgoingEdges,
  type WorkflowEdge,
  type WorkflowGraph,
  type WorkflowNode
} from "./schema";

export interface WorkflowStoryOptions {
  /** Flow title shown in the header. */
  title?: string;
  /** Semantic when/why text (flow body/summary). */
  description?: string;
  /** Max nesting depth for branch/switch arms (default 8). */
  maxDepth?: number;
}

function nodeTitle(node: WorkflowNode): string {
  return node.data.title?.trim() || node.id;
}

function formatKeyList(keys: string[] | undefined): string {
  if (!keys?.length) {
    return "";
  }
  return keys.map((key) => `\`${key}\``).join(", ");
}

function describeNode(node: WorkflowNode): string {
  const title = nodeTitle(node);
  const reads = formatKeyList(node.data.reads);
  const writes = formatKeyList(getNodeWrites(node));

  switch (node.type) {
    case "start": {
      const writesText = writes ? ` Bag starts with ${writes}.` : "";
      return `Start (“${title}”).${writesText}`;
    }
    case "end":
    case "error_end":
      return `End (“${title}”)${node.type === "error_end" ? " as error" : ""}.`;
    case "context": {
      const load = node.data.auto?.loadContext;
      if (load?.mode === "all") {
        return `Load context (“${title}”): load entities${load.types?.length ? ` of type ${load.types.join(", ")}` : ""}${writes ? ` into ${writes}` : ""}.`;
      }
      if (load?.queryFrom) {
        return `Look up (“${title}”): query from bag ${formatKeyList([load.queryFrom])}${load.types?.length ? ` among ${load.types.join(", ")}` : ""}${writes ? `; store in ${writes}` : ""}.`;
      }
      return `Load context (“${title}”).`;
    }
    case "map": {
      const map = node.data.map;
      if (!map) {
        return `Map (“${title}”).`;
      }
      const fields = map.fields.map((field) => field.as).join(", ");
      return `Project (“${title}”): take \`${map.from}\` → \`${map.as}\` keeping ${fields || "fields"}.`;
    }
    case "transform": {
      const filter = node.data.auto?.filter;
      if (filter?.rank === "task_candidates") {
        return `Rank tasks (“${title}”)${writes ? ` into ${writes}` : ""}.`;
      }
      if (filter?.from) {
        return `Filter (“${title}”) bag \`${filter.from}\`${writes ? ` → ${writes}` : ""}.`;
      }
      if (node.data.auto?.assign) {
        return `Assign (“${title}”)${writes ? ` writing ${writes}` : ""}.`;
      }
      return `Transform (“${title}”).`;
    }
    case "llm": {
      const inputs = formatKeyList(node.data.llm?.inputKeys ?? node.data.reads);
      const outputs = formatKeyList(node.data.llm?.outputSchema ?? getNodeWrites(node));
      return `LLM decide (“${title}”)${inputs ? `: reads ${inputs}` : ""}${outputs ? `; writes ${outputs}` : ""}. Instructions are templated from the bag at pause.`;
    }
    case "tool": {
      const name = node.data.tool?.name ?? "tool";
      return `Call tool \`${name}\` (“${title}”)${writes ? `; writes ${writes}` : ""}.`;
    }
    case "write": {
      const action = node.data.write?.action ?? "write";
      const args = node.data.write?.argsFromBag
        ? Object.entries(node.data.write.argsFromBag)
            .map(([arg, key]) => `${arg}←\`${key}\``)
            .join(", ")
        : "";
      return `Write \`${action}\` (“${title}”)${args ? ` using ${args}` : ""}${writes ? `; writes ${writes}` : ""}.`;
    }
    case "branch": {
      const on = node.data.branch?.on ?? "route";
      return `Branch on \`${on}\` (“${title}”).`;
    }
    case "switch": {
      const on = node.data.switch?.on ?? "type";
      const def = node.data.switch?.defaultLabel ?? "default";
      return `Switch on \`${on}\` (“${title}”, default \`${def}\`).`;
    }
    case "gate":
      return `Gate (“${title}”).`;
    case "fork":
      return `Fork (“${title}”) into parallel arms.`;
    case "join":
      return `Join (“${title}”) waiting for parallel arms.`;
    case "foreach": {
      const items = node.data.foreach?.itemsFrom ?? "items";
      return `For each item in \`${items}\` (“${title}”).`;
    }
    case "subworkflow": {
      const ref = node.data.subworkflow?.workflowId || "(unset)";
      const inputMap = node.data.subworkflow?.inputMap
        ? Object.entries(node.data.subworkflow.inputMap)
            .map(([to, from]) => `\`${from}\`→\`${to}\``)
            .join(", ")
        : "";
      const outputMap = node.data.subworkflow?.outputMap
        ? Object.entries(node.data.subworkflow.outputMap)
            .map(([to, from]) => `\`${from}\`→\`${to}\``)
            .join(", ")
        : "";
      return `Run subworkflow \`${ref}\` (“${title}”)${inputMap ? `; uses ${inputMap}` : ""}${outputMap ? `; injects ${outputMap}` : ""}.`;
    }
    case "wait":
      return `Wait (“${title}”).`;
    default:
      return `Step (“${title}”, ${node.type}).`;
  }
}

function indent(level: number): string {
  return "  ".repeat(level);
}

function routeEdges(graph: WorkflowGraph, nodeId: string): WorkflowEdge[] {
  return outgoingByKind(graph, nodeId, "route");
}

function nextEdges(graph: WorkflowGraph, nodeId: string): WorkflowEdge[] {
  return outgoingByKind(graph, nodeId, "next");
}

function walk(
  graph: WorkflowGraph,
  nodeId: string,
  level: number,
  lines: string[],
  visited: Set<string>,
  maxDepth: number
): void {
  if (level > maxDepth) {
    lines.push(`${indent(level)}- (story depth limit)`);
    return;
  }
  if (visited.has(nodeId)) {
    lines.push(`${indent(level)}- (continues at “${nodeId}”)`);
    return;
  }
  visited.add(nodeId);

  const node = findNode(graph, nodeId);
  if (!node) {
    lines.push(`${indent(level)}- (missing node ${nodeId})`);
    return;
  }

  if (node.type === "end" || node.type === "error_end") {
    lines.push(`${indent(level)}- ${describeNode(node)}`);
    return;
  }

  if (node.type === "branch" || node.type === "switch") {
    lines.push(`${indent(level)}- ${describeNode(node)}`);
    const routes = routeEdges(graph, nodeId);
    if (routes.length === 0) {
      lines.push(`${indent(level + 1)}- (no route arms)`);
      return;
    }
    for (const edge of routes) {
      const label = edge.label ?? "default";
      lines.push(`${indent(level + 1)}- if \`${label}\`:`);
      walk(graph, edge.target, level + 2, lines, new Set(visited), maxDepth);
    }
    return;
  }

  lines.push(`${indent(level)}- ${describeNode(node)}`);

  const nexts = nextEdges(graph, nodeId);
  const allOut = outgoingEdges(graph, nodeId).filter((edge) => edge.kind !== "depends_on" && edge.kind !== "error");
  const follow = nexts.length > 0 ? nexts : allOut.filter((edge) => edge.kind === "next");

  if (node.type === "fork") {
    for (const edge of follow) {
      lines.push(`${indent(level + 1)}- arm:`);
      walk(graph, edge.target, level + 2, lines, new Set(visited), maxDepth);
    }
    return;
  }

  for (const edge of follow) {
    walk(graph, edge.target, level, lines, visited, maxDepth);
  }
}

/**
 * Deterministic human/agent story of a workflow graph (branch-aware bullets).
 * Semantic description is optional header; steps are derived from the graph.
 */
export function renderWorkflowStory(graph: WorkflowGraph, options: WorkflowStoryOptions = {}): string {
  const maxDepth = options.maxDepth ?? 8;
  const lines: string[] = [];

  if (options.title?.trim()) {
    lines.push(`# ${options.title.trim()}`);
    lines.push("");
  }
  if (options.description?.trim()) {
    lines.push(options.description.trim());
    lines.push("");
  }

  lines.push("You are running this workflow:");
  lines.push("");

  const start = findStartNode(graph);
  if (!start) {
    lines.push("- (workflow has no start node)");
    return lines.join("\n");
  }

  walk(graph, start.id, 0, lines, new Set(), maxDepth);
  return lines.join("\n");
}
