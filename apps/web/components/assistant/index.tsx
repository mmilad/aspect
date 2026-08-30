"use client";

import { PaneFrame } from "../project-shell/pane-frame";
import { ScrollArea } from "../ui";
import { useRightPane } from "../project-shell/right-pane-context";
import { AssistantBreadcrumb } from "./assistant-breadcrumb";
import { AssistantComposer } from "./assistant-composer";
import { AssistantSchemaView } from "./assistant-schema-view";
import { AssistantTranscript } from "./assistant-transcript";

export { AssistantRail } from "./assistant-rail";
export { AssistantContextBridge } from "./assistant-context-bridge";

/** Main-area chat (or selected session view). Property buttons live in the right sidebar. */
export function AssistantHost() {
  const { record, loading, error, nav } = useRightPane();
  const frame = nav[nav.length - 1];
  const isChat = !frame || frame.key === "transcript";

  let body;
  if (loading) {
    body = <div className="px-4 py-6 text-sm text-muted-foreground">Loading session…</div>;
  } else if (error) {
    body = <div className="px-4 py-6 text-sm text-rose-700">{error}</div>;
  } else if (!record) {
    body = <div className="px-4 py-6 text-sm text-muted-foreground">No session.</div>;
  } else if (isChat) {
    body = <AssistantTranscript session={record.session} />;
  } else {
    body = (
      <ScrollArea className="h-full">
        <div className="mx-auto max-w-3xl">
          <AssistantSchemaView session={record.session} />
        </div>
      </ScrollArea>
    );
  }

  return (
    <div className="h-full min-h-0 bg-background">
      <PaneFrame header={<AssistantBreadcrumb />} footer={<AssistantComposer />}>
        {body}
      </PaneFrame>
    </div>
  );
}
