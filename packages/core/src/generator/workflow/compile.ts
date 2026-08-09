import {
  findStartNode,
  outgoingEdges,
  resolveNextNodeId,
  slimShapesForReads,
  type WorkflowGraph,
  type WorkflowNode
} from "../../workflow";
import {
  BUILTIN_FUNCTION_DESCRIPTIONS,
  type CompiledFunctionDecl,
  type CompiledStep,
  type CompiledWorkflow,
  type CompileOptions
} from "./types";

function bagRefParams(mapping: Record<string, string> | undefined): Record<string, unknown> {
  if (!mapping) {
    return {};
  }
  const params: Record<string, unknown> = {};
  for (const [argName, bagKey] of Object.entries(mapping)) {
    params[argName] = { $bag: bagKey };
  }
  return params;
}

function rememberFunction(
  seen: Map<string, CompiledFunctionDecl>,
  name: string,
  catalog?: CompiledFunctionDecl[]
): void {
  if (seen.has(name)) {
    return;
  }
  const fromCatalog = catalog?.find((item) => item.name === name);
  seen.set(name, {
    name,
    description:
      fromCatalog?.description ?? BUILTIN_FUNCTION_DESCRIPTIONS[name] ?? undefined
  });
}

function compileAssignSteps(
  node: WorkflowNode,
  seen: Map<string, CompiledFunctionDecl>,
  catalog?: CompiledFunctionDecl[]
): CompiledStep[] {
  const assign = node.data.auto?.assign;
  if (!assign) {
    return [];
  }
  const steps: CompiledStep[] = [];
  const writes = node.data.writes ?? node.data.outputs ?? [];

  if (assign.set && Object.keys(assign.set).length > 0) {
    rememberFunction(seen, "assign", catalog);
    steps.push({
      kind: "function",
      name: "assign",
      params: { set: assign.set, writes },
      resultHint: writes.length ? `writes ${writes.join(", ")}` : undefined,
      nodeId: node.id
    });
  }

  if (assign.pickFirst) {
    rememberFunction(seen, "pickFirst", catalog);
    steps.push({
      kind: "function",
      name: "pickFirst",
      params: { from: assign.pickFirst.from, writes },
      resultHint: writes.length ? `writes ${writes.join(", ")}` : undefined,
      nodeId: node.id
    });
  }

  if (assign.neighborhoodOf) {
    rememberFunction(seen, "neighborhoodOf", catalog);
    steps.push({
      kind: "function",
      name: "neighborhoodOf",
      params: {
        of: assign.neighborhoodOf.of,
        entitiesFrom: assign.neighborhoodOf.entitiesFrom ?? "entities",
        relationsFrom: assign.neighborhoodOf.relationsFrom ?? "relations",
        writes
      },
      resultHint: writes.length ? `writes ${writes.join(", ")}` : undefined,
      nodeId: node.id
    });
  }

  if (assign.composeTaskPrompt) {
    rememberFunction(seen, "composeTaskPrompt", catalog);
    steps.push({
      kind: "function",
      name: "composeTaskPrompt",
      params: {
        taskFrom: assign.composeTaskPrompt.taskFrom,
        contextFrom: assign.composeTaskPrompt.contextFrom,
        writes
      },
      resultHint: writes.length ? `writes ${writes.join(", ")}` : undefined,
      nodeId: node.id
    });
  }

  return steps;
}

function compileNode(
  node: WorkflowNode,
  seen: Map<string, CompiledFunctionDecl>,
  catalog?: CompiledFunctionDecl[]
): CompiledStep[] {
  const title = node.data.title?.trim() || node.id;
  const assignOnly =
    Boolean(node.data.auto?.assign) &&
    !node.data.auto?.loadContext &&
    !node.data.auto?.filter;

  switch (node.type) {
    case "start": {
      return [];
    }
    case "context": {
      if (assignOnly) {
        return compileAssignSteps(node, seen, catalog);
      }
      const load = node.data.auto?.loadContext;
      if (!load) {
        return [{ kind: "instruction", text: title, nodeId: node.id }];
      }
      rememberFunction(seen, "loadContext", catalog);
      return [
        {
          kind: "function",
          name: "loadContext",
          params: {
            mode: load.mode ?? "query",
            queryFrom: load.queryFrom,
            types: load.types,
            limit: load.limit,
            includeRelations: load.includeRelations,
            writes: node.data.writes ?? node.data.outputs ?? []
          },
          resultHint: `Load context (${title})`,
          nodeId: node.id
        }
      ];
    }
    case "transform": {
      if (assignOnly) {
        return compileAssignSteps(node, seen, catalog);
      }
      const filter = node.data.auto?.filter;
      if (!filter) {
        return [{ kind: "instruction", text: title, nodeId: node.id }];
      }
      if (filter.rank === "task_candidates") {
        rememberFunction(seen, "rankTaskCandidates", catalog);
        return [
          {
            kind: "function",
            name: "rankTaskCandidates",
            params: {
              from: filter.from,
              keys: filter.keys,
              writes: node.data.writes ?? node.data.outputs ?? []
            },
            resultHint: `Rank task candidates (${title})`,
            nodeId: node.id
          }
        ];
      }
      rememberFunction(seen, "filter", catalog);
      return [
        {
          kind: "function",
          name: "filter",
          params: {
            from: filter.from,
            keys: filter.keys,
            where: filter.where,
            writes: node.data.writes ?? node.data.outputs ?? []
          },
          resultHint: `Filter (${title})`,
          nodeId: node.id
        }
      ];
    }
    case "tool": {
      const tool = node.data.tool;
      if (!tool?.name) {
        return [{ kind: "instruction", text: title, nodeId: node.id }];
      }
      rememberFunction(seen, tool.name, catalog);
      return [
        {
          kind: "function",
          name: tool.name,
          params: {
            ...bagRefParams(tool.argsFromBag),
            writes: node.data.writes ?? node.data.outputs ?? []
          },
          resultHint: title,
          nodeId: node.id
        }
      ];
    }
    case "write": {
      const write = node.data.write;
      if (!write?.action) {
        return [{ kind: "instruction", text: title, nodeId: node.id }];
      }
      rememberFunction(seen, write.action, catalog);
      return [
        {
          kind: "write",
          action: write.action,
          args: {
            ...(write.defaults ?? {}),
            ...bagRefParams(write.argsFromBag)
          },
          nodeId: node.id
        }
      ];
    }
    case "llm": {
      const llm = node.data.llm ?? {};
      const instructions = llm.instructions?.trim() || title;
      const steps: CompiledStep[] = [
        {
          kind: "llm",
          instructions,
          tools: llm.tools,
          inputKeys: llm.inputKeys ?? node.data.reads,
          outputSchema: llm.outputSchema ?? node.data.writes ?? node.data.outputs,
          nodeId: node.id
        }
      ];
      const outputSchema = llm.outputSchema ?? node.data.writes ?? node.data.outputs ?? [];
      for (const key of outputSchema) {
        steps.push({
          kind: "constraint",
          text: `Return a value for \`${key}\`.`,
          nodeId: node.id
        });
      }
      for (const toolName of llm.tools ?? []) {
        rememberFunction(seen, toolName, catalog);
      }
      return steps;
    }
    case "gate": {
      const gate = node.data.gate ?? {};
      const condition =
        gate.askUserIf ??
        gate.stopIf ??
        (gate.routes ? Object.keys(gate.routes).join(" | ") : "gate");
      return [
        {
          kind: "branch",
          condition,
          whenTrue: gate.askUserIf
            ? "ask the user / pause for input"
            : gate.stopIf
              ? "stop the workflow"
              : undefined,
          whenFalse: "continue on the default route",
          routes: gate.routes,
          nodeId: node.id
        }
      ];
    }
    case "switch": {
      return [
        {
          kind: "branch",
          condition: node.data.switch?.on ?? "route",
          nodeId: node.id
        }
      ];
    }
    case "subworkflow": {
      const ref = node.data.subworkflow?.workflowId ?? "unknown";
      return [{ kind: "subworkflow", workflowRef: ref, nodeId: node.id }];
    }
    case "foreach": {
      return [
        {
          kind: "loop",
          nodeId: node.id,
          note: `foreach ${node.data.foreach?.itemsFrom ?? "items"}`
        }
      ];
    }
    case "map": {
      const map = node.data.map;
      rememberFunction(seen, "map", catalog);
      return [
        {
          kind: "function",
          name: "map",
          params: {
            from: map?.from,
            as: map?.as,
            mode: map?.mode,
            fields: map?.fields ?? []
          },
          resultHint: map ? `map ${map.from} → ${map.as}` : title,
          nodeId: node.id
        }
      ];
    }
    case "fork":
    case "join":
    case "wait":
    case "error_end":
    case "end":
      return [];
    default:
      return [{ kind: "instruction", text: title, nodeId: node.id }];
  }
}

/**
 * Compile a Workflow Step Graph into a linear shared IR for prompt + runtime targets.
 * Walks from start along default edges; gate alternate routes are documented but not expanded.
 */
export function compileWorkflow(graph: WorkflowGraph, opts: CompileOptions = {}): CompiledWorkflow {
  const start = findStartNode(graph);
  const goalText = opts.goal ?? "{{goal}}";
  const steps: CompiledStep[] = [{ kind: "goal", text: goalText }];
  const seenFns = new Map<string, CompiledFunctionDecl>();

  if (!start) {
    return {
      version: 1,
      title: opts.title,
      goal: goalText,
      steps,
      functions: []
    };
  }

  const visited = new Set<string>();
  let currentId: string | null = start.id;
  let guard = 0;
  const maxNodes = Math.max(graph.nodes.length * 2, 50);

  while (currentId && guard < maxNodes) {
    guard += 1;
    if (visited.has(currentId)) {
      break;
    }
    visited.add(currentId);

    const node = graph.nodes.find((item) => item.id === currentId);
    if (!node) {
      break;
    }

    if (node.type === "end" || node.type === "error_end") {
      break;
    }

    steps.push(...compileNode(node, seenFns, opts.functionCatalog));

    if (node.type === "llm") {
      const slim = slimShapesForReads(
        graph,
        node.id,
        node.data.llm?.inputKeys ?? node.data.reads
      );
      if (Object.keys(slim.keys).length > 0) {
        steps.push({
          kind: "constraint",
          text: `Bag shapes for reads: ${JSON.stringify(slim.keys)}`,
          nodeId: node.id
        });
      }
    }

    if (node.type === "gate") {
      const outs = outgoingEdges(graph, node.id);
      for (const edge of outs) {
        const label = edge.label ?? "default";
        if (label !== "default") {
          steps.push({
            kind: "instruction",
            text: `If route "${label}", continue at node \`${edge.target}\`.`,
            nodeId: node.id
          });
        }
      }
    }

    currentId = resolveNextNodeId(graph, node.id, "default");
  }

  if (opts.functionCatalog) {
    for (const decl of opts.functionCatalog) {
      rememberFunction(seenFns, decl.name, opts.functionCatalog);
    }
  }

  return {
    version: 1,
    title: opts.title,
    goal: goalText,
    steps,
    functions: [...seenFns.values()].sort((a, b) => a.name.localeCompare(b.name))
  };
}

export function isCompiledWorkflow(value: unknown): value is CompiledWorkflow {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as CompiledWorkflow).version === 1 &&
    Array.isArray((value as CompiledWorkflow).steps) &&
    Array.isArray((value as CompiledWorkflow).functions)
  );
}
