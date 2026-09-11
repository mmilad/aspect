"use client";

import { useState } from "react";
import { Button, Textarea } from "../ui";
import { useRightPane } from "../project-shell/right-pane-context";
import { DIRECT_AGENT_CAPABILITIES } from "@projectplaner/core";
import { AgentDebugSelector } from "./agent-debug-selector";

export function AssistantComposer() {
  const { sendMessage, sending, selectedAgentId, refreshAgentHistory } = useRightPane();
  const [draft, setDraft] = useState("");

  async function onSubmit() {
    const message = draft.trim();
    if (!message || sending) {
      return;
    }
    setDraft("");
    await sendMessage(message);
  }

  return (
    <form
      className="flex flex-shrink-0 flex-col gap-2 border-t border-border px-4 py-3"
      onSubmit={(event) => {
        event.preventDefault();
        void onSubmit();
      }}
    >
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-2">
        <AgentDebugSelector />
        {selectedAgentId ? <div className="flex items-start gap-2 text-xs text-muted-foreground">
          <span>{DIRECT_AGENT_CAPABILITIES}</span>
          <button type="button" className="underline" onClick={refreshAgentHistory}>Refresh</button>
        </div> : null}
        {sending && selectedAgentId ? (
          <p role="status" className="text-xs text-muted-foreground">
            Executing agent. The result and persisted events appear after execution finishes.
          </p>
        ) : null}
        <Textarea
          value={draft}
          rows={3}
          placeholder="Message"
          className="min-h-[88px]"
          disabled={sending}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              void onSubmit();
            }
          }}
        />
        <div className="flex justify-end">
          <Button type="submit" size="sm" disabled={sending || !draft.trim()}>
            {sending ? "Sending" : "Send"}
          </Button>
        </div>
      </div>
    </form>
  );
}
