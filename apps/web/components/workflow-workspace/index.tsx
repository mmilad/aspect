"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  addEdge,
  useEdgesState,
  useNodesState,
  type Connection
} from "@xyflow/react";
import {
  emptyWorkflowGraph,
  exampleWorkflowGraph,
  newTaskWorkflowGraph,
  parseWorkflowGraph,
  bagViewAtNode,
  warnMissingUpstreamKeys,
  warnShapeMismatches,
  WORKFLOW_SCHEMA_VERSION,
  type Entity,
  type WorkflowEdgeKind,
  type WorkflowGraph,
  type WorkflowNode,
  type WorkflowNodeData,
  type WorkflowNodeType
} from "@projectplaner/core";
import {
  defaultEdgeKindForConnection,
  fromRf,
  loadInitialGraph,
  toRfEdges,
  toRfNodes,
  type FlowRfNode
} from "./rf-adapters";
import { workflowRfNodeTypes } from "./workflow-step-node";
import { WorkflowToolbar } from "./workflow-toolbar";
import { WorkflowAuthorPanel } from "./workflow-author-panel";
import { WorkflowPalette } from "./workflow-palette";
import { WorkflowNodeInspector } from "./workflow-node-inspector";

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
          body: { type: "subworkflow", workflowId: "" },
          failureMode: "fail",
          collect: { from: "result", as: "results" }
        }
      };
    case "subworkflow":
      return { title, subworkflow: { workflowId: "" } };
    case "wait":
      return { title, wait: { delayMs: 1000 } };
    case "switch":
      return { title, switch: { on: "route" } };
    case "start":
      return { title: "Start", writes: ["goal"] };
    default:
      return { title };
  }
}

export function WorkflowWorkspace({ projectKey, flow }: WorkflowWorkspaceProps) {
  const initial = useMemo(() => loadInitialGraph(flow.metadata), [flow.metadata]);
  const [version, setVersion] = useState(initial.version || WORKFLOW_SCHEMA_VERSION);
  const [nodes, setNodes, onNodesChange] = useNodesState(toRfNodes(initial, null));
  const [edges, setEdges, onEdgesChange] = useEdgesState(toRfEdges(initial));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [connectKind, setConnectKind] = useState<WorkflowEdgeKind>("next");
  const [brief, setBrief] = useState(flow.body || flow.summary || "");
  const [authorOpen, setAuthorOpen] = useState(
    !initial.nodes.some((node) => node.type === "llm" || node.type === "tool")
  );
  const presetKey = typeof flow.metadata.presetKey === "string" ? flow.metadata.presetKey : null;
  const [presetDirty, setPresetDirty] = useState(flow.metadata.presetDirty === true);

  const selected = nodes.find((node) => node.id === selectedId)?.data.workflow ?? null;
  const bagView = useMemo(() => {
    const graph = fromRf(nodes as FlowRfNode[], edges, version);
    const parsed = parseWorkflowGraph(graph);
    const g = parsed.ok ? parsed.graph : graph;
    if (!selectedId) {
      return bagViewAtNode(g, findStartId(g) ?? "start");
    }
    return bagViewAtNode(g, selectedId);
  }, [nodes, edges, version, selectedId]);

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
    },
    [setNodes]
  );

  const onConnect = useCallback(
    (connection: Connection) => {
      const sourceNode = nodes.find((node) => node.id === connection.source);
      const targetNode = nodes.find((node) => node.id === connection.target);
      const kind = defaultEdgeKindForConnection(
        sourceNode?.data.workflow.type,
        targetNode?.data.workflow.type,
        connectKind
      );
      setEdges((current) =>
        addEdge(
          {
            ...connection,
            id: `e_${connection.source}_${connection.target}_${current.length + 1}`,
            data: { kind },
            label: kind === "route" ? "default" : kind === "depends_on" ? "depends_on" : undefined,
            style:
              kind === "depends_on"
                ? { stroke: "#0369a1", strokeWidth: 1.5, strokeDasharray: "6 4" }
                : kind === "route"
                  ? { stroke: "#7c3aed", strokeWidth: 1.75 }
                  : kind === "error"
                    ? { stroke: "#e11d48", strokeWidth: 1.75 }
                    : { stroke: "#3f3f46", strokeWidth: 1.5 }
          },
          current
        )
      );
    },
    [connectKind, nodes, setEdges]
  );

  const currentGraph = useCallback(
    () => fromRf(nodes as FlowRfNode[], edges, version),
    [nodes, edges, version]
  );

  const replaceGraph = useCallback(
    (graph: WorkflowGraph) => {
      setVersion(graph.version);
      setNodes(toRfNodes(graph, null));
      setEdges(toRfEdges(graph));
      setSelectedId(null);
      setErrors([]);
      setWarnings([...warnMissingUpstreamKeys(graph), ...warnShapeMismatches(graph)]);
      setStatus(null);
    },
    [setNodes, setEdges]
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
      const id = `${type}_${Date.now().toString(36)}`;
      const workflow: WorkflowNode = {
        id,
        type,
        position: { x: 160 + nodes.length * 24, y: 80 + (nodes.length % 4) * 72 },
        data: defaultDataForType(type)
      };
      setNodes((current) => [...current, { id, type: "workflow", position: workflow.position, data: { workflow } }]);
      syncSelection(id);
    },
    [nodes.length, setNodes, syncSelection]
  );

  const deleteSelected = useCallback(() => {
    if (!selectedId || selectedId === "start") {
      return;
    }
    setNodes((current) => current.filter((node) => node.id !== selectedId));
    setEdges((current) => current.filter((edge) => edge.source !== selectedId && edge.target !== selectedId));
    syncSelection(null);
  }, [selectedId, setNodes, setEdges, syncSelection]);

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
      const response = await fetch(`/api/workflows/${flow.id}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "run", goal: brief || flow.title })
      });
      const payload = (await response.json()) as { run?: { id: string }; error?: string; note?: string };
      if (!response.ok || !payload.run) {
        throw new Error(payload.error ?? "Run failed.");
      }
      setStatus(`Run ${payload.run.id} snapshot frozen. ${payload.note ?? ""}`);
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
          source?: string;
          error?: string;
          llmConfigured?: boolean;
        };
        if (!response.ok || !payload.graph) {
          throw new Error(payload.error ?? "Generate failed.");
        }
        const parsed = parseWorkflowGraph(payload.graph);
        replaceGraph(parsed.ok ? parsed.graph : payload.graph);
        setStatus(
          payload.source === "llm"
            ? "Generated with local LLM. Review nodes, then Save."
            : payload.llmConfigured
              ? "Scaffold applied (forced). Review, then Save."
              : "Scaffold applied (no LLM configured). Set PROJECTPLANER_LLM_BASE_URL + PROJECTPLANER_LLM_MODEL to generate with a model."
        );
        setAuthorOpen(false);
      } catch (error) {
        setStatus(error instanceof Error ? error.message : "Generate failed.");
      } finally {
        setGenerating(false);
      }
    },
    [brief, flow.title, replaceGraph]
  );

  return (
    <div className="flex h-full min-h-0 flex-col">
      <WorkflowToolbar
        projectKey={projectKey}
        flowId={flow.id}
        flowTitle={flow.title}
        version={version}
        authorOpen={authorOpen}
        saving={saving}
        presetKey={presetKey}
        presetDirty={presetDirty}
        onToggleAuthor={() => setAuthorOpen((open) => !open)}
        onLoadExample={() => replaceGraph(exampleWorkflowGraph)}
        onLoadNewTask={() => replaceGraph(newTaskWorkflowGraph)}
        onResetEmpty={() => replaceGraph(emptyWorkflowGraph())}
        onSave={() => void save()}
        onRun={() => void startRun()}
      />

      {authorOpen ? (
        <WorkflowAuthorPanel
          brief={brief}
          generating={generating}
          onBriefChange={setBrief}
          onGenerate={(scaffoldOnly) => void generateFromBrief(scaffoldOnly)}
        />
      ) : null}

      <div className="flex min-h-0 flex-1">
        <WorkflowPalette
          status={status}
          errors={errors}
          warnings={warnings}
          connectKind={connectKind}
          onConnectKindChange={setConnectKind}
          onAddNode={addNode}
        />

        <div className="min-w-0 flex-1">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            nodeTypes={workflowRfNodeTypes}
            fitView
            onNodeClick={(_, node) => syncSelection(node.id)}
            onPaneClick={() => syncSelection(null)}
            deleteKeyCode={["Backspace", "Delete"]}
          >
            <Background gap={18} size={1} />
            <Controls />
            <MiniMap pannable zoomable />
          </ReactFlow>
        </div>

        <WorkflowNodeInspector
          selected={selected}
          bagView={bagView}
          onUpdateData={updateSelectedData}
          onUpdateType={updateSelectedType}
          onDelete={deleteSelected}
        />
      </div>
    </div>
  );
}
