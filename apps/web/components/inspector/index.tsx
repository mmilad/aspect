"use client";

import type { ReactNode } from "react";
import { PanelRight } from "lucide-react";
import { PaneFrame } from "../project-shell/pane-frame";

export interface InspectorHostProps {
  /** Short label under the shell chrome, e.g. Step. Omit to skip the bar. */
  eyebrow?: string;
  children: ReactNode;
}

/** Inspect-mode right pane: optional eyebrow + scrolling body. */
export function InspectorHost({ eyebrow, children }: InspectorHostProps) {
  return (
    <PaneFrame
      header={
        eyebrow ? (
          <div className="flex items-center gap-2 border-b border-border px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            <PanelRight className="h-3.5 w-3.5" />
            {eyebrow}
          </div>
        ) : undefined
      }
    >
      <div className="h-full overflow-y-auto">{children}</div>
    </PaneFrame>
  );
}

export { EntityInspector, type EntityInspectorProps, type PreviewEntity } from "./entity-inspector";
export {
  WorkflowStepInspector,
  type WorkflowStepInspectorProps
} from "./workflow-step-inspector";
export {
  WorkflowAuthorInspector,
  type WorkflowAuthorInspectorProps
} from "./workflow-author-inspector";
