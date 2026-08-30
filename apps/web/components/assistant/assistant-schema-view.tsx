"use client";

import assistant from "@projectplaner/core/assistant";
import type { AssistantBlock } from "@projectplaner/core/assistant";
import type { AssistantSession } from "@projectplaner/core/assistant";
import Link from "next/link";
import { Badge, Button } from "../ui";
import { projectPaths } from "../../lib/project-paths";
import { useRightPane } from "../project-shell/right-pane-context";

const { path, views } = assistant;

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function BlockView({
  block,
  root,
  projectKey
}: {
  block: AssistantBlock;
  root: unknown;
  projectKey: string;
}) {
  if (block.kind === "prose") {
    const value = path.get(root, block.path);
    if (typeof value !== "string" || !value.trim()) {
      return null;
    }
    return (
      <div className="space-y-1">
        {block.label ? (
          <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{block.label}</div>
        ) : null}
        <p className="whitespace-pre-wrap text-sm leading-snug">{value}</p>
      </div>
    );
  }
  if (block.kind === "chips") {
    const value = path.get(root, block.path);
    if (!Array.isArray(value) || value.length === 0) {
      return null;
    }
    return (
      <div className="space-y-1">
        {block.label ? (
          <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{block.label}</div>
        ) : null}
        <div className="flex flex-wrap gap-1">
          {value.filter((item): item is string => typeof item === "string").map((item) => (
            <Badge key={item}>{item}</Badge>
          ))}
        </div>
      </div>
    );
  }
  if (block.kind === "fields") {
    const rows = block.fields
      .map((field) => {
        const value = path.get(root, field.path);
        if (typeof value !== "string" || !value.trim()) {
          return null;
        }
        return { label: field.label, value };
      })
      .filter((row): row is { label: string; value: string } => row !== null);
    if (rows.length === 0) {
      return null;
    }
    return (
      <dl className="space-y-1 text-xs">
        {rows.map((row) => (
          <div key={row.label} className="flex justify-between gap-2">
            <dt className="text-muted-foreground">{row.label}</dt>
            <dd className="font-medium">{row.value}</dd>
          </div>
        ))}
      </dl>
    );
  }
  const id = path.get(root, block.path);
  if (typeof id !== "string" || !id.trim()) {
    return null;
  }
  return (
    <div>
      <Link className="text-xs font-medium text-teal-800 hover:underline" href={projectPaths.entity(projectKey, id)}>
        {block.label ?? "Open"} · {id}
      </Link>
    </div>
  );
}

export function AssistantSchemaView({ session }: { session: AssistantSession }) {
  const { projectKey, nav, setNav } = useRightPane();
  const frame = nav[nav.length - 1] ?? { key: "transcript", label: "Chat" };
  const property = views.propertyByKey(frame.key);
  if (!property || property.view.kind === "transcript") {
    return null;
  }

  if (property.view.kind === "list") {
    const listView = property.view;
    const items = path.get(session, listView.path);
    const list = Array.isArray(items) ? items : [];
    if (frame.itemId) {
      const item = list.find((entry) => asRecord(entry)?.id === frame.itemId);
      const blocks = views.itemViews[listView.itemView] ?? [];
      return (
        <div className="space-y-3 p-3">
          {blocks.map((block, index) => (
            <BlockView key={`${block.kind}:${index}`} block={block} root={item ?? {}} projectKey={projectKey} />
          ))}
        </div>
      );
    }
    return (
      <div className="flex flex-col gap-1 p-2">
        {list.map((entry, index) => {
          const row = asRecord(entry);
          const id = typeof row?.id === "string" ? row.id : String(index);
          const titlePath = listView.title;
          const subPath = listView.sub;
          const title = String(path.get(entry, titlePath) ?? id);
          const sub = subPath ? path.get(entry, subPath) : undefined;
          return (
            <Button
              key={id}
              type="button"
              variant="outline"
              className="h-auto w-full justify-start px-2 py-2 text-left"
              onClick={() => {
                setNav([...nav, { key: property.key, label: title, itemId: id }]);
              }}
            >
              <span className="flex flex-col">
                <span>{title}</span>
                {typeof sub === "string" && sub.trim() ? (
                  <span className="text-[10px] font-normal text-muted-foreground">{sub}</span>
                ) : null}
              </span>
            </Button>
          );
        })}
      </div>
    );
  }

  return (
    <div className="space-y-3 p-3">
      {property.view.blocks.map((block, index) => (
        <BlockView key={`${block.kind}:${index}`} block={block} root={session} projectKey={projectKey} />
      ))}
    </div>
  );
}
