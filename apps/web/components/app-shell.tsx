"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowUpToLine, ChevronRight, GitFork, HelpCircle, Network, PanelRight, Search, Workflow } from "lucide-react";
import {
  Background,
  Controls,
  Handle,
  MiniMap,
  Position,
  ReactFlow,
  useNodesState,
  type Edge,
  type Node,
  type OnNodesChange,
  type NodeProps
} from "@xyflow/react";
import {
  detectDraftConflicts,
  focusGraph,
  getNodeTemplate,
  readTemplateValue,
  type ProjectNode,
  type ProjectPlanSnapshot
} from "@projectplaner/core";
import { Badge } from "./badge";
import { cn } from "../lib/utils";

interface AppShellProps {
  snapshot: ProjectPlanSnapshot;
  graphOnly?: boolean;
}

const statusTone: Record<string, string> = {
  not_implemented: "border-slate-300 bg-slate-50",
  in_work: "border-cyan-400 bg-cyan-50",
  implemented: "border-emerald-400 bg-emerald-50",
  planned: "border-slate-300 bg-slate-50",
  active: "border-teal-400 bg-teal-50",
  blocked: "border-rose-400 bg-rose-50",
  accepted: "border-amber-400 bg-amber-50",
  answered: "border-emerald-400 bg-emerald-50",
  archived: "border-stone-300 bg-stone-100"
};

function NodeCard({ data }: NodeProps<Node<{ node: ProjectNode; isCenter: boolean }>>) {
  const node = data.node;

  return (
    <div
      className={cn(
        "w-72 border bg-white/95 px-3.5 py-3 shadow-[0_10px_30px_rgba(15,23,42,0.10)] backdrop-blur",
        statusTone[node.status],
        data.isCenter && "scale-[1.02] ring-2 ring-teal-600"
      )}
    >
      <Handle type="target" position={Position.Left} />
      <div className="flex items-center justify-between gap-2">
        <Badge tone={node.type}>{node.type.replace("_", " ")}</Badge>
        <span className="truncate text-xs text-muted-foreground">{node.status.replace("_", " ")}</span>
      </div>
      <div className="mt-2 text-[15px] font-semibold leading-5 text-zinc-950">{node.title}</div>
      <div className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">{node.summary}</div>
      <Handle type="source" position={Position.Right} />
    </div>
  );
}

const nodeTypes = { projectNode: NodeCard };

function getAncestors(node: ProjectNode, nodes: ProjectNode[]): ProjectNode[] {
  const byId = new Map(nodes.map((item) => [item.id, item]));
  const ancestors: ProjectNode[] = [];
  let cursor: ProjectNode | undefined = node;

  while (cursor) {
    ancestors.unshift(cursor);
    cursor = cursor.parentId ? byId.get(cursor.parentId) : undefined;
  }

  return ancestors;
}

export function AppShell({ snapshot, graphOnly = false }: AppShellProps) {
  const rootNode = snapshot.nodes[0];
  const [centerId, setCenterId] = useState(rootNode?.id);
  const [selectedId, setSelectedId] = useState(rootNode?.id);
  const [query, setQuery] = useState("");

  const centerNode = snapshot.nodes.find((node) => node.id === centerId) ?? rootNode;
  const selectedNode = snapshot.nodes.find((node) => node.id === selectedId) ?? centerNode;
  const parentNode = centerNode?.parentId ? snapshot.nodes.find((node) => node.id === centerNode.parentId) : null;
  const breadcrumbs = useMemo(() => getAncestors(centerNode, snapshot.nodes), [centerNode, snapshot.nodes]);
  const graph = useMemo(() => focusGraph(centerNode.id, snapshot.nodes, snapshot.relations), [centerNode.id, snapshot]);

  const childIds = new Set(graph.nodes.filter((node) => node.parentId === centerNode.id).map((node) => node.id));
  const relationIds = new Set(graph.relations.map((relation) => `${relation.sourceNodeId}:${relation.targetNodeId}`));
  const hierarchyEdges: Edge[] = graph.nodes
    .filter((node) => node.parentId === centerNode.id && !relationIds.has(`${centerNode.id}:${node.id}`))
    .map((node) => ({
      id: `tree-${centerNode.id}-${node.id}`,
      source: centerNode.id,
      target: node.id,
      label: "plans",
      type: "smoothstep",
      style: { stroke: "#94a3b8", strokeDasharray: "4 4" }
    }));

  const computedNodes: Node<{ node: ProjectNode; isCenter: boolean }>[] = graph.nodes.map((node, index) => {
    const layout = node.metadata.layout as { x?: number; y?: number } | undefined;
    const isCenter = node.id === centerNode.id;
    const childIndex = Array.from(childIds).indexOf(node.id);
    const childCount = Math.max(childIds.size, 1);
    const childY = (childIndex - (childCount - 1) / 2) * 170;
    const relatedIndex = Math.max(0, index - childIds.size);

    return {
      id: node.id,
      type: "projectNode",
      position: {
        x: layout?.x ?? (isCenter ? 0 : childIds.has(node.id) ? 430 : -390),
        y: layout?.y ?? (isCenter ? 0 : childIds.has(node.id) ? childY : (relatedIndex - 1) * 160)
      },
      data: { node, isCenter }
    };
  });
  const [flowNodes, setFlowNodes, onNodesChange] = useNodesState(computedNodes);

  useEffect(() => {
    setFlowNodes(computedNodes);
  }, [centerNode.id, snapshot.nodes, setFlowNodes]);

  const relationEdges: Edge[] = graph.relations.map((relation) => ({
    id: relation.id,
    source: relation.sourceNodeId,
    target: relation.targetNodeId,
    label: relation.label ?? relation.type,
    type: "smoothstep",
    animated: relation.type === "blocks" || relation.type === "conflicts_with",
    style: { stroke: relation.type === "conflicts_with" ? "#be123c" : "#0f766e" }
  }));

  const flowEdges = [...hierarchyEdges, ...relationEdges];
  const incoming = snapshot.relations.filter((relation) => relation.targetNodeId === selectedNode.id);
  const outgoing = snapshot.relations.filter((relation) => relation.sourceNodeId === selectedNode.id);
  const selectedTasks = snapshot.tasks.filter((task) => task.nodeId === selectedNode.id);
  const searchMatches = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) {
      return [];
    }

    return snapshot.nodes
      .filter((node) => node.title.toLowerCase().includes(term) || node.path.toLowerCase().includes(term))
      .slice(0, 8);
  }, [query, snapshot.nodes]);
  const draftSummaries = snapshot.draftPlans.map((draft) => ({
    draft,
    conflicts: detectDraftConflicts({
      changes: snapshot.draftChanges.filter((change) => change.draftPlanId === draft.id),
      nodes: snapshot.nodes,
      relations: snapshot.relations
    })
  }));

  return (
    <main className="flex min-h-screen flex-col bg-background">
      <header className="flex h-14 items-center justify-between border-b border-border bg-white px-4">
        <div className="flex min-w-0 items-center gap-3">
          <Workflow className="h-5 w-5 shrink-0 text-teal-700" />
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold">{snapshot.project.title}</div>
            <div className="truncate text-xs text-muted-foreground">{centerNode.path}</div>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Badge>{snapshot.project.key}</Badge>
          <a className="rounded-md border border-border px-3 py-1.5 hover:bg-muted" href={`/projects/${snapshot.project.key}`}>
            Workspace
          </a>
          <a className="rounded-md border border-border px-3 py-1.5 hover:bg-muted" href={`/projects/${snapshot.project.key}/graph`}>
            Graph
          </a>
        </div>
      </header>

      <div className={cn("grid flex-1", graphOnly ? "grid-cols-1" : "grid-cols-[minmax(560px,1fr)_420px]")}>
        <section className="relative min-h-0 border-r border-border bg-[#f8faf9]">
          <div className="absolute left-4 right-4 top-4 z-10 flex max-w-5xl flex-col gap-2">
            <div className="flex min-w-0 items-center gap-2 rounded-md border border-border bg-white p-2 shadow-pane">
              <button
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border hover:bg-muted disabled:opacity-40"
                disabled={!parentNode}
                title="Open parent scope"
                onClick={() => {
                  if (parentNode) {
                    setCenterId(parentNode.id);
                    setSelectedId(parentNode.id);
                  }
                }}
              >
                <ArrowUpToLine className="h-4 w-4" />
              </button>
              <Breadcrumbs
                nodes={breadcrumbs}
                onOpen={(id) => {
                  setCenterId(id);
                  setSelectedId(id);
                }}
              />
              <label className="ml-auto flex h-9 w-72 shrink-0 items-center gap-2 rounded-md border border-border bg-background px-2">
                <Search className="h-4 w-4 text-muted-foreground" />
                <input
                  className="w-full bg-transparent text-sm outline-none"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Find aspect or path"
                />
              </label>
            </div>
            {searchMatches.length > 0 ? (
              <div className="rounded-md border border-border bg-white p-2 shadow-pane">
                {searchMatches.map((node) => (
                  <button
                    key={node.id}
                    className="block w-full rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted"
                    onClick={() => {
                      setSelectedId(node.id);
                      setCenterId(node.id);
                      setQuery("");
                    }}
                  >
                    <span className="block truncate font-medium">{node.title}</span>
                    <span className="block truncate text-xs text-muted-foreground">{node.path}</span>
                  </button>
                ))}
              </div>
            ) : null}
          </div>
          <GraphCanvas
            nodes={flowNodes}
            edges={flowEdges}
            onNodesChange={onNodesChange}
            onSelect={setSelectedId}
            onOpen={(id) => {
              setCenterId(id);
              setSelectedId(id);
            }}
          />
        </section>

        {!graphOnly ? (
          <aside className="border-l border-border bg-white">
            <Inspector
              center={centerNode}
              node={selectedNode}
              nodes={snapshot.nodes}
              incoming={incoming}
              outgoing={outgoing}
              tasks={selectedTasks}
              drafts={draftSummaries}
              onOpen={(id) => {
                setCenterId(id);
                setSelectedId(id);
              }}
            />
          </aside>
        ) : null}
      </div>
    </main>
  );
}

function NodeDetail({ node }: { node: ProjectNode }) {
  const fields = getNodeTemplate(node.type);

  return (
    <article>
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={node.type}>{node.type.replace("_", " ")}</Badge>
        <Badge>{node.status.replace("_", " ")}</Badge>
      </div>
      <h1 className="mt-4 text-2xl font-semibold tracking-normal text-zinc-950">{node.title}</h1>
      <code className="mt-3 block rounded-md border border-border bg-background px-2 py-1 text-xs text-muted-foreground">
        {node.path}
      </code>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">{node.summary}</p>
      <div className="mt-4 rounded-md border border-border bg-background p-3">
        <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
          <HelpCircle className="h-4 w-4 text-teal-700" />
          Help
        </div>
        <p className="text-sm leading-6 text-zinc-700">{node.body}</p>
      </div>
      <div className="mt-4 space-y-3">
        {fields.map((field) => {
          const value = readTemplateValue(node, field.key);
          return (
            <section key={field.key} className="rounded-md border border-border bg-white p-3">
              <h2 className="text-sm font-semibold text-zinc-950">{field.label}</h2>
              <p className="mt-2 whitespace-pre-line text-sm leading-6 text-muted-foreground">{value || "Not specified yet."}</p>
            </section>
          );
        })}
      </div>
    </article>
  );
}

function Inspector({
  center,
  node,
  nodes,
  incoming,
  outgoing,
  tasks,
  drafts,
  onOpen
}: {
  center: ProjectNode;
  node: ProjectNode;
  nodes: ProjectNode[];
  incoming: ProjectPlanSnapshot["relations"];
  outgoing: ProjectPlanSnapshot["relations"];
  tasks: ProjectPlanSnapshot["tasks"];
  drafts: { draft: ProjectPlanSnapshot["draftPlans"][number]; conflicts: ReturnType<typeof detectDraftConflicts> }[];
  onOpen: (id: string) => void;
}) {
  const titleById = new Map(nodes.map((item) => [item.id, item.title]));

  return (
    <div className="h-[calc(100vh-3.5rem)] overflow-auto p-4">
      <div className="mb-4 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase text-muted-foreground">
          <PanelRight className="h-4 w-4" />
          Inspector
        </div>
        <button className="rounded-md border border-border px-2 py-1 text-xs hover:bg-muted" onClick={() => onOpen(node.id)}>
          Center
        </button>
      </div>
      {center.id !== node.id ? (
        <div className="mb-4 rounded-md border border-cyan-200 bg-cyan-50 p-3 text-xs text-cyan-900">
              Scope is centered on <strong>{center.title}</strong>. Selected aspect is shown below.
        </div>
      ) : null}
      <NodeDetail node={node} />
      <Panel title="Relations">
        <RelationList title="Outgoing" relations={outgoing} resolve={(relation) => titleById.get(relation.targetNodeId)} />
        <RelationList title="Incoming" relations={incoming} resolve={(relation) => titleById.get(relation.sourceNodeId)} />
      </Panel>
      <Panel title="Tasks">
        {tasks.length === 0 ? (
          <p className="text-sm text-muted-foreground">No tasks attached to this aspect.</p>
        ) : (
          <div className="space-y-2">
            {tasks.map((task) => (
              <div key={task.id} className="rounded-md border border-border bg-background p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium">{task.title}</span>
                  <Badge>{task.status}</Badge>
                </div>
                <ul className="mt-2 list-inside list-disc text-xs leading-5 text-muted-foreground">
                  {task.acceptanceCriteria.map((criterion) => (
                    <li key={criterion}>{criterion}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </Panel>
      <Panel title="Draft Plans">
        <div className="space-y-3">
          {drafts.map(({ draft, conflicts }) => (
            <div key={draft.id} className="rounded-md border border-border bg-background p-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-sm font-semibold">{draft.title}</div>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">{draft.hypothesis}</p>
                </div>
                <Badge>{draft.status}</Badge>
              </div>
              <div className="mt-3 space-y-2">
                {conflicts.length === 0 ? (
                  <p className="text-xs text-emerald-700">No conflicts detected.</p>
                ) : (
                  conflicts.map((conflict, index) => (
                    <div
                      key={`${draft.id}-${index}`}
                      className={cn(
                        "rounded-md border px-2 py-1.5 text-xs",
                        conflict.severity === "error"
                          ? "border-rose-200 bg-rose-50 text-rose-800"
                          : "border-amber-200 bg-amber-50 text-amber-800"
                      )}
                    >
                      {conflict.message}
                    </div>
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-5">
      <h2 className="mb-2 text-sm font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function RelationList({
  title,
  relations,
  resolve
}: {
  title: string;
  relations: ProjectPlanSnapshot["relations"];
  resolve: (relation: ProjectPlanSnapshot["relations"][number]) => string | undefined;
}) {
  return (
    <div className="mb-3">
      <div className="mb-1 flex items-center gap-2 text-xs font-medium text-muted-foreground">
        <GitFork className="h-3.5 w-3.5" />
        {title}
      </div>
      {relations.length === 0 ? (
        <p className="text-xs text-muted-foreground">None</p>
      ) : (
        <div className="space-y-1">
          {relations.map((relation) => (
            <div key={relation.id} className="rounded-md border border-border bg-background px-2 py-1.5 text-xs">
              <span className="font-medium">{relation.type}</span>
              <span className="text-muted-foreground"> · {resolve(relation) ?? "Unknown node"}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function GraphCanvas({
  nodes,
  edges,
  onSelect,
  onOpen,
  onNodesChange
}: {
  nodes: Node<{ node: ProjectNode; isCenter: boolean }>[];
  edges: Edge[];
  onSelect: (id: string) => void;
  onOpen: (id: string) => void;
  onNodesChange: OnNodesChange<Node<{ node: ProjectNode; isCenter: boolean }>>;
}) {
  return (
    <div className="h-full min-h-[calc(100vh-3.5rem)] bg-[#f8faf9]">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onNodeClick={(_, node) => onSelect(node.id)}
        onNodeDoubleClick={(_, node) => onOpen(node.id)}
        fitView
        minZoom={0.2}
      >
        <Background color="#cbd5e1" gap={18} />
        <MiniMap pannable zoomable />
        <Controls />
      </ReactFlow>
      {nodes.length === 0 ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
          <Network className="mr-2 h-4 w-4" />
          No graph nodes in scope.
        </div>
      ) : null}
    </div>
  );
}

function Breadcrumbs({ nodes, onOpen }: { nodes: ProjectNode[]; onOpen: (id: string) => void }) {
  const visibleNodes = nodes.length > 4 ? [nodes[0], ...nodes.slice(-3)] : nodes;
  const collapsed = nodes.length > visibleNodes.length;

  return (
    <nav className="flex min-w-0 flex-1 items-center gap-1 overflow-hidden" aria-label="Aspect breadcrumb">
      {visibleNodes.map((node, index) => {
        const isFirstVisible = index === 0;
        const isLast = index === visibleNodes.length - 1;

        return (
          <div key={node.id} className="flex min-w-0 items-center gap-1">
            {!isFirstVisible ? <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" /> : null}
            {collapsed && index === 1 ? (
              <>
                <span className="rounded-md px-1.5 text-xs text-muted-foreground">...</span>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              </>
            ) : null}
            <button
              className={cn(
                "min-w-0 truncate rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted",
                isLast ? "max-w-72 font-semibold text-zinc-950" : "max-w-44 text-muted-foreground"
              )}
              title={node.path}
              onClick={() => onOpen(node.id)}
            >
              {node.title}
            </button>
          </div>
        );
      })}
    </nav>
  );
}
