"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  MarkerType,
  addEdge,
  useEdgesState,
  useNodesState,
  type Connection,
  type OnNodesChange,
  type ReactFlowInstance
} from "@xyflow/react";
import type {
  Entity,
  WorkflowEdgeKind,
  WorkflowGraph,
  WorkflowNode,
  WorkflowNodeData,
  WorkflowNodeType,
  WorkflowVariable
} from "@projectplaner/core";
import generator from "@projectplaner/core/generator";
import workflow from "@projectplaner/core/workflow";

const { parse: parseWorkflowGraph, warnMissingUpstreamKeys } = workflow.graph;
const { getNodeModel, WORKFLOW_SCHEMA_VERSION } = workflow.nodes;
const { bagViewAtNode, warnShapeMismatches } = workflow.bag;
const { layoutWorkflowGraph, renderWorkflowMermaid, renderWorkflowStory } = generator.views;
import {
  applyVariablesToRfNodes,
  defaultEdgeKindForConnection,
  decodeHandle,
  fromRf,
  isDataHandle,
  isValidWorkflowConnection,
  loadInitialGraph,
  lookupPinShape,
  colorForBagShape,
  rfEdgeTypeForKind,
  spliceRerouteDataEdges,
  styleForEdgeKind,
  toRfEdges,
  toRfNodes,
  type FlowRfEdge,
  type FlowRfNode
} from "./rf-adapters";
import { renameDataPortEdges, removeDataPortEdges } from "./data-port-edges";
import { WorkflowWaypointProvider } from "./workflow-exec-edge";
import { WorkflowToolbar } from "./workflow-toolbar";
import { WorkflowStoryPanel } from "./workflow-story-panel";
import { WorkflowDiagramPanel } from "./workflow-diagram-panel";
import { WorkflowCanvasContextMenu, WorkflowToolbarAdd } from "./workflow-add-menu";
import { useAssistantContextPublisher } from "../project-shell/right-pane-context";
import { useWorkflowInspectorPublisher } from "./workflow-inspector-context";
import { WorkflowFlowCanvas } from "./workflow-flow-canvas";
import { TryLlmDialog } from "./try-llm-dialog";
import { RunWorkflowDialog } from "../workflow-run-dialog";

interface WorkflowWorkspaceProps {
  projectKey: string;
  flow: Entity;
}

function isScaffoldGraph(nodes: Array<{ type: string }>): boolean {
  const work = new Set(["tool", "llm", "context", "transform", "map", "math", "write"]);
  return !nodes.some((node) => work.has(node.type));
}

export function WorkflowWorkspace({ projectKey, flow }: WorkflowWorkspaceProps) {
  const initial = useMemo(() => loadInitialGraph(flow.metadata), [flow.metadata]);
  const [version, setVersion] = useState(initial.version || WORKFLOW_SCHEMA_VERSION);
  const [nodes, setNodes, onNodesChange] = useNodesState<FlowRfNode>(toRfNodes(initial, null));
  const [edges, setEdges, onEdgesChange] = useEdgesState<FlowRfEdge>(toRfEdges(initial));
  const [variables, setVariables] = useState<WorkflowVariable[] | undefined>(initial.variables);
  const pinMode = Array.isArray(variables);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [connectKind, setConnectKind] = useState<WorkflowEdgeKind>("next");
  const [brief, setBrief] = useState(flow.body || flow.summary || "");
  const [authorOpen, setAuthorOpen] = useState(() => isScaffoldGraph(initial.nodes));
  const [storyOpen, setStoryOpen] = useState(false);
  const [diagramOpen, setDiagramOpen] = useState(false);
  const [tryLlmNode, setTryLlmNode] = useState<WorkflowNode | null>(null);
  const [runDialogOpen, setRunDialogOpen] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const presetKey = typeof flow.metadata.presetKey === "string" ? flow.metadata.presetKey : null;
  const [presetDirty, setPresetDirty] = useState(flow.metadata.presetDirty === true);
  const { publish, clear } = useWorkflowInspectorPublisher();
  const publishAssistant = useAssistantContextPublisher();
  const rfRef = useRef<ReactFlowInstance<FlowRfNode, FlowRfEdge> | null>(null);

  const selected = nodes.find((node) => node.id === selectedId)?.data.workflow ?? null;
  const hasStart = nodes.some((node) => node.data.workflow.type === "start");
  const bagView = useMemo(() => {
    const graph = fromRf(nodes as FlowRfNode[], edges, version, variables);
    const parsed = parseWorkflowGraph(graph);
    const g = parsed.ok ? parsed.graph : graph;
    if (!selectedId) {
      return bagViewAtNode(g, findStartId(g) ?? "start");
    }
    return bagViewAtNode(g, selectedId);
  }, [nodes, edges, version, selectedId, variables]);

  const storyText = useMemo(() => {
    const graph = fromRf(nodes as FlowRfNode[], edges, version, variables);
    const parsed = parseWorkflowGraph(graph);
    const g = parsed.ok ? parsed.graph : graph;
    return renderWorkflowStory(g, {
      title: flow.title,
      description: brief.trim() || flow.summary || undefined
    });
  }, [nodes, edges, version, flow.title, flow.summary, brief, variables]);

  const mermaidSource = useMemo(() => {
    const graph = fromRf(nodes as FlowRfNode[], edges, version, variables);
    const parsed = parseWorkflowGraph(graph);
    const g = parsed.ok ? parsed.graph : graph;
    return renderWorkflowMermaid(g, { title: flow.title });
  }, [nodes, edges, version, flow.title, variables]);

  const workflowNodeIds = useMemo(() => nodes.map((node) => node.id), [nodes]);

  function findStartId(graph: WorkflowGraph): string | undefined {
    return graph.nodes.find((node) => node.type === "start")?.id;
  }

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch(`/api/workflows/${flow.id}`);
        if (!response.ok) {
          return;
        }
        const payload = (await response.json()) as { graph?: WorkflowGraph };
        if (!cancelled && payload.graph) {
          setVersion(payload.graph.version);
          setNodes(toRfNodes(payload.graph, null));
          setEdges(toRfEdges(payload.graph));
          setVariables(payload.graph.variables);
        }
      } catch {
        // Keep metadata fallback.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [flow.id, setEdges, setNodes]);

  useEffect(() => {
    publishAssistant?.({
      projectKey,
      flowId: flow.id,
      nodeId: selectedId ?? "",
      entityId: ""
    });
  }, [publishAssistant, projectKey, flow.id, selectedId]);

  const syncSelection = useCallback(
    (id: string | null) => {
      setSelectedId(id);
      setNodes((current) => current.map((node) => ({ ...node, selected: node.id === id })));
      if (id) {
        setAuthorOpen(false);
      }
    },
    [setNodes]
  );

  const onConnect = useCallback(
    (connection: Connection) => {
      if (!isValidWorkflowConnection(connection, { nodes, edges, variables })) {
        return;
      }
      const dataWire = isDataHandle(connection.sourceHandle) && isDataHandle(connection.targetHandle);
      const sourceNode = nodes.find((node) => node.id === connection.source);
      const targetNode = nodes.find((node) => node.id === connection.target);
      const kind: WorkflowEdgeKind = dataWire
        ? "data"
        : defaultEdgeKindForConnection(
            sourceNode?.data.workflow.type,
            targetNode?.data.workflow.type,
            connectKind
          );
      const sourcePin = decodeHandle(
        connection.sourceHandle,
        kind === "route" ? "default" : kind === "data" ? "" : "then"
      );
      const targetPin = decodeHandle(connection.targetHandle, kind === "data" ? "" : "in");
      if (dataWire && targetNode?.data.workflow.type === "break" && targetPin === "value") {
        const sourceShape = lookupPinShape(sourceNode?.data.workflow, sourcePin, "out", {
          variables,
          nodes,
          edges
        });
        if (sourceShape?.kind === "object") {
          setNodes((current) => current.map((node) => {
            if (node.id !== targetNode.id) return node;
            const workflowNode = node.data.workflow;
            const existingAliases = workflowNode.data.break?.fields ?? {};
            const fields = Object.fromEntries(Object.keys(sourceShape.fields).map((field) => [field, existingAliases[field] ?? field]));
            const outputContracts = Object.fromEntries(Object.entries(sourceShape.fields).map(([field, shape]) => [
              fields[field], { required: false, shape }
            ]));
            return {
              ...node,
              data: {
                ...node.data,
                workflow: {
                  ...workflowNode,
                  data: {
                    ...workflowNode.data,
                    break: { from: sourcePin, fields },
                    inputs: { ...(workflowNode.data.inputs ?? {}), value: { required: true, shape: sourceShape } },
                    outputContracts,
                    writes: Object.values(fields)
                  }
                }
              }
            };
          }));
        }
      }
      const color = dataWire
        ? colorForBagShape(
            lookupPinShape(sourceNode?.data.workflow, sourcePin, "out", {
              variables,
              nodes,
              edges
            })
          )
        : undefined;
      const kindStyle = styleForEdgeKind(kind, color);
      setEdges((current) =>
        addEdge(
          {
            ...connection,
            id: `e_${connection.source}_${connection.target}_${current.length + 1}`,
            type: rfEdgeTypeForKind(kind),
            data: { kind, ...(color ? { color } : {}) },
            markerEnd:
              kind !== "data" && rfEdgeTypeForKind(kind) === "exec"
                ? {
                    type: MarkerType.ArrowClosed,
                    color: kind === "error" ? "#9f1239" : "#57534e",
                    width: 14,
                    height: 14
                  }
                : undefined,
            label:
              kind === "route"
                ? sourcePin
                : targetPin === "continue"
                  ? "continue"
                  : kind === "depends_on"
                    ? "depends_on"
                    : undefined,
            ...kindStyle,
            sourceHandle: connection.sourceHandle,
            targetHandle: connection.targetHandle
          },
          current
        )
      );
    },
    [connectKind, edges, nodes, setEdges, setNodes, variables]
  );

  const currentGraph = useCallback(
    () => fromRf(nodes as FlowRfNode[], edges, version, variables),
    [nodes, edges, version, variables]
  );
  const displayedNodes = useMemo(
    () =>
      nodes.map((node) => ({
        ...node,
        data: {
          ...node.data,
          onTryLlm: (workflowNode: WorkflowNode) => {
            setTryLlmNode(workflowNode);
            syncSelection(workflowNode.id);
          }
        }
      })),
    [nodes, syncSelection]
  );

  const formatLayout = useCallback(() => {
    const laid = layoutWorkflowGraph(currentGraph());
    setNodes(toRfNodes(laid, selectedId));
    setEdges(toRfEdges(laid));
    requestAnimationFrame(() => {
      rfRef.current?.fitView({ padding: 0.18, duration: 200 });
    });
  }, [currentGraph, selectedId, setEdges, setNodes]);

  const replaceGraph = useCallback(
    (graph: WorkflowGraph) => {
      setVersion(graph.version);
      setNodes(toRfNodes(graph, null));
      setEdges(toRfEdges(graph));
      setVariables(graph.variables);
      setSelectedId(null);
      setErrors([]);
      setWarnings([...warnMissingUpstreamKeys(graph), ...warnShapeMismatches(graph)]);
      setStatus(null);
    },
    [setNodes, setEdges]
  );

  const updateVariables = useCallback(
    (next: WorkflowVariable[]) => {
      setVariables(next);
      setNodes((current) => applyVariablesToRfNodes(current, next));
    },
    [setNodes]
  );

  const updateSelectedData = useCallback(
    (patch: Partial<WorkflowNodeData>) => {
      if (!selectedId) {
        return;
      }
      setNodes((current) =>
        current.map((node) => {
          if (node.id !== selectedId) {
            return node;
          }
          const workflow = node.data.workflow;
          return {
            ...node,
            data: {
              workflow: {
                ...workflow,
                data: { ...workflow.data, ...patch }
              }
            }
          };
        })
      );
    },
    [selectedId, setNodes]
  );

  const renameDataPort = useCallback(
    (nodeId: string, direction: "in" | "out", from: string, to: string) => {
      setEdges((current) => renameDataPortEdges(current, nodeId, direction, from, to));
    },
    [setEdges]
  );

  const removeDataPort = useCallback(
    (nodeId: string, direction: "in" | "out", portId: string) => {
      setEdges((current) => removeDataPortEdges(current, nodeId, direction, portId));
    },
    [setEdges]
  );

  const addNode = useCallback(
    (type: WorkflowNodeType) => {
      if (type === "start" && nodes.some((node) => node.data.workflow.type === "start")) {
        setStatus("Workflow already has a Start node.");
        return;
      }
      const id = `${type}_${Date.now().toString(36)}`;
      const workflow: WorkflowNode = {
        id,
        type,
        position: { x: 160 + nodes.length * 24, y: 80 + (nodes.length % 4) * 72 },
        data: getNodeModel(type).defaultData()
      };
      setNodes((current) => [
        ...current,
        {
          id,
          type: "workflow",
          position: workflow.position,
          deletable: type !== "start",
          data: { workflow }
        }
      ]);
      syncSelection(id);
    },
    [nodes, setNodes, syncSelection]
  );

  const deleteSelected = useCallback(() => {
    const selectedNode = nodes.find((node) => node.id === selectedId);
    if (!selectedId || selectedNode?.data.workflow.type === "start") {
      return;
    }
    const reroute = selectedNode?.data.workflow.type === "reroute";
    setNodes((current) => current.filter((node) => node.id !== selectedId));
    setEdges((current) =>
      reroute
        ? spliceRerouteDataEdges(current, selectedId)
        : current.filter((edge) => edge.source !== selectedId && edge.target !== selectedId)
    );
    syncSelection(null);
  }, [selectedId, nodes, setNodes, setEdges, syncSelection]);

  const handleNodesChange = useCallback<OnNodesChange<FlowRfNode>>(
    (changes) => {
      const removed = changes.filter((change) => change.type === "remove");
      const rerouteIds = removed
        .map((change) => change.id)
        .filter((id) => nodes.find((node) => node.id === id)?.data.workflow.type === "reroute");
      if (rerouteIds.length > 0) {
        setEdges((current) => rerouteIds.reduce((next, id) => spliceRerouteDataEdges(next, id), current));
      }
      onNodesChange(changes);
    },
    [nodes, onNodesChange, setEdges]
  );

  const save = useCallback(async () => {
    const graph = currentGraph();
    const parsed = parseWorkflowGraph(graph);
    if (!parsed.ok) {
      setErrors(parsed.errors);
      setWarnings([]);
      setStatus("Validation failed.");
      return false;
    }
    setSaving(true);
    setStatus(null);
    setErrors([]);
    setWarnings([...warnMissingUpstreamKeys(parsed.graph), ...warnShapeMismatches(parsed.graph)]);
    try {
      const response = await fetch(`/api/workflows/${flow.id}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ graph: parsed.graph })
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error ?? "Save failed.");
      }
      setStatus("Saved workflow nodes/edges (v2 tables + metadata mirror).");
      setVersion(parsed.graph.version);
      if (presetKey) {
        setPresetDirty(true);
      }
      replaceGraph(parsed.graph);
      return true;
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Save failed.");
      return false;
    } finally {
      setSaving(false);
    }
  }, [currentGraph, flow.id, presetKey, replaceGraph]);

  const openRunDialog = useCallback(async () => {
    const graph = currentGraph();
    const parsed = parseWorkflowGraph(graph);
    if (!parsed.ok) {
      setErrors(parsed.errors);
      setStatus("Fix validation errors before Run.");
      return;
    }
    const saved = await save();
    if (saved) {
      setRunDialogOpen(true);
    }
  }, [currentGraph, save]);

  const generateFromBrief = useCallback(
    async (scaffoldOnly = false) => {
      if (!brief.trim()) {
        setStatus("Describe what the workflow should do first.");
        return;
      }
      setGenerating(true);
      setStatus(null);
      setErrors([]);
      try {
        const response = await fetch("/api/workflows/generate", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            brief: brief.trim(),
            title: flow.title,
            scaffoldOnly
          })
        });
        const payload = (await response.json()) as {
          graph?: WorkflowGraph;
          outline?: string;
          graphJson?: string;
          source?: string;
          error?: string;
          llmConfigured?: boolean;
        };
        if (!response.ok || !payload.graph) {
          throw new Error(payload.error ?? "Generate failed.");
        }
        const parsed = parseWorkflowGraph(payload.graph);
        replaceGraph(parsed.ok ? parsed.graph : payload.graph);
        if (payload.source === "llm_two_turn" || payload.source === "llm") {
          const outlineHint = payload.outline?.trim()
            ? ` Outline: ${payload.outline.trim().slice(0, 120)}${payload.outline.trim().length > 120 ? "…" : ""}`
            : "";
          setStatus(`Generated with local LLM (outline → JSON).${outlineHint} Review nodes, then Save.`);
        } else if (payload.llmConfigured) {
          setStatus("Scaffold applied (forced). Review, then Save.");
        } else {
          setStatus(
            "Scaffold applied (no LLM configured). Set PROJECTPLANER_LLM_BASE_URL + PROJECTPLANER_LLM_MODEL to generate with a model."
          );
        }
        setAuthorOpen(false);
      } catch (error) {
        setStatus(error instanceof Error ? error.message : "Generate failed.");
      } finally {
        setGenerating(false);
      }
    },
    [brief, flow.title, replaceGraph]
  );

  useEffect(() => {
    publish({
      selected,
      bagView,
      pinMode,
      variables: variables ?? [],
      onUpdateVariables: updateVariables,
      onUpdateData: updateSelectedData,
      onRenameDataPort: renameDataPort,
      onRemoveDataPort: removeDataPort,
      onDelete: deleteSelected,
      authorOpen,
      brief,
      generating,
      onBriefChange: setBrief,
      onGenerate: (scaffoldOnly) => void generateFromBrief(scaffoldOnly),
      setAuthorOpen
    });
  }, [
    publish,
    selected,
    bagView,
    pinMode,
    variables,
    updateVariables,
    updateSelectedData,
    renameDataPort,
    removeDataPort,
    deleteSelected,
    authorOpen,
    brief,
    generating,
    generateFromBrief
  ]);

  useEffect(() => {
    return () => clear();
  }, [clear]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <WorkflowToolbar
        projectKey={projectKey}
        flowId={flow.id}
        flowTitle={flow.title}
        version={version}
        authorOpen={authorOpen}
        storyOpen={storyOpen}
        diagramOpen={diagramOpen}
        saving={saving}
        presetKey={presetKey}
        presetDirty={presetDirty}
        onToggleAuthor={() => setAuthorOpen((open) => !open)}
        onToggleStory={() => setStoryOpen((open) => !open)}
        onToggleDiagram={() => setDiagramOpen((open) => !open)}
        onSave={() => void save()}
        onFormat={formatLayout}
        onRun={() => void openRunDialog()}
        addSlot={
          diagramOpen ? null : (
            <WorkflowToolbarAdd
              connectKind={connectKind}
              onConnectKindChange={setConnectKind}
              onAddNode={addNode}
              hasStart={hasStart}
            />
          )
        }
      />

      {status || errors.length > 0 || warnings.length > 0 ? (
        <div className="border-b border-border bg-white px-3 py-1.5 text-xs text-muted-foreground">
          {status ? <span>{status}</span> : null}
          {errors.length > 0 ? (
            <span className="ml-2 text-rose-700">{errors.join(" · ")}</span>
          ) : null}
          {warnings.length > 0 ? (
            <span className="ml-2 text-amber-700">{warnings.join(" · ")}</span>
          ) : null}
        </div>
      ) : null}

      {storyOpen ? <WorkflowStoryPanel story={storyText} /> : null}

      {diagramOpen ? (
        <div className="min-h-0 flex-1">
          <WorkflowDiagramPanel
            source={mermaidSource}
            workflowNodeIds={workflowNodeIds}
            selectedId={selectedId}
            onSelectNode={syncSelection}
          />
        </div>
      ) : (
        <div className="relative min-h-0 min-w-0 flex-1">
          <WorkflowWaypointProvider>
            <WorkflowFlowCanvas
              nodes={displayedNodes}
              edges={edges}
              variables={variables ?? []}
              onInit={(instance) => {
                rfRef.current = instance;
              }}
              onNodesChange={handleNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              onSelectNode={(id) => {
                syncSelection(id);
                if (!id) {
                  setContextMenu(null);
                }
              }}
              onPaneContextMenu={(event) => {
                event.preventDefault();
                setContextMenu({ x: event.clientX, y: event.clientY });
              }}
              contextMenu={
                <WorkflowCanvasContextMenu
                  position={contextMenu}
                  connectKind={connectKind}
                  onConnectKindChange={setConnectKind}
                  onAddNode={addNode}
                  onClose={() => setContextMenu(null)}
                  hasStart={hasStart}
                />
              }
            />
          </WorkflowWaypointProvider>
          {tryLlmNode ? (
            <TryLlmDialog
              projectKey={projectKey}
              node={nodes.find((item) => item.id === tryLlmNode.id)?.data.workflow ?? tryLlmNode}
              bagView={bagView}
              onClose={() => setTryLlmNode(null)}
            />
          ) : null}
        </div>
      )}
      {runDialogOpen ? (
        <RunWorkflowDialog
          flowId={flow.id}
          flowTitle={flow.title}
          onClose={() => setRunDialogOpen(false)}
          onRan={(summary) => setStatus(summary)}
        />
      ) : null}
    </div>
  );
}
