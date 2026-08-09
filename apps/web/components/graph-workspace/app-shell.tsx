"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useNodesState } from "@xyflow/react";
import { focusGraph, type EntityType, type ProjectPlanSnapshot } from "@projectplaner/core";
import { ProjectLeftSidebar } from "../project-left-sidebar";
import { ProjectShell } from "../project-shell";
import { SelectionInspector } from "../selection-inspector";
import { WorkspaceCenter } from "../workspace-center";
import { projectPaths } from "../../lib/project-paths";
import { getAncestors } from "./lib/ancestors";
import { buildGraphEntities } from "./lib/build-graph-entities";
import {
  buildFullFlowEdges,
  buildFullFlowNodes,
  buildScopedFlowEdges,
  buildScopedFlowNodes
} from "./lib/build-flow-nodes";
import { orderedEntityTypes } from "./lib/ordered-entity-types";
import { scoreEntity } from "./lib/score-entity";
import {
  buildInspectorSelectionData,
  resolveInitialSelection,
  resolveSelection
} from "./lib/selection-context";
import { getVisibleEntityRelations } from "./lib/visible-relations";
import { GraphCanvas } from "./graph-canvas";
import { GraphToolbar } from "./graph-toolbar";
import { SpatialGraphCanvas } from "./spatial-graph-canvas";
import type { GraphMatch, GraphMode, GraphSurface } from "./types";

interface AppShellProps {
  snapshot: ProjectPlanSnapshot;
  graphOnly?: boolean;
  initialSelectedId?: string;
}

export function AppShell({ snapshot, graphOnly = false, initialSelectedId }: AppShellProps) {
  const router = useRouter();
  const pathname = usePathname();
  const allGraphEntities = useMemo(() => buildGraphEntities(snapshot), [snapshot]);
  const { rootNode, initialSelectedEntity, initialCenterNode } = resolveInitialSelection({
    snapshot,
    allGraphEntities,
    initialSelectedId
  });
  const allEntityTypes = useMemo(
    () => orderedEntityTypes(allGraphEntities.map((entity) => entity.type)),
    [allGraphEntities]
  );
  const [graphMode, setGraphMode] = useState<GraphMode>("full");
  const [graphSurface, setGraphSurface] = useState<GraphSurface>("map");
  const [activeTypes, setActiveTypes] = useState<Set<EntityType>>(() => new Set(allGraphEntities.map((entity) => entity.type)));
  const [centerId, setCenterId] = useState(initialCenterNode.id);
  const [selectedId, setSelectedId] = useState(initialSelectedEntity.id ?? rootNode.id);
  const [selectedFeatureId, setSelectedFeatureId] = useState<string | null>(
    initialSelectedEntity.type === "feature" ? initialSelectedEntity.id : null
  );
  const [query, setQuery] = useState("");

  const centerNode = snapshot.nodes.find((node) => node.id === centerId) ?? rootNode;
  const { selectedEntity, selectedNode, selectedFeature } = resolveSelection({
    snapshot,
    allGraphEntities,
    centerNode,
    selectedId,
    selectedFeatureId
  });
  const parentNode = centerNode.parentId ? snapshot.nodes.find((node) => node.id === centerNode.parentId) : null;
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

  const scopedNodes = buildScopedFlowNodes({
    nodes: graph.nodes,
    centerNode,
    allGraphEntities,
    selectedId
  });

  const scoredEntities = useMemo(
    () =>
      allGraphEntities
        .map((entity) => ({ entity, score: scoreEntity(entity, query) }))
        .filter(({ entity, score }) => activeTypes.has(entity.type) && (!query.trim() || score > 0))
        .sort((left, right) => right.score - left.score || left.entity.sortOrder - right.entity.sortOrder),
    [activeTypes, allGraphEntities, query]
  );

  const fullGraphNodes = useMemo(
    () =>
      buildFullFlowNodes({
        scoredEntities,
        entityTypes: allEntityTypes,
        centerId: centerNode.id,
        selectedId,
        selectedFeatureId,
        query
      }),
    [allEntityTypes, centerNode.id, query, scoredEntities, selectedFeatureId, selectedId]
  );

  const graphNodes = graphMode === "full" ? fullGraphNodes : scopedNodes;
  const [flowNodes, setFlowNodes, onNodesChange] = useNodesState(graphNodes);

  useEffect(() => {
    setFlowNodes((current) => {
      const positionsById = new Map(current.map((node) => [node.id, node.position]));
      return graphNodes.map((node) => {
        const position = positionsById.get(node.id);
        return position ? { ...node, position } : node;
      });
    });
  }, [graphNodes, setFlowNodes]);

  const focusId = selectedFeatureId ?? selectedId;
  const visibleEntityRelations = getVisibleEntityRelations(snapshot);
  const displayedMatches: GraphMatch[] =
    graphMode === "full" ? scoredEntities : graphNodes.map((node) => ({ entity: node.data.entity, score: node.data.score ?? 0 }));
  const displayedIds = new Set(displayedMatches.map(({ entity }) => entity.id));
  const flowEdges =
    graphMode === "full"
      ? buildFullFlowEdges({ relations: visibleEntityRelations, displayedIds, focusId })
      : buildScopedFlowEdges({
          nodes: graph.nodes,
          relations: graph.relations,
          centerNode,
          focusId
        });

  const inspector = buildInspectorSelectionData({
    snapshot,
    selectedNode,
    selectedEntity
  });
  const searchMatches = useMemo(
    () => scoredEntities.filter((match) => query.trim() && match.score > 0).slice(0, 8),
    [query, scoredEntities]
  );

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
      chrome={{ entityId: selectedId ?? centerNode.id }}
      leftSidebar={
        <ProjectLeftSidebar
          snapshot={snapshot}
          activeView={graphOnly ? "graph" : "workspace"}
          selectedId={selectedId}
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
                onOpen={openScope}
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
          relatedFeatures={inspector.relatedFeatures}
          directTasks={inspector.directTasks}
          featureTasks={inspector.featureTasks}
          subaspectTasks={inspector.subaspectTasks}
          tags={inspector.tags}
          snapshot={snapshot}
          incomingCount={inspector.incomingCount}
          outgoingCount={inspector.outgoingCount}
          onCenter={openScope}
        />
      }
    />
  );
}
