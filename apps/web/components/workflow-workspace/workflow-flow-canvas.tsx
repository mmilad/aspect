"use client";

import { useMemo, type ReactNode } from "react";
import {
  Background,
  ConnectionMode,
  Controls,
  MiniMap,
  ReactFlow,
  type Connection,
  type OnEdgesChange,
  type OnNodesChange,
  type ReactFlowInstance
} from "@xyflow/react";
import type { WorkflowVariable } from "@projectplaner/core";
import { isValidWorkflowConnection, type FlowRfEdge, type FlowRfNode } from "./rf-adapters";
import { workflowRfNodeTypes, WorkflowPinsContext } from "./workflow-step-node";
import { workflowRfEdgeTypes, useWaypointSelection } from "./workflow-exec-edge";

export function WorkflowFlowCanvas({
  nodes,
  edges,
  variables,
  onInit,
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
  onInit?: (instance: ReactFlowInstance<FlowRfNode, FlowRfEdge>) => void;
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
        onInit={onInit}
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
