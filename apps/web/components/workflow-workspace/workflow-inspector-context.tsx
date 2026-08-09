"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode
} from "react";
import type { BagShape, WorkflowNode, WorkflowNodeData, WorkflowNodeType } from "@projectplaner/core";

export type WorkflowInspectorSession = {
  diagramOpen: boolean;
  selected: WorkflowNode | null;
  bagView: Record<string, BagShape>;
  onUpdateData: (patch: Partial<WorkflowNodeData>) => void;
  onUpdateType: (type: WorkflowNodeType) => void;
  onDelete: () => void;
  authorOpen: boolean;
  brief: string;
  generating: boolean;
  onBriefChange: (value: string) => void;
  onGenerate: (scaffoldOnly?: boolean) => void;
  setAuthorOpen: (open: boolean) => void;
};

type WorkflowInspectorContextValue = {
  session: WorkflowInspectorSession | null;
  publish: (session: WorkflowInspectorSession) => void;
  clear: () => void;
};

const WorkflowInspectorContext = createContext<WorkflowInspectorContextValue | null>(null);

export function WorkflowInspectorProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<WorkflowInspectorSession | null>(null);
  const publish = useCallback((next: WorkflowInspectorSession) => {
    setSession(next);
  }, []);
  const clear = useCallback(() => setSession(null), []);
  const value = useMemo(() => ({ session, publish, clear }), [session, publish, clear]);
  return <WorkflowInspectorContext.Provider value={value}>{children}</WorkflowInspectorContext.Provider>;
}

export function useWorkflowInspectorPublisher() {
  const ctx = useContext(WorkflowInspectorContext);
  if (!ctx) {
    throw new Error("useWorkflowInspectorPublisher requires WorkflowInspectorProvider");
  }
  return ctx;
}

export function useWorkflowInspectorSession(): WorkflowInspectorSession | null {
  return useContext(WorkflowInspectorContext)?.session ?? null;
}
