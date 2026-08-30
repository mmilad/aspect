"use client";

import assistant from "@projectplaner/core/assistant";
import type { AssistantSession } from "@projectplaner/core/assistant";
import Link from "next/link";
import { Button } from "../ui/button";
import { projectPaths } from "../../lib/project-paths";
import { useRightPane } from "../project-shell/right-pane-context";
import { SchemaView } from "./schema-view";

const { views } = assistant;

export function AssistantSchemaView({ session }: { session: AssistantSession }) {
  const { projectKey, nav, setNav } = useRightPane();
  const frame = nav[nav.length - 1] ?? { key: "transcript", label: "Chat" };
  const property = views.propertyByKey(frame.key);
  if (!property || property.view.kind === "transcript") {
    return null;
  }

  return (
    <SchemaView
      value={session}
      view={property.view}
      itemViews={views.itemViews}
      itemId={frame.itemId}
      onOpenItem={(id, label) => {
        setNav([...nav, { key: property.key, label, itemId: id }]);
      }}
      renderRef={(id, label) => (
        <Button asChild variant="link" size="sm" className="h-auto px-0">
          <Link href={projectPaths.entity(projectKey, id)}>
            {label ?? "Open"} · {id}
          </Link>
        </Button>
      )}
    />
  );
}
