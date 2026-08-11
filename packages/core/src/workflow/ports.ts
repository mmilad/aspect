import type { WorkflowNode, WorkflowNodeData } from "./nodes/_shared/types";

/**
 * Resolve input port → bag key map.
 * Identity fallback: port id = bag key when binding omitted.
 * If no `inputs` catalog, fall back to legacy `reads` as identity ports.
 */
export function resolveInputBindings(node: WorkflowNode): Record<string, string> {
  const ports = Object.keys(node.data.inputs ?? {});
  const bindings = { ...(node.data.inputBindings ?? {}) };

  if (ports.length === 0) {
    const reads = node.data.reads ?? [];
    for (const key of reads) {
      if (!(key in bindings)) {
        bindings[key] = key;
      }
    }
    return bindings;
  }

  for (const portId of ports) {
    if (!(portId in bindings) || !bindings[portId]?.trim()) {
      bindings[portId] = portId;
    }
  }
  return bindings;
}

/**
 * Resolve output port → bag key map.
 * Explicit `writeBindings` (even empty) wins — UI can unregister writes.
 * When omitted: identity from `outputContracts`, else legacy `writes`/`outputs`.
 */
export function resolveWriteBindings(node: WorkflowNode): Record<string, string> {
  if (node.data.writeBindings !== undefined) {
    const bindings: Record<string, string> = {};
    for (const [portId, bagKey] of Object.entries(node.data.writeBindings)) {
      const trimmed = bagKey?.trim();
      if (trimmed) {
        bindings[portId] = trimmed;
      }
    }
    return bindings;
  }

  const ports = Object.keys(node.data.outputContracts ?? {});
  if (ports.length === 0) {
    const writes = node.data.writes ?? node.data.outputs ?? [];
    const bindings: Record<string, string> = {};
    for (const key of writes) {
      bindings[key] = key;
    }
    return bindings;
  }

  return Object.fromEntries(ports.map((portId) => [portId, portId]));
}

/** Bag keys this step reads (derived from input bindings). */
export function derivedReads(node: WorkflowNode): string[] {
  return [...new Set(Object.values(resolveInputBindings(node)))];
}

/** Bag keys this step writes (derived from write bindings). */
export function derivedWrites(node: WorkflowNode): string[] {
  return [...new Set(Object.values(resolveWriteBindings(node)))];
}

/** Map port-keyed values onto bag keys using write bindings. */
export function mapPortValuesToBag(
  node: WorkflowNode,
  portValues: Record<string, unknown>
): Record<string, unknown> {
  const writeBindings = resolveWriteBindings(node);
  const out: Record<string, unknown> = {};
  for (const [portId, value] of Object.entries(portValues)) {
    const bagKey = writeBindings[portId] ?? portId;
    out[bagKey] = value;
  }
  return out;
}

/** Build a port-keyed view of bag values using input bindings. */
export function pickBagByInputPorts(
  node: WorkflowNode,
  bagKeys: Record<string, unknown>,
  portIds?: string[]
): Record<string, unknown> {
  const inputBindings = resolveInputBindings(node);
  const ports = portIds ?? Object.keys(inputBindings);
  const out: Record<string, unknown> = {};
  for (const portId of ports) {
    const bagKey = inputBindings[portId] ?? portId;
    if (bagKey in bagKeys) {
      out[portId] = bagKeys[bagKey];
    }
  }
  return out;
}

/**
 * Fill identity bindings when ports exist but bindings omitted;
 * sync legacy reads/writes from derived bindings.
 */
export function normalizeNodePorts(data: WorkflowNodeData): WorkflowNodeData {
  const node = { data } as WorkflowNode;
  const inputBindings = resolveInputBindings(node);
  const writeBindings = resolveWriteBindings(node);
  const hasInputPorts = Object.keys(data.inputs ?? {}).length > 0 || (data.reads?.length ?? 0) > 0;
  const hasOutputPorts =
    data.writeBindings !== undefined ||
    Object.keys(data.outputContracts ?? {}).length > 0 ||
    (data.writes?.length ?? 0) > 0 ||
    (data.outputs?.length ?? 0) > 0;

  return {
    ...data,
    ...(hasInputPorts ? { inputBindings } : {}),
    ...(hasOutputPorts ? { writeBindings } : {}),
    reads: derivedReads({ ...node, data: { ...data, inputBindings } }),
    writes: derivedWrites({ ...node, data: { ...data, writeBindings } })
  };
}
