import type { WorkflowEdge, WorkflowGraph } from "../../workflow/graph/types";
import type { WorkflowNode } from "../../workflow/nodes/_shared/types";

const COL_X = 340;
const ROW_Y = 150;
const ORIGIN_X = 40;
const ORIGIN_Y = 80;
const LOOP_Y = 340;
const KNOT_X = 170;
const KNOT_Y0 = 76;
const KNOT_DY = 38;

function isExecEdge(edge: WorkflowEdge): boolean {
  return edge.kind === "next" || edge.kind === "route" || edge.kind === "error" || edge.kind === "depends_on";
}

function isPureDataNode(node: WorkflowNode): boolean {
  return node.type === "reroute" || node.type === "get";
}

function isSpineExit(edge: WorkflowEdge): boolean {
  if (edge.kind === "next") {
    return true;
  }
  if (edge.kind !== "route") {
    return false;
  }
  const pin = edge.sourcePin ?? edge.label ?? "";
  return pin === "true" || pin === "then" || pin === "completed" || pin === "default";
}

function execOut(graph: WorkflowGraph, nodeId: string): WorkflowEdge[] {
  return graph.edges.filter((edge) => edge.source === nodeId && isExecEdge(edge));
}

function rankExecNodes(graph: WorkflowGraph): Map<string, number> {
  const ranks = new Map<string, number>();
  const start = graph.nodes.find((node) => node.type === "start");
  if (!start) {
    return ranks;
  }
  ranks.set(start.id, 0);
  const queue = [start.id];
  const seen = new Set<string>([start.id]);
  while (queue.length > 0) {
    const id = queue.shift()!;
    const rank = ranks.get(id) ?? 0;
    for (const edge of execOut(graph, id)) {
      const target = graph.nodes.find((node) => node.id === edge.target);
      if (!target || isPureDataNode(target) || seen.has(target.id)) {
        continue;
      }
      seen.add(target.id);
      ranks.set(target.id, rank + 1);
      queue.push(target.id);
    }
  }
  return ranks;
}

function spineIds(graph: WorkflowGraph): Set<string> {
  const spine = new Set<string>();
  const start = graph.nodes.find((node) => node.type === "start");
  if (!start) {
    return spine;
  }
  let current: string | undefined = start.id;
  while (current && !spine.has(current)) {
    spine.add(current);
    const outs = execOut(graph, current);
    const next = outs.find(isSpineExit) ?? outs.find((edge) => edge.kind === "next");
    current = next?.target;
  }
  return spine;
}

function placeReroutes(
  graph: WorkflowGraph,
  positions: Map<string, { x: number; y: number }>
): void {
  const knots = graph.nodes.filter((node) => node.type === "reroute");
  const pending = new Set(knots.map((node) => node.id));
  let guard = knots.length + 2;
  while (pending.size > 0 && guard > 0) {
    guard -= 1;
    for (const id of [...pending]) {
      const incoming = graph.edges.find((edge) => edge.kind === "data" && edge.target === id);
      const sourceId = incoming?.source;
      if (sourceId && pending.has(sourceId)) {
        continue;
      }
      const sourcePos = sourceId ? positions.get(sourceId) : { x: ORIGIN_X, y: ORIGIN_Y };
      if (!sourcePos) {
        continue;
      }
      const pinOrder = Object.keys(
        graph.nodes.find((node) => node.id === sourceId)?.data.outputContracts ?? {}
      );
      const siblings = knots
        .filter((node) => {
          const edge = graph.edges.find((item) => item.kind === "data" && item.target === node.id);
          return (edge?.source ?? "") === (sourceId ?? "");
        })
        .slice()
        .sort((a, b) => {
          const pinA =
            graph.edges.find((item) => item.kind === "data" && item.target === a.id)?.sourcePin ?? "";
          const pinB =
            graph.edges.find((item) => item.kind === "data" && item.target === b.id)?.sourcePin ?? "";
          const ia = pinOrder.indexOf(pinA);
          const ib = pinOrder.indexOf(pinB);
          const sa = ia === -1 ? 999 : ia;
          const sb = ib === -1 ? 999 : ib;
          return sa - sb || a.id.localeCompare(b.id);
        })
        .map((node) => node.id);
      const index = Math.max(0, siblings.indexOf(id));
      positions.set(id, {
        x: sourcePos.x + KNOT_X,
        y: sourcePos.y + KNOT_Y0 + index * KNOT_DY
      });
      pending.delete(id);
    }
  }
  for (const id of pending) {
    positions.set(id, { x: ORIGIN_X + KNOT_X, y: ORIGIN_Y + LOOP_Y });
  }
}

/**
 * Layered left-to-right layout: exec spine in one row, false/error loops below,
 * data reroutes in a knot column after their source. Deterministic. Clears waypoints.
 */
export function layoutWorkflowGraph(graph: WorkflowGraph): WorkflowGraph {
  const ranks = rankExecNodes(graph);
  const spine = spineIds(graph);
  const byRank = new Map<number, WorkflowNode[]>();
  const unranked: WorkflowNode[] = [];
  for (const node of graph.nodes) {
    if (isPureDataNode(node)) {
      continue;
    }
    const rank = ranks.get(node.id);
    if (rank === undefined) {
      unranked.push(node);
      continue;
    }
    const bucket = byRank.get(rank) ?? [];
    bucket.push(node);
    byRank.set(rank, bucket);
  }

  const positions = new Map<string, { x: number; y: number }>();
  const ranksSorted = [...byRank.keys()].sort((a, b) => a - b);
  for (const rank of ranksSorted) {
    const column = (byRank.get(rank) ?? []).slice().sort((a, b) => {
      const as = spine.has(a.id) ? 0 : 1;
      const bs = spine.has(b.id) ? 0 : 1;
      return as - bs || a.id.localeCompare(b.id);
    });
    const x = ORIGIN_X + rank * COL_X;
    let spineIndex = 0;
    let loopIndex = 0;
    for (const node of column) {
      const onSpine = spine.has(node.id);
      const y = onSpine
        ? ORIGIN_Y + spineIndex * ROW_Y
        : ORIGIN_Y + LOOP_Y + loopIndex * ROW_Y;
      if (onSpine) {
        spineIndex += 1;
      } else {
        loopIndex += 1;
      }
      positions.set(node.id, { x, y });
    }
  }

  const maxRank = ranksSorted.length > 0 ? Math.max(...ranksSorted) : 0;
  unranked
    .slice()
    .sort((a, b) => a.id.localeCompare(b.id))
    .forEach((node, index) => {
      positions.set(node.id, {
        x: ORIGIN_X + (maxRank + 1) * COL_X,
        y: ORIGIN_Y + index * ROW_Y
      });
    });

  placeReroutes(graph, positions);

  for (const node of graph.nodes) {
    if (!positions.has(node.id)) {
      positions.set(node.id, { ...node.position });
    }
  }

  return {
    ...graph,
    nodes: graph.nodes.map((node) => ({
      ...node,
      position: positions.get(node.id) ?? node.position
    })),
    edges: graph.edges.map((edge) => {
      const { waypoints: _waypoints, ...rest } = edge;
      return rest;
    })
  };
}
