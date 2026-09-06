"use client";

import assistant from "@projectplaner/core/assistant";
import { Button } from "../ui";
import { useRightPane, type AssistantNavFrame } from "../project-shell/right-pane-context";

const { views } = assistant;

/** Assistant-mode session views (Summary, Topics, …). */
export function AssistantRail() {
  const { record, nav, mode, setNav, setMode } = useRightPane();
  const active = nav[nav.length - 1];
  const items = record
    ? views.visibleNav(record.session).filter((property) => property.key !== "transcript")
    : [];

  if (mode !== "assistant" || !record) {
    return null;
  }

  return (
    <div className="flex flex-col gap-1 p-2">
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
