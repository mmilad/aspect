"use client";

import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ArrowUpToLine, ChevronRight, GitFork, HelpCircle, Network, PanelRight, Plus, Search, Workflow } from "lucide-react";
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
  getEntityDependents,
  getEntityRelations,
  getPrimaryTaskLink,
  getTagsForEntity,
  getTasksForAspect,
  getTasksForFeature,
  getNodeTemplate,
  readTemplateValue,
  type Entity,
  type EntityStatus,
  type EntityType,
  type Feature,
  type ProjectNode,
  type ProjectPlanSnapshot,
  type Task
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
  todo: "border-slate-300 bg-slate-50",
  doing: "border-cyan-400 bg-cyan-50",
  review: "border-amber-400 bg-amber-50",
  done: "border-emerald-400 bg-emerald-50",
  accepted: "border-amber-400 bg-amber-50",
  answered: "border-emerald-400 bg-emerald-50",
  archived: "border-stone-300 bg-stone-100"
};

type GraphMode = "full" | "scope";

type GraphEntity = Pick<Entity, "id" | "type" | "key" | "title" | "summary" | "body" | "status" | "metadata" | "sortOrder"> & {
  path?: string;
};

function NodeCard({ data }: NodeProps<Node<{ entity: GraphEntity; isCenter: boolean; isSelected: boolean; score?: number }>>) {
  const entity = data.entity;

  return (
    <div
      className={cn(
        "w-72 border bg-white/95 px-3.5 py-3 shadow-[0_10px_30px_rgba(15,23,42,0.10)] backdrop-blur",
        statusTone[entity.status],
        data.isCenter && "scale-[1.02] ring-2 ring-teal-600",
        data.isSelected && !data.isCenter && "ring-2 ring-cyan-500"
      )}
    >
      <Handle type="target" position={Position.Left} />
      <div className="flex items-center justify-between gap-2">
        <Badge tone={entity.type}>{entity.type.replace("_", " ")}</Badge>
        <span className="truncate text-xs text-muted-foreground">{entity.status.replace("_", " ")}</span>
      </div>
      <div className="mt-2 flex items-start justify-between gap-2">
        <div className="min-w-0 text-[15px] font-semibold leading-5 text-zinc-950">{entity.title}</div>
        {data.score ? <span className="shrink-0 rounded-md bg-zinc-100 px-1.5 py-0.5 text-[11px] text-zinc-700">{data.score}</span> : null}
      </div>
      <div className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">{entity.summary}</div>
      {entity.key ? <div className="mt-2 font-mono text-[11px] text-muted-foreground">{entity.key}</div> : null}
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

function queryTokens(query: string): string[] {
  return query
    .toLowerCase()
    .split(/[^a-z0-9_-]+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 2);
}

function scoreEntity(entity: GraphEntity, query: string): number {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return 0;
  }
  const joined = [
    entity.id,
    entity.key,
    entity.type,
    entity.title,
    entity.summary,
    entity.body,
    entity.path,
    JSON.stringify(entity.metadata)
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  let score = joined.includes(normalized) ? 100 : 0;
  for (const token of queryTokens(query)) {
    if (joined.includes(token)) {
      score += 10;
    }
  }
  return score;
}

function buildGraphEntities(snapshot: ProjectPlanSnapshot): GraphEntity[] {
  return [
    ...snapshot.nodes.map((node) => ({
      id: node.id,
      type: node.type,
      key: null,
      title: node.title,
      summary: node.summary,
      body: node.body,
      status: node.status,
      metadata: node.metadata,
      sortOrder: node.sortOrder,
      path: node.path
    })),
    ...snapshot.features.map((feature) => ({
      id: feature.id,
      type: "feature" as const,
      key: feature.key,
      title: feature.title,
      summary: feature.summary,
      body: feature.body,
      status: feature.status,
      metadata: { ...feature.metadata, acceptanceShape: feature.acceptanceShape },
      sortOrder: feature.sortOrder
    })),
    ...snapshot.tasks.map((task) => ({
      id: task.id,
      type: "task" as const,
      key: task.key,
      title: task.title,
      summary: task.description,
      body: task.description,
      status: task.status,
      metadata: { ...task.metadata, priority: task.priority, acceptanceCriteria: task.acceptanceCriteria },
      sortOrder: task.sortOrder
    }))
  ];
}

function entityTypeLabel(type: string): string {
  return type.replace("_", " ");
}

export function AppShell({ snapshot, graphOnly = false }: AppShellProps) {
  const router = useRouter();
  const rootNode = snapshot.nodes[0];
  const allGraphEntities = useMemo(() => buildGraphEntities(snapshot), [snapshot]);
  const allEntityTypes = useMemo(
    () =>
      [...new Set(allGraphEntities.map((entity) => entity.type))].sort((left, right) => {
        const order: EntityType[] = ["project", "aspect", "feature", "task", "decision", "question", "reference", "flow", "entry", "area", "surface", "task_group"];
        return order.indexOf(left) - order.indexOf(right);
      }),
    [allGraphEntities]
  );
  const [graphMode, setGraphMode] = useState<GraphMode>("full");
  const [activeTypes, setActiveTypes] = useState<Set<EntityType>>(() => new Set(allGraphEntities.map((entity) => entity.type)));
  const [centerId, setCenterId] = useState(rootNode?.id);
  const [selectedId, setSelectedId] = useState(rootNode?.id);
  const [selectedFeatureId, setSelectedFeatureId] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const centerNode = snapshot.nodes.find((node) => node.id === centerId) ?? rootNode;
  const selectedEntity = allGraphEntities.find((entity) => entity.id === (selectedFeatureId ?? selectedId)) ?? allGraphEntities[0];
  const selectedNode = snapshot.nodes.find((node) => node.id === selectedId) ?? centerNode;
  const selectedFeature = selectedFeatureId
    ? snapshot.features.find((feature) => feature.id === selectedFeatureId) ?? null
    : selectedEntity?.type === "feature"
      ? snapshot.features.find((feature) => feature.id === selectedEntity.id) ?? null
    : null;
  const parentNode = centerNode?.parentId ? snapshot.nodes.find((node) => node.id === centerNode.parentId) : null;
  const breadcrumbs = useMemo(() => getAncestors(centerNode, snapshot.nodes), [centerNode, snapshot.nodes]);
  const graph = useMemo(() => focusGraph(centerNode.id, snapshot.nodes, snapshot.relations), [centerNode.id, snapshot]);

  useEffect(() => {
    setActiveTypes((current) => {
      const next = new Set(current);
      let changed = false;
      for (const type of allEntityTypes) {
        if (!next.has(type)) {
          next.add(type);
          changed = true;
        }
      }
      return changed ? next : current;
    });
  }, [allEntityTypes]);

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

  const scopedNodes: Node<{ entity: GraphEntity; isCenter: boolean; isSelected: boolean; score?: number }>[] = graph.nodes.map((node, index) => {
    const layout = node.metadata.layout as { x?: number; y?: number } | undefined;
    const isCenter = node.id === centerNode.id;
    const entity = allGraphEntities.find((item) => item.id === node.id);
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
      data: {
        entity: entity ?? {
          id: node.id,
          type: node.type,
          key: null,
          title: node.title,
          summary: node.summary,
          body: node.body,
          status: node.status,
          metadata: node.metadata,
          sortOrder: node.sortOrder,
          path: node.path
        },
        isCenter,
        isSelected: selectedId === node.id
      }
    };
  });

  const scoredEntities = useMemo(
    () =>
      allGraphEntities
        .map((entity) => ({ entity, score: scoreEntity(entity, query) }))
        .filter(({ entity, score }) => activeTypes.has(entity.type) && (!query.trim() || score > 0))
        .sort((left, right) => right.score - left.score || left.entity.sortOrder - right.entity.sortOrder),
    [activeTypes, allGraphEntities, query]
  );

  const fullGraphNodes: Node<{ entity: GraphEntity; isCenter: boolean; isSelected: boolean; score?: number }>[] = useMemo(() => {
    const lanes = new Map<EntityType, number>();
    return scoredEntities.map(({ entity, score }) => {
      const laneIndex = allEntityTypes.indexOf(entity.type);
      const rowIndex = lanes.get(entity.type) ?? 0;
      lanes.set(entity.type, rowIndex + 1);
      return {
        id: entity.id,
        type: "projectNode",
        position: {
          x: laneIndex * 340,
          y: rowIndex * 155
        },
        data: {
          entity,
          isCenter: entity.id === centerNode.id,
          isSelected: entity.id === (selectedFeatureId ?? selectedId),
          score: query.trim() ? score : undefined
        }
      };
    });
  }, [allEntityTypes, centerNode.id, query, scoredEntities, selectedFeatureId, selectedId]);

  const graphNodes = graphMode === "full" ? fullGraphNodes : scopedNodes;
  const [flowNodes, setFlowNodes, onNodesChange] = useNodesState(graphNodes);

  useEffect(() => {
    setFlowNodes(graphNodes);
  }, [graphNodes, setFlowNodes]);

  const relationEdges: Edge[] = graph.relations.map((relation) => ({
    id: relation.id,
    source: relation.sourceNodeId,
    target: relation.targetNodeId,
    label: relation.label ?? relation.type,
    type: "smoothstep",
    animated: relation.type === "blocks" || relation.type === "conflicts_with",
    style: { stroke: relation.type === "conflicts_with" ? "#be123c" : "#0f766e" }
  }));

  const fullVisibleIds = new Set(fullGraphNodes.map((node) => node.id));
  const fullRelationEdges: Edge[] = snapshot.entityRelations
    .filter((relation) => fullVisibleIds.has(relation.sourceId) && fullVisibleIds.has(relation.targetId))
    .map((relation) => ({
      id: relation.id,
      source: relation.sourceId,
      target: relation.targetId,
      label: relation.label ?? relation.type,
      type: "smoothstep",
      animated: relation.type === "blocks" || relation.type === "conflicts_with" || relation.type === "blocked_by",
      style: { stroke: relation.type === "conflicts_with" || relation.type === "blocked_by" ? "#be123c" : "#0f766e" }
    }));

  const flowEdges = graphMode === "full" ? fullRelationEdges : [...hierarchyEdges, ...relationEdges];
  const incoming = snapshot.relations.filter((relation) => relation.targetNodeId === selectedNode.id);
  const outgoing = snapshot.relations.filter((relation) => relation.sourceNodeId === selectedNode.id);
  const directAspectTasks = getTasksForAspect(selectedNode.id, snapshot);
  const aspectAndFeatureTasks = getTasksForAspect(selectedNode.id, snapshot, { includeFeatures: true });
  const allAspectTasks = getTasksForAspect(selectedNode.id, snapshot, { includeSubaspects: true, includeFeatures: true });
  const directTaskIds = new Set(directAspectTasks.map((task) => task.id));
  const aspectFeatureTaskIds = new Set(aspectAndFeatureTasks.map((task) => task.id));
  const featureTasks = aspectAndFeatureTasks.filter((task) => !directTaskIds.has(task.id));
  const subaspectTasks = allAspectTasks.filter((task) => !aspectFeatureTaskIds.has(task.id));
  const relatedFeatures = snapshot.featureAspectLinks
    .filter((link) => link.aspectId === selectedNode.id)
    .map((link) => snapshot.features.find((feature) => feature.id === link.featureId))
    .filter((feature): feature is Feature => Boolean(feature));
  const searchMatches = useMemo(() => scoredEntities.filter((match) => query.trim() && match.score > 0).slice(0, 8), [query, scoredEntities]);
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
            <div className="flex min-w-0 flex-wrap items-center gap-2 rounded-md border border-border bg-white p-2 shadow-pane">
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
                  setSelectedFeatureId(null);
                }}
              />
              <div className="ml-auto inline-flex h-9 rounded-md border border-border bg-background p-1">
                {(["full", "scope"] as const).map((mode) => (
                  <button
                    key={mode}
                    className={cn(
                      "rounded px-2 text-xs font-medium capitalize",
                      graphMode === mode ? "bg-teal-700 text-white" : "text-muted-foreground hover:bg-muted"
                    )}
                    onClick={() => setGraphMode(mode)}
                  >
                    {mode}
                  </button>
                ))}
              </div>
              <label className="flex h-9 w-80 shrink-0 items-center gap-2 rounded-md border border-border bg-background px-2">
                <Search className="h-4 w-4 text-muted-foreground" />
                <input
                  className="w-full bg-transparent text-sm outline-none"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search graph"
                />
              </label>
            </div>
            <div className="flex flex-wrap items-center gap-1 rounded-md border border-border bg-white p-2 shadow-pane">
              <button
                className="h-7 rounded-md border border-border px-2 text-xs hover:bg-muted"
                onClick={() => setActiveTypes(new Set(allEntityTypes))}
              >
                All
              </button>
              <button
                className="h-7 rounded-md border border-border px-2 text-xs hover:bg-muted"
                onClick={() => setActiveTypes(new Set(["aspect", "feature", "task"]))}
              >
                Work
              </button>
              {allEntityTypes.map((type) => {
                const active = activeTypes.has(type);
                return (
                  <button
                    key={type}
                    className={cn(
                      "h-7 rounded-md border px-2 text-xs capitalize",
                      active ? "border-teal-700 bg-teal-50 text-teal-900" : "border-border text-muted-foreground hover:bg-muted"
                    )}
                    onClick={() =>
                      setActiveTypes((current) => {
                        const next = new Set(current);
                        if (next.has(type) && next.size > 1) {
                          next.delete(type);
                        } else {
                          next.add(type);
                        }
                        return next;
                      })
                    }
                  >
                    {entityTypeLabel(type)}
                  </button>
                );
              })}
            </div>
            {searchMatches.length > 0 ? (
              <div className="rounded-md border border-border bg-white p-2 shadow-pane">
                {searchMatches.map(({ entity, score }) => (
                  <button
                    key={entity.id}
                    className="block w-full rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted"
                    onClick={() => {
                      setSelectedId(entity.id);
                      setSelectedFeatureId(entity.type === "feature" ? entity.id : null);
                      if (graphMode === "scope" && entity.type === "aspect") {
                        setCenterId(entity.id);
                      }
                    }}
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="min-w-0 truncate font-medium">{entity.title}</span>
                      <span className="shrink-0 rounded bg-zinc-100 px-1.5 py-0.5 text-[11px] text-zinc-700">{score}</span>
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {entityTypeLabel(entity.type)}
                      {entity.key ? ` · ${entity.key}` : ""}
                      {entity.path ? ` · ${entity.path}` : ""}
                    </span>
                  </button>
                ))}
              </div>
            ) : null}
          </div>
          <GraphCanvas
            nodes={flowNodes}
            edges={flowEdges}
            onNodesChange={onNodesChange}
            onSelect={(id) => {
              setSelectedId(id);
              setSelectedFeatureId(allGraphEntities.find((entity) => entity.id === id)?.type === "feature" ? id : null);
            }}
            onOpen={(id) => {
              router.push(`/projects/${snapshot.project.key}/entities/${id}`);
            }}
          />
        </section>

        {!graphOnly ? (
          <aside className="border-l border-border bg-white">
            <Inspector
              center={centerNode}
              node={selectedNode}
              entity={selectedEntity}
              feature={selectedFeature}
              nodes={snapshot.nodes}
              snapshot={snapshot}
              incoming={incoming}
              outgoing={outgoing}
              directTasks={directAspectTasks}
              featureTasks={featureTasks}
              subaspectTasks={subaspectTasks}
              relatedFeatures={relatedFeatures}
              drafts={draftSummaries}
              onOpen={(id) => {
                setCenterId(id);
                setSelectedId(id);
                setSelectedFeatureId(null);
              }}
              onOpenFeature={setSelectedFeatureId}
              onCreatedTask={() => router.refresh()}
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
  entity,
  feature,
  nodes,
  snapshot,
  incoming,
  outgoing,
  directTasks,
  featureTasks,
  subaspectTasks,
  relatedFeatures,
  drafts,
  onOpen,
  onOpenFeature,
  onCreatedTask
}: {
  center: ProjectNode;
  node: ProjectNode;
  entity: GraphEntity;
  feature: Feature | null;
  nodes: ProjectNode[];
  snapshot: ProjectPlanSnapshot;
  incoming: ProjectPlanSnapshot["relations"];
  outgoing: ProjectPlanSnapshot["relations"];
  directTasks: Task[];
  featureTasks: Task[];
  subaspectTasks: Task[];
  relatedFeatures: Feature[];
  drafts: { draft: ProjectPlanSnapshot["draftPlans"][number]; conflicts: ReturnType<typeof detectDraftConflicts> }[];
  onOpen: (id: string) => void;
  onOpenFeature: (id: string) => void;
  onCreatedTask: () => void;
}) {
  const titleById = new Map(nodes.map((item) => [item.id, item.title]));
  const aspectTags = getTagsForEntity({ type: "aspect", id: node.id }, snapshot);
  const isAspectSelection = entity.type === "aspect";

  return (
    <div className="h-[calc(100vh-3.5rem)] overflow-auto p-4">
      <div className="mb-4 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase text-muted-foreground">
          <PanelRight className="h-4 w-4" />
          Inspector
        </div>
        <div className="flex items-center gap-2">
          <a
            className="rounded-md border border-border px-2 py-1 text-xs hover:bg-muted"
            href={`/projects/${snapshot.project.key}/entities/${entity.id}`}
          >
            Open detail
          </a>
          <button
            className="rounded-md border border-border px-2 py-1 text-xs hover:bg-muted disabled:opacity-40"
            disabled={!isAspectSelection}
            onClick={() => onOpen(node.id)}
          >
            Center
          </button>
        </div>
      </div>
      {isAspectSelection && center.id !== node.id ? (
        <div className="mb-4 rounded-md border border-cyan-200 bg-cyan-50 p-3 text-xs text-cyan-900">
              Scope is centered on <strong>{center.title}</strong>. Selected aspect is shown below.
        </div>
      ) : null}
      {feature ? (
        <FeatureDetail feature={feature} snapshot={snapshot} onOpenFeature={onOpenFeature} onCreatedTask={onCreatedTask} />
      ) : !isAspectSelection ? (
        <GenericEntityPeek entity={entity} snapshot={snapshot} />
      ) : (
        <>
          <NodeDetail node={node} />
          <TagRow tags={aspectTags} />
          <NewTaskForm
            projectKey={snapshot.project.key}
            targetType="aspect"
            targetId={node.id}
            targetLabel={node.title}
            onCreated={onCreatedTask}
          />
          <Panel title="Related Features">
            {relatedFeatures.length === 0 ? (
              <p className="text-sm text-muted-foreground">No features linked to this aspect.</p>
            ) : (
              <div className="space-y-2">
                {relatedFeatures.map((item) => (
                  <FeatureCard key={item.id} feature={item} snapshot={snapshot} onOpenFeature={onOpenFeature} />
                ))}
              </div>
            )}
          </Panel>
          <Panel title="Tasks">
            <TaskGroup title="Direct tasks" tasks={directTasks} snapshot={snapshot} />
            <TaskGroup title="Feature tasks" tasks={featureTasks} snapshot={snapshot} />
            <TaskGroup title="Subaspect tasks" tasks={subaspectTasks} snapshot={snapshot} />
          </Panel>
          <Panel title="Aspect Relations">
            <RelationList title="Outgoing" relations={outgoing} resolve={(relation) => titleById.get(relation.targetNodeId)} />
            <RelationList title="Incoming" relations={incoming} resolve={(relation) => titleById.get(relation.sourceNodeId)} />
          </Panel>
        </>
      )}
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

function GenericEntityPeek({ entity, snapshot }: { entity: GraphEntity; snapshot: ProjectPlanSnapshot }) {
  const outgoing = snapshot.entityRelations.filter((relation) => relation.sourceId === entity.id);
  const incoming = snapshot.entityRelations.filter((relation) => relation.targetId === entity.id);
  const tags = getTagsForEntity({ type: entity.type, id: entity.id }, snapshot);

  return (
    <article>
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={entity.type}>{entityTypeLabel(entity.type)}</Badge>
        <Badge>{entity.status.replace("_", " ")}</Badge>
        {entity.key ? <Badge>{entity.key}</Badge> : null}
      </div>
      <h1 className="mt-4 text-2xl font-semibold tracking-normal text-zinc-950">{entity.title}</h1>
      {entity.summary ? <p className="mt-3 text-sm leading-6 text-muted-foreground">{entity.summary}</p> : null}
      {entity.body ? (
        <div className="mt-4 rounded-md border border-border bg-background p-3 text-sm leading-6 text-zinc-700">{entity.body}</div>
      ) : null}
      <TagRow tags={tags} />
      <Panel title="Relations">
        <EntityRelationList title="Outgoing" relations={outgoing} snapshot={snapshot} />
        <EntityRelationList title="Incoming" relations={incoming} snapshot={snapshot} />
      </Panel>
      <Panel title="Metadata">
        <pre className="max-h-72 overflow-auto rounded-md border border-border bg-zinc-950 p-3 text-xs leading-5 text-zinc-100">
          {JSON.stringify(entity.metadata, null, 2)}
        </pre>
      </Panel>
    </article>
  );
}

function NewTaskForm({
  projectKey,
  targetType,
  targetId,
  targetLabel,
  onCreated
}: {
  projectKey: string;
  targetType: "aspect" | "feature";
  targetId: string;
  targetLabel: string;
  onCreated: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<"todo" | "doing" | "blocked" | "review" | "done">("todo");
  const [priority, setPriority] = useState<"low" | "medium" | "high" | "critical">("medium");
  const [linkType, setLinkType] = useState<"affects" | "implements" | "validates" | "investigates">(
    targetType === "feature" ? "implements" : "affects"
  );
  const [acceptanceCriteria, setAcceptanceCriteria] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSaving(true);

    try {
      const response = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectKey,
          title,
          description,
          status,
          priority,
          linkType,
          targetType,
          targetId,
          acceptanceCriteria: acceptanceCriteria
            .split("\n")
            .map((line) => line.trim())
            .filter(Boolean)
        })
      });

      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "Could not create task.");
      }

      setTitle("");
      setDescription("");
      setStatus("todo");
      setAcceptanceCriteria("");
      setOpen(false);
      onCreated();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not create task.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="mt-4 rounded-md border border-border bg-white p-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold">Create Task</h2>
          <p className="mt-1 truncate text-xs text-muted-foreground">
            Links to {targetType}: {targetLabel}
          </p>
        </div>
        <button
          className="inline-flex h-8 items-center gap-1 rounded-md border border-border px-2 text-xs hover:bg-muted"
          onClick={() => setOpen((value) => !value)}
        >
          <Plus className="h-3.5 w-3.5" />
          New
        </button>
      </div>

      {open ? (
        <form className="mt-3 space-y-2" onSubmit={submit}>
          <input
            className="h-9 w-full rounded-md border border-border bg-background px-2 text-sm outline-none focus:ring-2 focus:ring-teal-500"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Task title"
            required
          />
          <textarea
            className="min-h-20 w-full resize-y rounded-md border border-border bg-background px-2 py-2 text-sm outline-none focus:ring-2 focus:ring-teal-500"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Description"
          />
          <div className="grid grid-cols-2 gap-2">
            <select
              className="h-9 rounded-md border border-border bg-background px-2 text-sm outline-none"
              value={status}
              onChange={(event) => setStatus(event.target.value as typeof status)}
            >
              <option value="todo">todo</option>
              <option value="doing">doing</option>
              <option value="blocked">blocked</option>
              <option value="review">review</option>
              <option value="done">done</option>
            </select>
            <select
              className="h-9 rounded-md border border-border bg-background px-2 text-sm outline-none"
              value={priority}
              onChange={(event) => setPriority(event.target.value as typeof priority)}
            >
              <option value="low">low</option>
              <option value="medium">medium</option>
              <option value="high">high</option>
              <option value="critical">critical</option>
            </select>
          </div>
          <select
            className="h-9 w-full rounded-md border border-border bg-background px-2 text-sm outline-none"
            value={linkType}
            onChange={(event) => setLinkType(event.target.value as typeof linkType)}
          >
            <option value="affects">affects</option>
            <option value="implements">implements</option>
            <option value="validates">validates</option>
            <option value="investigates">investigates</option>
          </select>
          <textarea
            className="min-h-16 w-full resize-y rounded-md border border-border bg-background px-2 py-2 text-sm outline-none focus:ring-2 focus:ring-teal-500"
            value={acceptanceCriteria}
            onChange={(event) => setAcceptanceCriteria(event.target.value)}
            placeholder="Acceptance criteria, one per line"
          />
          {error ? <p className="text-xs text-rose-700">{error}</p> : null}
          <button
            className="h-9 w-full rounded-md bg-teal-700 px-3 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-50"
            disabled={saving}
            type="submit"
          >
            {saving ? "Creating..." : "Create Task"}
          </button>
        </form>
      ) : null}
    </section>
  );
}

function FeatureDetail({
  feature,
  snapshot,
  onOpenFeature,
  onCreatedTask
}: {
  feature: Feature;
  snapshot: ProjectPlanSnapshot;
  onOpenFeature: (id: string) => void;
  onCreatedTask: () => void;
}) {
  const linkedAspects = snapshot.featureAspectLinks
    .filter((link) => link.featureId === feature.id)
    .map((link) => snapshot.nodes.find((node) => node.id === link.aspectId))
    .filter((node): node is ProjectNode => Boolean(node));
  const directTasks = getTasksForFeature(feature.id, snapshot);
  const nestedTasks = getTasksForFeature(feature.id, snapshot, { includeNestedFeatures: true }).filter(
    (task) => !directTasks.some((directTask) => directTask.id === task.id)
  );
  const nestedFeatures = snapshot.features.filter((item) => item.parentFeatureId === feature.id);
  const tags = getTagsForEntity({ type: "feature", id: feature.id }, snapshot);
  const relations = getEntityRelations({ type: "feature", id: feature.id }, snapshot);
  const dependents = getEntityDependents({ type: "feature", id: feature.id }, snapshot);

  return (
    <article>
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="feature">feature</Badge>
        <Badge>{feature.status.replace("_", " ")}</Badge>
        <Badge>{feature.key}</Badge>
      </div>
      <h1 className="mt-4 text-2xl font-semibold tracking-normal text-zinc-950">{feature.title}</h1>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">{feature.summary}</p>
      <div className="mt-4 rounded-md border border-border bg-background p-3 text-sm leading-6 text-zinc-700">
        {feature.body}
      </div>
      <NewTaskForm
        projectKey={snapshot.project.key}
        targetType="feature"
        targetId={feature.id}
        targetLabel={feature.title}
        onCreated={onCreatedTask}
      />
      <Panel title="Linked Aspects">
        <div className="space-y-1">
          {linkedAspects.map((aspect) => (
            <div key={aspect.id} className="rounded-md border border-border bg-background px-2 py-1.5 text-xs">
              {aspect.title}
            </div>
          ))}
        </div>
      </Panel>
      <TagRow tags={tags} />
      <Panel title="Nested Features">
        {nestedFeatures.length === 0 ? (
          <p className="text-sm text-muted-foreground">No nested features.</p>
        ) : (
          <div className="space-y-2">
            {nestedFeatures.map((item) => (
              <FeatureCard key={item.id} feature={item} snapshot={snapshot} onOpenFeature={onOpenFeature} />
            ))}
          </div>
        )}
      </Panel>
      <Panel title="Feature Tasks">
        <TaskGroup title="Direct tasks" tasks={directTasks} snapshot={snapshot} />
        <TaskGroup title="Nested feature tasks" tasks={nestedTasks} snapshot={snapshot} />
      </Panel>
      <Panel title="Dependencies">
        <EntityRelationList title="Outgoing" relations={relations} snapshot={snapshot} />
        <EntityRelationList title="Depended on by" relations={dependents} snapshot={snapshot} />
      </Panel>
    </article>
  );
}

function FeatureCard({
  feature,
  snapshot,
  onOpenFeature
}: {
  feature: Feature;
  snapshot: ProjectPlanSnapshot;
  onOpenFeature: (id: string) => void;
}) {
  const tags = getTagsForEntity({ type: "feature", id: feature.id }, snapshot);

  return (
    <button
      className="block w-full rounded-md border border-border bg-background p-3 text-left hover:bg-muted"
      onClick={() => onOpenFeature(feature.id)}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-semibold">{feature.title}</span>
        <Badge>{feature.status.replace("_", " ")}</Badge>
      </div>
      <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">{feature.summary}</p>
      <TagRow tags={tags} compact />
    </button>
  );
}

function TaskGroup({ title, tasks, snapshot }: { title: string; tasks: Task[]; snapshot: ProjectPlanSnapshot }) {
  return (
    <div className="mb-4">
      <h3 className="mb-2 text-xs font-semibold uppercase text-muted-foreground">{title}</h3>
      {tasks.length === 0 ? (
        <p className="text-sm text-muted-foreground">No tasks.</p>
      ) : (
        <div className="space-y-2">
          {tasks.map((task) => (
            <TaskCard key={task.id} task={task} snapshot={snapshot} />
          ))}
        </div>
      )}
    </div>
  );
}

function TaskCard({ task, snapshot }: { task: Task; snapshot: ProjectPlanSnapshot }) {
  const primaryLink = getPrimaryTaskLink(task, snapshot);
  const tags = getTagsForEntity({ type: "task", id: task.id }, snapshot);
  const dependsOn = getEntityRelations({ type: "task", id: task.id }, snapshot).filter(
    (relation) => relation.type === "depends_on"
  );
  const dependedOnBy = getEntityDependents({ type: "task", id: task.id }, snapshot);

  return (
    <a
      className="block rounded-md border border-border bg-background p-3 hover:bg-muted"
      href={`/projects/${snapshot.project.key}/entities/${task.id}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Badge>{task.key}</Badge>
            <span className="truncate text-sm font-medium">{task.title}</span>
          </div>
          <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">{task.description}</p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <Badge>{task.status}</Badge>
          <Badge>{task.priority}</Badge>
        </div>
      </div>
      {primaryLink ? (
        <div className="mt-2 text-xs text-muted-foreground">
          {primaryLink.type} {primaryLink.targetType}:{" "}
          <span className="font-medium text-zinc-700">{resolveEntityTitle(primaryLink.targetType, primaryLink.targetId, snapshot)}</span>
        </div>
      ) : null}
      <div className="mt-2 flex flex-wrap gap-1 text-xs">
        {dependsOn.length > 0 ? <Badge>depends on {dependsOn.length}</Badge> : null}
        {dependedOnBy.length > 0 ? <Badge>depended on by {dependedOnBy.length}</Badge> : null}
      </div>
      <TagRow tags={tags} compact />
    </a>
  );
}

function TagRow({ tags, compact = false }: { tags: ProjectPlanSnapshot["tags"]; compact?: boolean }) {
  if (tags.length === 0) {
    return compact ? null : <p className="mt-3 text-sm text-muted-foreground">No tags.</p>;
  }

  return (
    <div className={cn("flex flex-wrap gap-1", compact ? "mt-2" : "mt-3")}>
      {tags.map((tag) => (
        <Badge key={tag.id} className="bg-white text-zinc-700">
          {tag.label}
        </Badge>
      ))}
    </div>
  );
}

function EntityRelationList({
  title,
  relations,
  snapshot
}: {
  title: string;
  relations: ProjectPlanSnapshot["entityRelations"];
  snapshot: ProjectPlanSnapshot;
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
              <span className="text-muted-foreground">
                {" "}
                · {resolveEntityTitle(relation.targetType, relation.targetId, snapshot)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function resolveEntityTitle(type: string, id: string, snapshot: ProjectPlanSnapshot): string {
  if (type === "feature") {
    return snapshot.features.find((feature) => feature.id === id)?.title ?? "Unknown feature";
  }

  if (type === "task") {
    return snapshot.tasks.find((task) => task.id === id)?.title ?? "Unknown task";
  }

  if (type === "aspect" || type === "decision" || type === "question" || type === "reference" || type === "project") {
    return snapshot.nodes.find((node) => node.id === id)?.title ?? "Unknown aspect";
  }

  return id;
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
  nodes: Node<{ entity: GraphEntity; isCenter: boolean; isSelected: boolean; score?: number }>[];
  edges: Edge[];
  onSelect: (id: string) => void;
  onOpen: (id: string) => void;
  onNodesChange: OnNodesChange<Node<{ entity: GraphEntity; isCenter: boolean; isSelected: boolean; score?: number }>>;
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
