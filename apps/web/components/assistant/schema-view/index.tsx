"use client";

import assistant from "@projectplaner/core/assistant";
import type { AssistantBlock, AssistantView } from "@projectplaner/core/assistant";
import type { ReactNode } from "react";
import { Badge } from "../../ui/badge";
import { Button } from "../../ui/button";
import { Card, CardContent } from "../../ui/card";
import { Field, FieldLabel, FieldContent } from "../../ui/field";
import { Item, ItemContent, ItemDescription, ItemGroup, ItemTitle } from "../../ui/item";

const { path } = assistant;

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asDisplayString(value: unknown): string | undefined {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed ? trimmed : undefined;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  return undefined;
}

function BlockView({
  block,
  root,
  renderRef
}: {
  block: AssistantBlock;
  root: unknown;
  renderRef: (id: string, label?: string) => ReactNode;
}) {
  if (block.kind === "prose") {
    const value = asDisplayString(path.get(root, block.path));
    if (!value) {
      return null;
    }
    return (
      <Card>
        <CardContent className="space-y-1 p-3">
          {block.label ? <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{block.label}</div> : null}
          <p className="whitespace-pre-wrap text-sm leading-snug">{value}</p>
        </CardContent>
      </Card>
    );
  }
  if (block.kind === "chips") {
    const value = path.get(root, block.path);
    if (!Array.isArray(value) || value.length === 0) {
      return null;
    }
    return (
      <Field>
        {block.label ? <FieldLabel>{block.label}</FieldLabel> : null}
        <FieldContent>
          <div className="flex flex-wrap gap-1">
            {value.filter((item): item is string => typeof item === "string").map((item) => (
              <Badge key={item} variant="secondary">
                {item}
              </Badge>
            ))}
          </div>
        </FieldContent>
      </Field>
    );
  }
  if (block.kind === "fields") {
    const rows = block.fields
      .map((field) => {
        const value = asDisplayString(path.get(root, field.path));
        if (!value) {
          return null;
        }
        return { label: field.label, value };
      })
      .filter((row): row is { label: string; value: string } => row !== null);
    if (rows.length === 0) {
      return null;
    }
    return (
      <div className="space-y-2">
        {rows.map((row) => (
          <Field key={row.label}>
            <FieldLabel>{row.label}</FieldLabel>
            <FieldContent className="text-sm font-medium">{row.value}</FieldContent>
          </Field>
        ))}
      </div>
    );
  }
  const id = path.get(root, block.path);
  if (typeof id !== "string" || !id.trim()) {
    return null;
  }
  return <>{renderRef(id, block.label)}</>;
}

export function SchemaView({
  value,
  view,
  itemViews,
  itemId,
  onOpenItem,
  renderRef
}: {
  value: unknown;
  view: AssistantView;
  itemViews: Record<string, AssistantBlock[]>;
  itemId?: string;
  onOpenItem: (id: string, label: string) => void;
  renderRef: (id: string, label?: string) => ReactNode;
}) {
  if (view.kind === "transcript") {
    return null;
  }

  if (view.kind === "list") {
    const items = path.get(value, view.path);
    const list = Array.isArray(items) ? items : [];
    if (itemId) {
      const item = list.find((entry) => asRecord(entry)?.id === itemId);
      const blocks = itemViews[view.itemView] ?? [];
      return (
        <div className="space-y-3 p-3">
          {blocks.map((block, index) => (
            <BlockView key={`${block.kind}:${index}`} block={block} root={item ?? {}} renderRef={renderRef} />
          ))}
        </div>
      );
    }
    return (
      <ItemGroup className="p-2">
        {list.map((entry, index) => {
          const row = asRecord(entry);
          const id = typeof row?.id === "string" ? row.id : String(index);
          const title = String(path.get(entry, view.title) ?? id);
          const sub =
            asDisplayString(view.sub ? path.get(entry, view.sub) : undefined) ??
            (view.sub === "answer" && path.get(entry, "status") === "open" ? "open" : undefined);
          return (
            <Button
              key={id}
              type="button"
              variant="ghost"
              className="h-auto w-full justify-start p-0"
              onClick={() => onOpenItem(id, title)}
            >
              <Item className="w-full">
                <ItemContent>
                  <ItemTitle>{title}</ItemTitle>
                  {sub ? <ItemDescription>{sub}</ItemDescription> : null}
                </ItemContent>
              </Item>
            </Button>
          );
        })}
      </ItemGroup>
    );
  }

  return (
    <div className="space-y-3 p-3">
      {view.blocks.map((block, index) => (
        <BlockView key={`${block.kind}:${index}`} block={block} root={value} renderRef={renderRef} />
      ))}
    </div>
  );
}
