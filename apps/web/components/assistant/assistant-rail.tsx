"use client";

import assistant from "@projectplaner/core/assistant";
import { MessageSquare } from "lucide-react";
import { Button, Separator } from "../ui";
import { useRightPane, type AssistantNavFrame } from "../project-shell/right-pane-context";

const { views } = assistant;

/** Always-visible Chat plus inferred session views (Summary, Topics, …). */
export function AssistantRail() {
  const { record, nav, mode, openChat, setNav, setMode } = useRightPane();
  const active = nav[nav.length - 1];
  const chatSelected = mode === "assistant" && (!active || active.key === "transcript");
  const items = record
    ? views.visibleNav(record.session).filter((property) => property.key !== "transcript")
    : [];

  return (
    <div className="flex flex-col gap-1 p-2">
      <Button
        type="button"
        size="sm"
        variant={chatSelected ? "default" : "outline"}
        className="h-auto w-full justify-start px-2 py-2 text-left"
        onClick={openChat}
      >
        <MessageSquare className="h-3.5 w-3.5" />
        Chat
      </Button>
      {items.length > 0 ? <Separator className="my-1" /> : null}
      {items.map((property) => {
        const selected = mode === "assistant" && active?.key === property.key;
        return (
          <Button
            key={property.key}
            type="button"
            size="sm"
            variant={selected ? "default" : "outline"}
            className="h-auto w-full justify-start px-2 py-2 text-left"
            onClick={() => {
              setMode("assistant");
              const frame: AssistantNavFrame = { key: property.key, label: property.nav };
              setNav([{ key: "transcript", label: "Chat" }, frame]);
            }}
          >
            {property.nav}
          </Button>
        );
      })}
    </div>
  );
}
