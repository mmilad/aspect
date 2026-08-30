"use client";

import { useState } from "react";
import { Button, Textarea } from "../ui";
import { useRightPane } from "../project-shell/right-pane-context";

export function AssistantComposer() {
  const { sendMessage, sending } = useRightPane();
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
