"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Background,
  ConnectionMode,
  Controls,
  MiniMap,
  MarkerType,
  ReactFlow,
  addEdge,
  useEdgesState,
  useNodesState,
  type Connection,
  type OnEdgesChange,
  type OnNodesChange
} from "@xyflow/react";
import {
  parseWorkflowGraph,
  bagViewAtNode,
  getNodeModel,
  renderWorkflowStory,
  renderWorkflowMermaid,
  warnMissingUpstreamKeys,
  warnShapeMismatches,
  WORKFLOW_SCHEMA_VERSION,
  type Entity,
  type WorkflowEdgeKind,
  type WorkflowGraph,
  type WorkflowNode,
  type WorkflowNodeData,
  type WorkflowNodeType,
  type WorkflowVariable
} from "@projectplaner/core";
import {
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
import { workflowRfNodeTypes, WorkflowPinsContext } from "./workflow-step-node";
import { workflowRfEdgeTypes, WorkflowWaypointProvider, useWaypointSelection } from "./workflow-exec-edge";
import { WorkflowToolbar } from "./workflow-toolbar";
import { WorkflowStoryPanel } from "./workflow-story-panel";
import { WorkflowDiagramPanel } from "./workflow-diagram-panel";
import { WorkflowCanvasContextMenu, WorkflowToolbarAdd } from "./workflow-add-menu";
import { useWorkflowInspectorPublisher } from "./workflow-inspector-context";

interface WorkflowWorkspaceProps {
  projectKey: string;
  flow: Entity;
}

function defaultDataForType(type: WorkflowNodeType): WorkflowNodeData {
  const title = type === "llm" ? "LLM step" : type.replaceAll("_", " ");
  switch (type) {
    case "tool":
      return { title, tool: { name: "tool_name" }, writes: ["result"] };
    case "llm":
      return {
        title,
        reads: ["goal"],
        writes: ["result"],
        llm: { instructions: "Describe the step responsibility.", inputKeys: ["goal"], outputSchema: ["result"] }
      };
    case "context":
      return {
        title,
        reads: ["goal"],
        writes: ["matches"],
        auto: { loadContext: { queryFrom: "goal", limit: 10 } }
      };
    case "transform":
      return {
        title,
        reads: ["matches"],
        writes: ["filtered"],
        auto: { filter: { from: "matches" } }
      };
    case "map":
      return {
        title,
        reads: ["matches"],
        writes: ["projected"],
        map: {
          from: "matches",
          as: "projected",
          mode: "array",
          fields: [
            { from: "id", as: "id" },
            { from: "title", as: "title" }
          ]
        }
      };
    case "join":
      return { title, join: { mode: "all", remaining: "cancel_remaining", merge: { strategy: "object_per_arm" } } };
    case "foreach":
      return {
        title,
        foreach: {
          itemsFrom: "items",
          itemKey: "item",
          indexKey: "itemIndex",
          failureMode: "fail"
        }
      };
    case "push":
      return {
        title,
        reads: ["items", "itemIndex", "results"],
        writes: ["results"],
        push: { target: "results", valueFrom: "items[itemIndex]" }
      };
    case "create_workflow_node":
      return getNodeModel("create_workflow_node").defaultData();
    case "subworkflow":
      return { title, subworkflow: { workflowId: "" } };
    case "wait":
      return { title, wait: { delayMs: 1000 } };
    case "switch":
      return { title, switch: { on: "type", cases: ["a", "b"], defaultLabel: "default" } };
    case "branch":
      return { title, branch: { on: "flag" } };
    case "start":
      return getNodeModel("start").defaultData();
    case "get":
      return { title: "Get", variable: "" };
    case "set":
      return { title: "Set", variable: "", inputs: { value: { required: true } } };
    case "reroute":
      return getNodeModel("reroute").defaultData();
    default:
      return { title };
  }
}

function applyVariablesToRfNodes(nodes: FlowRfNode[], variables: WorkflowVariable[]): FlowRfNode[] {
  const inputs = Object.fromEntries(
    variables
      .filter((variable) => variable.role === "input")
      .map((variable) => [variable.name, { required: variable.required, shape: variable.shape }])
  );
  const outputs = Object.fromEntries(
    variables
      .filter((variable) => variable.role === "output")
      .map((variable) => [variable.name, { required: variable.required, shape: variable.shape }])
  );
  return nodes.map((node) => {
    const workflow = node.data.workflow;
    if (workflow.type === "start") {
      return {
        ...node,
        data: { workflow: { ...workflow, data: { ...workflow.data, outputContracts: inputs } } }
      };
    }
    if (workflow.type === "end") {
      return {
        ...node,
        data: { workflow: { ...workflow, data: { ...workflow.data, inputs: outputs } } }
      };
    }
    return node;
  });
}

function isScaffoldGraph(nodes: Array<{ type: string }>): boolean {
  const work = new Set(["tool", "llm", "context", "transform", "map", "write"]);
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
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const presetKey = typeof flow.metadata.presetKey === "string" ? flow.metadata.presetKey : null;
  const [presetDirty, setPresetDirty] = useState(flow.metadata.presetDirty === true);
  const { publish, clear } = useWorkflowInspectorPublisher();

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
    [connectKind, edges, nodes, setEdges, variables]
  );

  const currentGraph = useCallback(
    () => fromRf(nodes as FlowRfNode[], edges, version, variables),
    [nodes, edges, version, variables]
  );

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

  const updateSelectedType = useCallback(
    (type: WorkflowNodeType) => {
      if (!selectedId) {
        return;
      }
      setNodes((current) =>
        current.map((node) => {
          if (node.id !== selectedId) {
            return node;
          }
          return {
            ...node,
            data: {
              workflow: {
                ...node.data.workflow,
                type,
                data: {
                  ...node.data.workflow.data,
                  ...defaultDataForType(type),
                  title: node.data.workflow.data.title
                }
              }
            }
          };
        })
      );
    },
    [selectedId, setNodes]
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
        data: defaultDataForType(type)
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
      return;
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
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  }, [currentGraph, flow.id, replaceGraph]);

  const startRun = useCallback(async () => {
    const graph = currentGraph();
    const parsed = parseWorkflowGraph(graph);
    if (!parsed.ok) {
      setErrors(parsed.errors);
      setStatus("Fix validation errors before Run.");
      return;
    }
    try {
      await save();
      const response = await fetch("/api/workflows/run", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          id: flow.id,
          goal: brief || flow.title,
          bag: {
            title: brief || flow.title,
            reason: `Workflow run of ${flow.title}`
          }
        })
      });
      const payload = (await response.json()) as {
        run?: { id: string; status?: string };
        step?: { kind?: string; message?: string; llm?: { instructions?: string; outputSchema?: string[] } };
        error?: string;
        note?: string;
      };
      if (!response.ok || !payload.run) {
        throw new Error(payload.error ?? "Run failed.");
      }
      const kind = payload.step?.kind ?? payload.run.status ?? "running";
      setStatus(
        [
          `Run ${payload.run.id}: ${kind}.`,
          payload.note,
          payload.step?.llm?.outputSchema
            ? `LLM writes: ${payload.step.llm.outputSchema.join(", ")}`
            : null
        ]
          .filter(Boolean)
          .join(" ")
      );
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Run failed.");
    }
  }, [brief, currentGraph, flow.id, flow.title, save]);

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
      diagramOpen,
      selected,
      bagView,
      pinMode,
      variables: variables ?? [],
      onUpdateVariables: updateVariables,
      onUpdateData: updateSelectedData,
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
    diagramOpen,
    selected,
    bagView,
    pinMode,
    variables,
    updateVariables,
    updateSelectedData,
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
        onRun={() => void startRun()}
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
          <WorkflowDiagramPanel source={mermaidSource} />
        </div>
      ) : (
        <div className="relative min-h-0 min-w-0 flex-1">
          <WorkflowWaypointProvider>
            <WorkflowFlowCanvas
              nodes={nodes}
              edges={edges}
              variables={variables ?? []}
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
        </div>
      )}
    </div>
  );
}

function WorkflowFlowCanvas({
  nodes,
  edges,
  variables,
  onNodesChange,
  onEdgesChange,
  onConnect,
  onSelectNode,
  onPaneContextMenu,
  contextMenu
}: {
  nodes: FlowRfNode[];
  edges: FlowRfEdge[];
  variables: WorkflowVariable[];
  onNodesChange: OnNodesChange<FlowRfNode>;
  onEdgesChange: OnEdgesChange<FlowRfEdge>;
  onConnect: (connection: Connection) => void;
  onSelectNode: (id: string | null) => void;
  onPaneContextMenu: (event: React.MouseEvent | MouseEvent) => void;
  contextMenu: ReactNode;
}) {
  const { selected, select } = useWaypointSelection();
  const pins = useMemo(() => ({ variables, nodes, edges }), [variables, nodes, edges]);

  return (
    <WorkflowPinsContext.Provider value={pins}>
      <ReactFlow<FlowRfNode, FlowRfEdge>
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        isValidConnection={(connection) => isValidWorkflowConnection(connection, { nodes, edges, variables })}
        connectionMode={ConnectionMode.Strict}
        connectionRadius={12}
        nodeTypes={workflowRfNodeTypes}
        edgeTypes={workflowRfEdgeTypes}
        fitView
        onNodeClick={(_, node) => {
          select(null);
          onSelectNode(node.id);
        }}
        onPaneClick={() => {
          select(null);
          onSelectNode(null);
        }}
        onPaneContextMenu={onPaneContextMenu}
        onNodeContextMenu={(event) => {
          event.preventDefault();
          onPaneContextMenu(event);
        }}
        deleteKeyCode={selected ? undefined : ["Backspace", "Delete"]}
        connectionLineStyle={{ stroke: "#57534e", strokeWidth: 3 }}
      >
        <Background gap={18} size={1} />
        <Controls />
        <MiniMap pannable zoomable />
      </ReactFlow>
      {contextMenu}
    </WorkflowPinsContext.Provider>
  );
}
