"use client";

import { Background, Controls, MiniMap, ReactFlow, type Edge, type Node, type OnNodesChange } from "@xyflow/react";
import { Network } from "lucide-react";
import { graphNodeTypes } from "./node-card";
import type { GraphFlowNodeData } from "./types";

interface GraphCanvasProps {
  nodes: Node<GraphFlowNodeData>[];
  edges: Edge[];
  onSelect: (id: string) => void;
  onOpen: (id: string) => void;
  onNodesChange: OnNodesChange<Node<GraphFlowNodeData>>;
}

export function GraphCanvas({ nodes, edges, onSelect, onOpen, onNodesChange }: GraphCanvasProps) {
  return (
    <div className="h-full min-h-[calc(100vh-3.5rem)] bg-[#f8faf9]">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={graphNodeTypes}
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
