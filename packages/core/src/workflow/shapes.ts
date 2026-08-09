import type {
  BagShape,
  BagShapeCatalogRef,
  WorkflowGraph,
  WorkflowMapConfig,
  WorkflowNode
} from "./types";

function getNodeWrites(node: WorkflowNode): string[] {
  return node.data.writes ?? node.data.outputs ?? [];
}

function findNode(graph: WorkflowGraph, nodeId: string): WorkflowNode | undefined {
  return graph.nodes.find((node) => node.id === nodeId);
}

function outgoingEdges(graph: WorkflowGraph, nodeId: string) {
  return graph.edges.filter((edge) => edge.source === nodeId);
}

const STRING: BagShape = { kind: "primitive", type: "string" };
const NUMBER: BagShape = { kind: "primitive", type: "number" };
const BOOLEAN: BagShape = { kind: "primitive", type: "boolean" };
const NULLABLE_STRING: BagShape = { kind: "primitive", type: "string" };

function objectShape(fields: Record<string, BagShape>, ref?: string): BagShape {
  return { kind: "object", fields, ...(ref ? { ref } : {}) };
}

/** Builtin shape catalog (stable refs for UI + slim AI). */
export const BAG_SHAPE_CATALOG: Record<BagShapeCatalogRef, BagShape> = {
  Entity: objectShape(
    {
      id: STRING,
      type: STRING,
      key: NULLABLE_STRING,
      title: STRING,
      status: STRING,
      summary: STRING
    },
    "Entity"
  ),
  EntityRelation: objectShape(
    {
      id: STRING,
      from: STRING,
      to: STRING,
      type: STRING,
      primary: BOOLEAN,
      label: NULLABLE_STRING
    },
    "EntityRelation"
  ),
  RankedTaskCandidate: objectShape(
    {
      id: STRING,
      type: STRING,
      key: NULLABLE_STRING,
      title: STRING,
      status: STRING,
      summary: STRING,
      priority: STRING,
      workScore: NUMBER
    },
    "RankedTaskCandidate"
  ),
  Json: { kind: "any" }
};

export function resolveBagShape(shape: BagShape | undefined): BagShape {
  if (!shape) {
    return { kind: "unknown" };
  }
  if (shape.kind === "ref") {
    const catalog = BAG_SHAPE_CATALOG[shape.ref as BagShapeCatalogRef];
    return catalog ?? { kind: "unknown" };
  }
  if (shape.kind === "array") {
    return { kind: "array", items: resolveBagShape(shape.items) };
  }
  if (shape.kind === "object") {
    const fields: Record<string, BagShape> = {};
    for (const [key, value] of Object.entries(shape.fields)) {
      fields[key] = resolveBagShape(value);
    }
    return { kind: "object", fields, ...(shape.ref ? { ref: shape.ref } : {}) };
  }
  return shape;
}

export function arrayOfRef(ref: BagShapeCatalogRef): BagShape {
  return { kind: "array", items: { kind: "ref", ref } };
}

export function refShape(ref: BagShapeCatalogRef): BagShape {
  return { kind: "ref", ref };
}

/** List field paths available on a shape (one level + nested via resolve). */
export function listShapePaths(shape: BagShape | undefined, prefix = ""): string[] {
  const resolved = resolveBagShape(shape);
  if (resolved.kind === "array") {
    return listShapePaths(resolved.items, prefix);
  }
  if (resolved.kind !== "object") {
    return prefix ? [prefix] : [];
  }
  const paths: string[] = [];
  for (const [key, field] of Object.entries(resolved.fields)) {
    const path = prefix ? `${prefix}.${key}` : key;
    paths.push(path);
    const nested = resolveBagShape(field);
    if (nested.kind === "object") {
      paths.push(...listShapePaths(nested, path));
    }
  }
  return paths;
}

export function shapeAtPath(shape: BagShape | undefined, path: string): BagShape {
  if (!path) {
    return resolveBagShape(shape);
  }
  let current = resolveBagShape(shape);
  if (current.kind === "array") {
    current = resolveBagShape(current.items);
  }
  for (const part of path.split(".").filter(Boolean)) {
    if (current.kind !== "object" || !(part in current.fields)) {
      return { kind: "unknown" };
    }
    current = resolveBagShape(current.fields[part]);
    if (current.kind === "array") {
      current = resolveBagShape(current.items);
    }
  }
  return current;
}

export function deriveMapOutputShape(map: WorkflowMapConfig, sourceShape: BagShape | undefined): BagShape {
  const fields: Record<string, BagShape> = {};
  for (const field of map.fields) {
    fields[field.as] = shapeAtPath(sourceShape, field.from);
  }
  const projected = objectShape(fields);
  const resolvedSource = resolveBagShape(sourceShape);
  const mode = map.mode ?? (resolvedSource.kind === "array" ? "array" : "object");
  return mode === "array" ? { kind: "array", items: projected } : projected;
}

function mergeShapes(a: BagShape | undefined, b: BagShape | undefined): BagShape {
  if (!a) {
    return b ?? { kind: "unknown" };
  }
  if (!b) {
    return a;
  }
  const left = resolveBagShape(a);
  const right = resolveBagShape(b);
  if (left.kind === "unknown") {
    return right;
  }
  if (right.kind === "unknown") {
    return left;
  }
  if (left.kind === "ref" && right.kind === "ref" && left.ref === right.ref) {
    return left;
  }
  if (left.kind === "array" && right.kind === "array") {
    return { kind: "array", items: mergeShapes(left.items, right.items) };
  }
  if (left.kind === "object" && right.kind === "object") {
    const fields: Record<string, BagShape> = { ...left.fields };
    for (const [key, value] of Object.entries(right.fields)) {
      fields[key] = key in fields ? mergeShapes(fields[key], value) : value;
    }
    return objectShape(fields, left.ref ?? right.ref);
  }
  if (JSON.stringify(left) === JSON.stringify(right)) {
    return left;
  }
  return { kind: "any" };
}

/** Infer shapes this node publishes (defaults + contracts + map/foreach/context). */
export function inferNodeOutputShapes(node: WorkflowNode): Record<string, BagShape> {
  const out: Record<string, BagShape> = {};

  for (const key of getNodeWrites(node)) {
    const contractShape = node.data.outputContracts?.[key]?.shape;
    out[key] = contractShape ? resolveBagShape(contractShape) : { kind: "unknown" };
  }

  if (node.type === "start") {
    for (const key of getNodeWrites(node)) {
      if (key === "goal") {
        out.goal = STRING;
      }
    }
  }

  if (node.type === "context" && node.data.auto?.loadContext) {
    const load = node.data.auto.loadContext;
    const writes = getNodeWrites(node);
    const entityKey = writes[0] ?? "matches";
    if (!node.data.outputContracts?.[entityKey]?.shape) {
      out[entityKey] = arrayOfRef("Entity");
    }
    if (load.includeRelations) {
      const relationKey = writes.find((key) => key === "relations") ?? (writes.length > 1 ? writes[1] : undefined);
      if (relationKey && !node.data.outputContracts?.[relationKey]?.shape) {
        out[relationKey] = arrayOfRef("EntityRelation");
      }
    }
  }

  if (node.type === "transform") {
    const filter = node.data.auto?.filter;
    if (filter?.rank === "task_candidates") {
      const writes = getNodeWrites(node);
      const candidatesKey = writes[0] ?? "candidates";
      if (!node.data.outputContracts?.[candidatesKey]?.shape) {
        out[candidatesKey] = arrayOfRef("RankedTaskCandidate");
      }
      if (writes.includes("hasCandidates")) {
        out.hasCandidates = BOOLEAN;
      }
    }
  }

  if (node.type === "map" && node.data.map) {
    const map = node.data.map;
    // Source shape unknown here; bagViewAtNode fills when propagating. Locally use unknown item.
    out[map.as] = deriveMapOutputShape(map, { kind: "unknown" });
  }

  if (node.type === "foreach" && node.data.foreach?.collect) {
    const collect = node.data.foreach.collect;
    out[collect.as] = { kind: "array", items: { kind: "unknown" } };
  }

  if (node.type === "join") {
    const as = node.data.join?.merge?.as ?? "branchResults";
    out[as] = { kind: "any" };
  }

  if (node.type === "subworkflow" && node.data.subworkflow?.outputMap) {
    for (const parentKey of Object.keys(node.data.subworkflow.outputMap)) {
      if (!out[parentKey]) {
        out[parentKey] = { kind: "unknown" };
      }
    }
  }

  // Explicit contracts always win.
  for (const [key, contract] of Object.entries(node.data.outputContracts ?? {})) {
    if (contract.shape) {
      out[key] = resolveBagShape(contract.shape);
    }
  }

  return out;
}

/**
 * Bag key → shape available when entering `nodeId` (upstream writes),
 * plus foreach item/index bindings when the node is foreach (for body authoring UI).
 */
export function bagViewAtNode(graph: WorkflowGraph, nodeId: string): Record<string, BagShape> {
  const target = findNode(graph, nodeId);
  if (!target) {
    return {};
  }

  const view: Record<string, BagShape> = {};
  const visited = new Set<string>();
  const queue: string[] = [];

  // Walk reverse: collect all nodes that can reach target via next/route/depends_on.
  const reverse = new Map<string, string[]>();
  for (const edge of graph.edges) {
    if (edge.kind === "next" || edge.kind === "route" || edge.kind === "depends_on") {
      const list = reverse.get(edge.target) ?? [];
      list.push(edge.source);
      reverse.set(edge.target, list);
    }
  }

  queue.push(nodeId);
  while (queue.length > 0) {
    const id = queue.shift()!;
    if (visited.has(id)) {
      continue;
    }
    visited.add(id);
    for (const source of reverse.get(id) ?? []) {
      queue.push(source);
    }
  }

  // Apply writes in a rough topological order: start first, then BFS forward among visited.
  const start = graph.nodes.find((node) => node.type === "start");
  const order: string[] = [];
  const seenOrder = new Set<string>();
  const forwardQueue = start && visited.has(start.id) ? [start.id] : [...visited];
  while (forwardQueue.length > 0) {
    const id = forwardQueue.shift()!;
    if (seenOrder.has(id) || !visited.has(id)) {
      continue;
    }
    seenOrder.add(id);
    if (id !== nodeId) {
      order.push(id);
    }
    for (const edge of outgoingEdges(graph, id)) {
      if (edge.kind === "next" || edge.kind === "route" || edge.kind === "depends_on") {
        forwardQueue.push(edge.target);
      }
    }
  }

  for (const id of order) {
    const node = findNode(graph, id);
    if (!node) {
      continue;
    }
    let outputs = inferNodeOutputShapes(node);
    if (node.type === "map" && node.data.map) {
      const sourceShape = view[node.data.map.from];
      outputs = {
        ...outputs,
        [node.data.map.as]: deriveMapOutputShape(node.data.map, sourceShape)
      };
    }
    if (node.type === "transform") {
      const filter = node.data.auto?.filter;
      if (filter && filter.rank !== "task_candidates") {
        const fromShape = view[filter.from];
        const writes = getNodeWrites(node);
        const outKey = writes[0];
        if (outKey && !node.data.outputContracts?.[outKey]?.shape) {
          outputs[outKey] = fromShape ?? { kind: "unknown" };
        }
      }
      const pick = node.data.auto?.assign?.pickFirst;
      if (pick) {
        const fromShape = resolveBagShape(view[pick.from]);
        const writes = getNodeWrites(node);
        const outKey = writes[0];
        if (outKey && fromShape.kind === "array") {
          outputs[outKey] = fromShape.items;
        }
      }
    }
    for (const [key, shape] of Object.entries(outputs)) {
      view[key] = mergeShapes(view[key], shape);
    }
  }

  // Foreach: expose item/index for UI when inspecting the foreach node itself.
  if (target.type === "foreach" && target.data.foreach) {
    const itemsFrom = target.data.foreach.itemsFrom;
    const itemsShape = resolveBagShape(view[itemsFrom]);
    const itemKey = target.data.foreach.itemKey ?? "item";
    const indexKey = target.data.foreach.indexKey ?? "index";
    view[itemKey] =
      itemsShape.kind === "array" ? resolveBagShape(itemsShape.items) : { kind: "unknown" };
    view[indexKey] = NUMBER;
  }

  return view;
}

/** Soft warnings when declared input shapes disagree with upstream. */
export function warnShapeMismatches(graph: WorkflowGraph): string[] {
  const warnings: string[] = [];
  for (const node of graph.nodes) {
    const view = bagViewAtNode(graph, node.id);
    for (const [key, contract] of Object.entries(node.data.inputs ?? {})) {
      if (!contract.shape) {
        continue;
      }
      const upstream = view[key];
      if (!upstream || upstream.kind === "unknown") {
        warnings.push(`Node ${node.id} expects shape for \`${key}\`, but upstream does not guarantee it.`);
        continue;
      }
      const expected = serializeShapeSlim(contract.shape);
      const actual = serializeShapeSlim(upstream);
      if (expected !== actual && expected !== "any" && actual !== "any" && actual !== "unknown") {
        warnings.push(`Node ${node.id} input \`${key}\` expects ${expected}, upstream has ${actual}.`);
      }
    }
  }
  return warnings;
}

export function serializeShapeSlim(shape: BagShape | undefined): string {
  const resolved = resolveBagShape(shape);
  switch (resolved.kind) {
    case "unknown":
      return "unknown";
    case "any":
      return "any";
    case "primitive":
      return resolved.type;
    case "ref":
      return resolved.ref;
    case "array": {
      const items = serializeShapeSlim(resolved.items);
      return `${items}[]`;
    }
    case "object": {
      if (resolved.ref) {
        return resolved.ref;
      }
      const keys = Object.keys(resolved.fields).sort();
      if (keys.length === 0) {
        return "object";
      }
      return `object{${keys.join(",")}}`;
    }
    default:
      return "unknown";
  }
}

export function serializeBagViewSlim(view: Record<string, BagShape>): { keys: Record<string, string> } {
  const keys: Record<string, string> = {};
  for (const [key, shape] of Object.entries(view)) {
    keys[key] = serializeShapeSlim(shape);
  }
  return { keys };
}

/** Slim shapes for only the keys an LLM node declares in reads/inputKeys. */
export function slimShapesForReads(
  graph: WorkflowGraph,
  nodeId: string,
  reads: string[] | undefined
): { keys: Record<string, string> } {
  const view = bagViewAtNode(graph, nodeId);
  if (!reads || reads.length === 0) {
    return { keys: {} };
  }
  const keys: Record<string, string> = {};
  for (const key of reads) {
    if (key in view) {
      keys[key] = serializeShapeSlim(view[key]);
    } else {
      keys[key] = "unknown";
    }
  }
  return { keys };
}

export function isRecordShape(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Parse BagShape from JSON (lenient). */
export function parseBagShape(raw: unknown): BagShape | undefined {
  if (!isRecordShape(raw) || typeof raw.kind !== "string") {
    return undefined;
  }
  switch (raw.kind) {
    case "unknown":
    case "any":
      return { kind: raw.kind };
    case "primitive":
      if (
        raw.type === "string" ||
        raw.type === "number" ||
        raw.type === "boolean" ||
        raw.type === "null"
      ) {
        return { kind: "primitive", type: raw.type };
      }
      return undefined;
    case "ref":
      return typeof raw.ref === "string" ? { kind: "ref", ref: raw.ref } : undefined;
    case "array": {
      const items = parseBagShape(raw.items) ?? { kind: "unknown" };
      return { kind: "array", items };
    }
    case "object": {
      if (!isRecordShape(raw.fields)) {
        return { kind: "object", fields: {}, ref: typeof raw.ref === "string" ? raw.ref : undefined };
      }
      const fields: Record<string, BagShape> = {};
      for (const [key, value] of Object.entries(raw.fields)) {
        const parsed = parseBagShape(value);
        if (parsed) {
          fields[key] = parsed;
        }
      }
      return {
        kind: "object",
        fields,
        ref: typeof raw.ref === "string" ? raw.ref : undefined
      };
    }
    default:
      return undefined;
  }
}
