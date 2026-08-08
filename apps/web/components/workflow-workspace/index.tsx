"use client";

import { useCallback, useMemo, useState } from "react";
import {
  Background,
  Controls,
  Handle,
  MiniMap,
  ReactFlow,
  addEdge,
  useEdgesState,
  useNodesState,
  type Connection,
  type Edge,
  type Node,
  type NodeProps,
  Position
} from "@xyflow/react";
import {
  emptyWorkflowGraph,
  exampleWorkflowGraph,
  newTaskWorkflowGraph,
  parseWorkflowGraph,
  writeWorkflowGraph,
  workflowNodeTypes,
  type Entity,
  type JsonRecord,
  type WorkflowGraph,
  type WorkflowNode,
  type WorkflowNodeData,
  type WorkflowNodeType
} from "@projectplaner/core";
import { Badge, FormLabel, GhostButton, Select, TextArea, TextInput, ToolbarLink } from "../ui";
import { projectPaths } from "../../lib/project-paths";
import { workflowStepToneByType } from "../../lib/workflow-tones";
import { cn } from "../../lib/utils";

type FlowRfNode = Node<{ workflow: WorkflowNode }, "workflow">;

function toRfNodes(graph: WorkflowGraph, selectedId: string | null): FlowRfNode[] {
  return graph.nodes.map((node) => ({
    id: node.id,
    type: "workflow",
    position: node.position,
    selected: node.id === selectedId,
    data: { workflow: node }
  }));
}

function toRfEdges(graph: WorkflowGraph): Edge[] {
  return graph.edges.map((edge) => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    label: edge.label,
    animated: false
  }));
}

function fromRf(nodes: FlowRfNode[], edges: Edge[], version: number): WorkflowGraph {
  return {
    version,
    nodes: nodes.map((node) => ({
      ...node.data.workflow,
      id: node.id,
      position: node.position
    })),
    edges: edges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      label: typeof edge.label === "string" ? edge.label : undefined
    }))
  };
}

function WorkflowStepNode({ data, selected }: NodeProps<FlowRfNode>) {
  const node = data.workflow;
  return (
    <div
      className={cn(
        "min-w-[140px] rounded-md border-2 px-3 py-2 shadow-sm",
        workflowStepToneByType[node.type],
        selected && "ring-2 ring-offset-2 ring-zinc-900"
      )}
    >
      <Handle type="target" position={Position.Left} className="!bg-zinc-700" />
      <div className="text-[10px] font-semibold uppercase tracking-wide opacity-70">{node.type}</div>
      <div className="text-sm font-medium leading-tight">{node.data.title}</div>
      {node.data.writes?.length ? (
        <div className="mt-1 text-[10px] opacity-70">writes: {node.data.writes.join(", ")}</div>
      ) : null}
      <Handle type="source" position={Position.Right} className="!bg-zinc-700" />
    </div>
  );
}

const nodeTypes = { workflow: WorkflowStepNode };

function loadInitialGraph(metadata: JsonRecord): WorkflowGraph {
  const parsed = parseWorkflowGraph(metadata.graph);
  if (parsed.ok) {
    return parsed.graph;
  }
  return emptyWorkflowGraph();
}

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
      <div className="flex flex-wrap items-center gap-2 border-b border-border bg-white px-3 py-2">
        <Badge tone="flow">workflow</Badge>
        <div className="text-sm font-medium text-zinc-900">{flow.title}</div>
        <div className="font-mono text-xs text-muted-foreground">v{version}</div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <ToolbarLink href={projectPaths.entity(projectKey, flow.id)} size="xs">
            Entity
          </ToolbarLink>
          <ToolbarLink href={projectPaths.graph(projectKey, flow.id)} size="xs">
            Aspect Graph
          </ToolbarLink>
          <GhostButton size="xs" tone={authorOpen ? "accent" : "default"} active={authorOpen} onClick={() => setAuthorOpen((open) => !open)}>
            Describe
          </GhostButton>
          <GhostButton size="xs" onClick={() => replaceGraph(exampleWorkflowGraph)}>
            Load example
          </GhostButton>
          <GhostButton size="xs" onClick={() => replaceGraph(newTaskWorkflowGraph)}>
            Load New Task
          </GhostButton>
          <GhostButton size="xs" onClick={() => replaceGraph(emptyWorkflowGraph())}>
            Reset empty
          </GhostButton>
          <GhostButton size="xs" tone="primary" disabled={saving} onClick={() => void save()}>
            {saving ? "Saving…" : "Save graph"}
          </GhostButton>
        </div>
      </div>

      {authorOpen ? (
        <div className="border-b border-amber-200 bg-amber-50/70 px-3 py-3">
          <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-amber-900">Author with brief</div>
          <p className="mb-2 text-xs text-amber-950/80">
            Explain what this workflow should do. Generate builds a step graph (LLM if configured, otherwise a scaffold with your brief on an llm node).
          </p>
          <TextArea
            className="min-h-20 border-amber-300"
            placeholder="e.g. Given a user goal, load matching aspects, pick the smallest truthful one, then create a feature + tasks."
            value={brief}
            onChange={(event) => setBrief(event.target.value)}
          />
          <div className="mt-2 flex flex-wrap gap-2">
            <GhostButton size="xs" tone="accent" disabled={generating} onClick={() => void generateFromBrief(false)}>
              {generating ? "Generating…" : "Generate workflow"}
            </GhostButton>
            <GhostButton size="xs" disabled={generating} onClick={() => void generateFromBrief(true)}>
              Scaffold only
            </GhostButton>
          </div>
        </div>
      ) : null}

      <div className="flex min-h-0 flex-1">
        <aside className="w-44 shrink-0 overflow-y-auto border-r border-border bg-white p-2">
          <div className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Add node</div>
          <div className="flex flex-col gap-1">
            {workflowNodeTypes.map((type) => (
              <button
                key={type}
                type="button"
                className="rounded-md border border-border px-2 py-1.5 text-left text-xs capitalize hover:bg-muted"
                onClick={() => addNode(type)}
              >
                {type}
              </button>
            ))}
          </div>
          {status ? <p className="mt-3 text-xs text-muted-foreground">{status}</p> : null}
          {errors.length > 0 ? (
            <ul className="mt-2 list-disc space-y-1 pl-4 text-[11px] text-rose-700">
              {errors.map((error) => (
                <li key={error}>{error}</li>
              ))}
            </ul>
          ) : null}
        </aside>

        <div className="min-w-0 flex-1">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            nodeTypes={nodeTypes}
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

        <aside className="w-72 shrink-0 overflow-y-auto border-l border-border bg-white p-3">
          {!selected ? (
            <p className="text-sm text-muted-foreground">Select a step to edit title, reads/writes, and node config.</p>
          ) : (
            <div className="space-y-3">
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Node</div>
                <div className="font-mono text-xs text-zinc-700">{selected.id}</div>
              </div>
              <FormLabel label="Type">
                <Select value={selected.type} onChange={(event) => updateSelectedType(event.target.value as WorkflowNodeType)}>
                  {workflowNodeTypes.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </Select>
              </FormLabel>
              <FormLabel label="Title">
                <TextInput value={selected.data.title} onChange={(event) => updateSelectedData({ title: event.target.value })} />
              </FormLabel>
              <FormLabel label="Reads (comma)">
                <TextInput
                  value={(selected.data.reads ?? []).join(", ")}
                  onChange={(event) =>
                    updateSelectedData({
                      reads: event.target.value
                        .split(",")
                        .map((part) => part.trim())
                        .filter(Boolean)
                    })
                  }
                />
              </FormLabel>
              <FormLabel label="Writes (comma)">
                <TextInput
                  value={(selected.data.writes ?? []).join(", ")}
                  onChange={(event) =>
                    updateSelectedData({
                      writes: event.target.value
                        .split(",")
                        .map((part) => part.trim())
                        .filter(Boolean)
                    })
                  }
                />
              </FormLabel>
              {selected.type === "llm" ? (
                <FormLabel label="LLM instructions">
                  <TextArea
                    className="min-h-28"
                    value={selected.data.llm?.instructions ?? ""}
                    onChange={(event) =>
                      updateSelectedData({
                        llm: {
                          ...(selected.data.llm ?? {}),
                          instructions: event.target.value,
                          inputKeys: selected.data.reads ?? selected.data.llm?.inputKeys,
                          outputSchema: selected.data.writes ?? selected.data.llm?.outputSchema
                        }
                      })
                    }
                  />
                </FormLabel>
              ) : null}
              {selected.type === "tool" ? (
                <FormLabel label="Tool name">
                  <TextInput
                    value={selected.data.tool?.name ?? ""}
                    onChange={(event) =>
                      updateSelectedData({
                        tool: {
                          ...(selected.data.tool ?? { name: "" }),
                          name: event.target.value
                        }
                      })
                    }
                  />
                </FormLabel>
              ) : null}
              {selected.type !== "start" ? (
                <GhostButton size="xs" tone="danger" onClick={deleteSelected}>
                  Delete node
                </GhostButton>
              ) : null}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
