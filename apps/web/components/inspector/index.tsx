"use client";

import type { ReactNode } from "react";
import { PanelRight } from "lucide-react";

export interface InspectorHostProps {
  /** Short label under the shell “Inspector” chrome, e.g. Step. Omit to skip the bar. */
  eyebrow?: string;
  children: ReactNode;
}

/** Thin wrapper for shell right-pane content. Grows into tabs later. */
export function InspectorHost({ eyebrow, children }: InspectorHostProps) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      {eyebrow ? (
        <div className="flex items-center gap-2 border-b border-border px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          <PanelRight className="h-3.5 w-3.5" />
          {eyebrow}
        </div>
      ) : null}
      <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
    </div>
  );
}

export { EntityInspector, type EntityInspectorProps, type PreviewEntity } from "./entity-inspector";
export {
  WorkflowStepInspector,
  type WorkflowStepInspectorProps
} from "./workflow-step-inspector";
