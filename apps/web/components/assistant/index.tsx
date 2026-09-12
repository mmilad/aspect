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
  const { record, loading, error, nav, agentRuns, selectedAgentId, agentHistoryError, agentHistoryLoading, refreshAgentHistory } = useRightPane();
  const frame = nav[nav.length - 1];
  const isChat = Boolean(selectedAgentId) || !frame || frame.key === "transcript";

  let body;
  if (selectedAgentId ? agentHistoryLoading : loading) {
    body = <div className="px-4 py-6 text-sm text-muted-foreground">Loading session…</div>;

  } else if (isChat) {
    body = <AssistantTranscript sessionId={record?.id} session={selectedAgentId ? undefined : record?.session} agentRuns={agentRuns} />;
  } else if (!record) {
    body = <div className="px-4 py-6 text-sm text-muted-foreground">No session.</div>;
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
      <PaneFrame header={<AssistantBreadcrumb />} footer={<AssistantComposer key={selectedAgentId ?? record?.id ?? "assistant"} />}>
        <div className="flex h-full min-h-0 flex-col">
        {error ? <div role="alert" className="px-4 py-2 text-sm text-rose-700">{error}</div> : null}
        {agentHistoryError ? <div role="alert" className="px-4 py-2 text-sm text-rose-700">{agentHistoryError} <button type="button" onClick={refreshAgentHistory}>Retry</button></div> : null}
        <div className="min-h-0 flex-1">{body}</div>
        </div>
      </PaneFrame>
    </div>
  );
}

