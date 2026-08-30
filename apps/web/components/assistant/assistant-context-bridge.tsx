"use client";

import { useEffect } from "react";
import type { AssistantContext } from "@projectplaner/core/assistant";
import { useAssistantContextPublisher } from "../project-shell/right-pane-context";

export function AssistantContextBridge({
  context
}: {
  context: Partial<AssistantContext>;
}) {
  const publish = useAssistantContextPublisher();
  useEffect(() => {
    publish?.({
      projectKey: context.projectKey,
      entityId: context.entityId ?? "",
      flowId: context.flowId ?? "",
      nodeId: context.nodeId ?? ""
    });
  }, [context.projectKey, context.entityId, context.flowId, context.nodeId, publish]);
  return null;
}
