"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useNodesState, type Edge, type Node } from "@xyflow/react";
import { focusGraph, getTagsForEntity, getTasksForAspect, type EntityType, type Feature, type ProjectPlanSnapshot } from "@projectplaner/core";
import { ProjectLeftSidebar } from "../project-left-sidebar";
import { ProjectShell } from "../project-shell";
import { SelectionInspector } from "../selection-inspector";
import { WorkspaceCenter } from "../workspace-center";
import { projectPaths } from "../../lib/project-paths";
import { getAncestors } from "./lib/ancestors";
import { buildGraphEntities } from "./lib/build-graph-entities";
import { scoreEntity } from "./lib/score-entity";
import { getVisibleEntityRelations } from "./lib/visible-relations";
import { GraphCanvas } from "./graph-canvas";
import { GraphToolbar } from "./graph-toolbar";
import { SpatialGraphCanvas } from "./spatial-graph-canvas";
import type { GraphFlowNodeData, GraphMatch, GraphMode, GraphSurface } from "./types";

interface AppShellProps {
  snapshot: ProjectPlanSnapshot;
  graphOnly?: boolean;
  initialSelectedId?: string;
}

export function AppShell({ snapshot, graphOnly = false, initialSelectedId }: AppShellProps) {
  const router = useRouter();
  const pathname = usePathname();
  const rootNode = snapshot.nodes[0];
  const allGraphEntities = useMemo(() => buildGraphEntities(snapshot), [snapshot]);
  const initialSelectedEntity = allGraphEntities.find((entity) => entity.id === initialSelectedId) ?? rootNode;
  const initialCenterNode =
    initialSelectedEntity?.type === "aspect"
      ? snapshot.nodes.find((node) => node.id === initialSelectedEntity.id)
      : rootNode;
  const allEntityTypes = useMemo(
    () =>
      [...new Set(allGraphEntities.map((entity) => entity.type))].sort((left, right) => {
        const order: EntityType[] = [
          "project",
          "aspect",
          "feature",
          "task",
          "decision",
          "question",
          "reference",
          "flow",
          "entry",
          "area",
          "surface",
          "task_group"
        ];
        return order.indexOf(left) - order.indexOf(right);
      }),
    [allGraphEntities]
  );
  const [graphMode, setGraphMode] = useState<GraphMode>("full");
  const [graphSurface, setGraphSurface] = useState<GraphSurface>("map");
  const [activeTypes, setActiveTypes] = useState<Set<EntityType>>(() => new Set(allGraphEntities.map((entity) => entity.type)));
  const [centerId, setCenterId] = useState(initialCenterNode?.id);
  const [selectedId, setSelectedId] = useState(initialSelectedEntity?.id ?? rootNode?.id);
  const [selectedFeatureId, setSelectedFeatureId] = useState<string | null>(
    initialSelectedEntity?.type === "feature" ? initialSelectedEntity.id : null
  );
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

  const scopedNodes: Node<GraphFlowNodeData>[] = graph.nodes.map((node, index) => {
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

  const fullGraphNodes: Node<GraphFlowNodeData>[] = useMemo(() => {
    const lanes = new Map<EntityType, number>();
    return scoredEntities.map(({ entity, score }) => {
      const laneIndex = allEntityTypes.indexOf(entity.type);
      const rowIndex = lanes.get(entity.type) ?? 0;
      lanes.set(entity.type, rowIndex + 1);
      return {
        id: entity.id,
        type: "projectNode",
        position: {
          x: laneIndex * 150,
          y: rowIndex * 82
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

  const visibleEntityRelations = getVisibleEntityRelations(snapshot);
  const displayedMatches: GraphMatch[] =
    graphMode === "full" ? scoredEntities : graphNodes.map((node) => ({ entity: node.data.entity, score: node.data.score ?? 0 }));
  const displayedIds = new Set(displayedMatches.map(({ entity }) => entity.id));
  const fullRelationEdges: Edge[] = visibleEntityRelations
    .filter((relation) => displayedIds.has(relation.sourceId) && displayedIds.has(relation.targetId))
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
  const searchMatches = useMemo(
    () => scoredEntities.filter((match) => query.trim() && match.score > 0).slice(0, 8),
    [query, scoredEntities]
  );
  const selectedTags = getTagsForEntity({ type: selectedEntity.type, id: selectedEntity.id }, snapshot);

  function selectEntity(id: string) {
    setSelectedId(id);
    setSelectedFeatureId(allGraphEntities.find((entity) => entity.id === id)?.type === "feature" ? id : null);
    const params = new URLSearchParams(window.location.search);
    params.set("selected", id);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  function openScope(id: string) {
    setCenterId(id);
    selectEntity(id);
  }

  return (
    <ProjectShell
      project={snapshot.project}
      scopeLabel={centerNode.path}
      activeView={graphOnly ? "graph" : "workspace"}
      leftSidebar={
        <ProjectLeftSidebar
          snapshot={snapshot}
          activeView={graphOnly ? "graph" : "workspace"}
          activeTypes={activeTypes}
          entityTypes={allEntityTypes}
          centerNode={centerNode}
          recentScopes={breadcrumbs}
          onSelectTypes={setActiveTypes}
          onToggleType={(type) =>
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
          onOpenScope={openScope}
        />
      }
      center={
        <WorkspaceCenter>
          <section className="relative h-full min-h-0 bg-[#f8faf9]">
            <GraphToolbar
              parentNode={parentNode}
              breadcrumbs={breadcrumbs}
              graphMode={graphMode}
              graphSurface={graphSurface}
              query={query}
              searchMatches={searchMatches}
              onOpenScope={openScope}
              onSelectEntity={selectEntity}
              onGraphMode={setGraphMode}
              onGraphSurface={setGraphSurface}
              onQuery={setQuery}
              onCenterFromSearch={setCenterId}
            />
            {graphSurface === "map" ? (
              <GraphCanvas
                nodes={flowNodes}
                edges={flowEdges}
                onNodesChange={onNodesChange}
                onSelect={selectEntity}
                onOpen={(id) => {
                  router.push(projectPaths.entity(snapshot.project.key, id));
                }}
              />
            ) : (
              <SpatialGraphCanvas
                matches={displayedMatches}
                relations={visibleEntityRelations}
                selectedId={selectedFeatureId ?? selectedId}
                centerId={centerNode.id}
                onSelect={selectEntity}
                onOpen={(id) => {
                  router.push(projectPaths.entity(snapshot.project.key, id));
                }}
              />
            )}
          </section>
        </WorkspaceCenter>
      }
      rightSidebar={
        <SelectionInspector
          projectKey={snapshot.project.key}
          center={centerNode}
          node={selectedNode}
          entity={selectedEntity}
          feature={selectedFeature}
          relatedFeatures={relatedFeatures}
          directTasks={directAspectTasks}
          featureTasks={featureTasks}
          subaspectTasks={subaspectTasks}
          tags={selectedTags}
          incomingCount={incoming.length}
          outgoingCount={outgoing.length}
          onCenter={openScope}
        />
      }
    />
  );
}
