"use client";

import type { AssistantMessage, AssistantSession } from "@projectplaner/core/assistant";
import { Avatar, AvatarFallback } from "../ui/avatar";
import { Bubble, BubbleContent } from "../ui/bubble";
import { Message, MessageAvatar, MessageContent, MessageGroup } from "../ui/message";
import {
  MessageScroller,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport
} from "../ui/message-scroller";

import { AgentRunMessage } from "./agent-run-message";
import type { AgentMessage } from "./turn-client";

function groupMessages(messages: AssistantMessage[]): AssistantMessage[][] {
  const groups: AssistantMessage[][] = [];
  for (const message of messages) {
    const last = groups[groups.length - 1];
    if (last && last[0]?.role === message.role) {
      last.push(message);
    } else {
      groups.push([message]);
    }
  }
  return groups;
}

export function AssistantTranscript({ session, agentRuns = [] }: { session?: AssistantSession; agentRuns?: AgentMessage[] }) {
  if (!session?.messages.length && !agentRuns.length) {
    return (
      <div className="px-4 py-8 text-sm text-muted-foreground">
        Conversation lives here. Session views (summary, topics, context) show as buttons in the right sidebar.
      </div>
    );
  }

  const groups = groupMessages(session?.messages ?? []);

  return (
    <MessageScrollerProvider className="h-full">
      <MessageScroller>
        <MessageScrollerViewport>
          <MessageScrollerContent>
            {groups.map((group) => {
              const role = group[0]?.role ?? "assistant";
              const align = role === "user" ? "end" : "start";
              const initials = role === "user" ? "You" : "AI";
              return (
                <MessageGroup key={group[0]?.id}>
                  {group.map((message, index) => {
                    const last = index === group.length - 1;
                    return (
                      <MessageScrollerItem key={message.id} messageId={message.id} scrollAnchor={role === "user"}>
                        <Message align={align}>
                          <MessageAvatar>{last ? <Avatar className="h-7 w-7"><AvatarFallback>{initials}</AvatarFallback></Avatar> : null}</MessageAvatar>
                          <MessageContent>
                            <Bubble variant={role === "user" ? "default" : "muted"} align={align}>
                              <BubbleContent className="whitespace-pre-wrap">{message.content}</BubbleContent>
                            </Bubble>
                          </MessageContent>
                        </Message>
                      </MessageScrollerItem>
                    );
                  })}
                </MessageGroup>
              );
            })}
            {agentRuns.map(run => <AgentRunMessage key={run.runId} run={run} />)}
          </MessageScrollerContent>
        </MessageScrollerViewport>
      </MessageScroller>
    </MessageScrollerProvider>
  );
}
