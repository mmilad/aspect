"use client";

import type { AssistantSession } from "@projectplaner/core/assistant";
import { Badge, ScrollArea } from "../ui";

export function AssistantTranscript({ session }: { session: AssistantSession }) {
  if (session.messages.length === 0) {
    return (
      <div className="px-4 py-8 text-sm text-muted-foreground">
        Conversation lives here. Session views (summary, topics, context) show as buttons in the right sidebar.
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="mx-auto flex max-w-3xl flex-col gap-4 p-4">
        {session.messages.map((message) => (
          <div key={message.id} className="space-y-1">
            <Badge tone={message.role === "user" ? "task" : "aspect"}>{message.role}</Badge>
            <p className="whitespace-pre-wrap text-sm leading-snug">{message.content}</p>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}
