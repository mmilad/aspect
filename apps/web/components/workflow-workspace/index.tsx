"use client";

import { useCallback, useMemo, useState } from "react";
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
  writeWorkflowGraph,
  type Entity,
  type WorkflowGraph,
  type WorkflowNode,
  type WorkflowNodeData,
  type WorkflowNodeType
} from "@projectplaner/core";
import { fromRf, loadInitialGraph, toRfEdges, toRfNodes, type FlowRfNode } from "./rf-adapters";
import { workflowRfNodeTypes } from "./workflow-step-node";
import { WorkflowToolbar } from "./workflow-toolbar";
import { WorkflowAuthorPanel } from "./workflow-author-panel";
import { WorkflowPalette } from "./workflow-palette";
import { WorkflowNodeInspector } from "./workflow-node-inspector";

interface WorkflowWorkspaceProps {
  projectKey: string;
  flow: Entity;
}

export function WorkflowWorkspace({ projectKey, flow }: WorkflowWorkspaceProps) {
  const initial = useMemo(() => loadInitialGraph(flow.metadata), [flow.metadata]);
  const [version, setVersion] = useState(initial.version);
  const [nodes, setNodes, onNodesChange] = useNodesState(toRfNodes(initial, null));
  const [edges, setEdges, onEdgesChange] = useEdgesState(toRfEdges(initial));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [brief, setBrief] = useState(flow.body || flow.summary || "");
  const [authorOpen, setAuthorOpen] = useState(!initial.nodes.some((node) => node.type === "llm" || node.type === "tool"));

  const selected = nodes.find((node) => node.id === selectedId)?.data.workflow ?? null;

  const syncSelection = useCallback(
    (id: string | null) => {
      setSelectedId(id);
      setNodes((current) => current.map((node) => ({ ...node, selected: node.id === id })));
    },
    [setNodes]
  );

  const onConnect = useCallback(
    (connection: Connection) => {
      setEdges((current) =>
        addEdge(
          {
            ...connection,
            id: `e_${connection.source}_${connection.target}_${current.length + 1}`
          },
          current
        )
      );
    },
    [setEdges]
  );

  const currentGraph = useCallback(() => fromRf(nodes as FlowRfNode[], edges, version), [nodes, edges, version]);

  const replaceGraph = useCallback(
    (graph: WorkflowGraph) => {
      setVersion(graph.version);
      setNodes(toRfNodes(graph, null));
      setEdges(toRfEdges(graph));
      setSelectedId(null);
      setErrors([]);
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
                type
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
        data: {
          title: type === "llm" ? "LLM step" : type.charAt(0).toUpperCase() + type.slice(1),
          ...(type === "tool" ? { tool: { name: "tool_name" }, writes: ["result"] } : {}),
          ...(type === "llm"
            ? {
                reads: ["goal"],
                writes: ["result"],
                llm: { instructions: "Describe the step responsibility.", inputKeys: ["goal"], outputSchema: ["result"] }
              }
            : {}),
          ...(type === "context"
            ? {
                reads: ["goal"],
                writes: ["matches"],
                auto: { loadContext: { queryFrom: "goal", limit: 10 } }
              }
            : {}),
          ...(type === "filter"
            ? {
                reads: ["matches"],
                writes: ["filtered"],
                auto: { filter: { from: "matches" } }
              }
            : {})
        }
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
      setStatus("Validation failed.");
      return;
    }
    setSaving(true);
    setStatus(null);
    setErrors([]);
    try {
      const metadata = writeWorkflowGraph(flow.metadata, parsed.graph);
      const response = await fetch("/api/entities", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: flow.id, patch: { metadata } })
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error ?? "Save failed.");
      }
      setStatus("Saved to flow.metadata.graph.");
      setVersion(parsed.graph.version);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  }, [currentGraph, flow.id, flow.metadata]);

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
        replaceGraph(payload.graph);
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
        onToggleAuthor={() => setAuthorOpen((open) => !open)}
        onLoadExample={() => replaceGraph(exampleWorkflowGraph)}
        onLoadNewTask={() => replaceGraph(newTaskWorkflowGraph)}
        onResetEmpty={() => replaceGraph(emptyWorkflowGraph())}
        onSave={() => void save()}
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
        <WorkflowPalette status={status} errors={errors} onAddNode={addNode} />

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
          onUpdateData={updateSelectedData}
          onUpdateType={updateSelectedType}
          onDelete={deleteSelected}
        />
      </div>
    </div>
  );
}
