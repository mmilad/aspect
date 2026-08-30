"use client";

import { useMemo, useState } from "react";
import type { ProjectPlanSnapshot } from "@projectplaner/core";
import type { LlmJsonSchemaRecord } from "@projectplaner/db";
import { Badge, FormLabel, GhostButton, Textarea, Input } from "../ui";

interface BuilderShellProps {
  snapshot: ProjectPlanSnapshot;
  schemas: LlmJsonSchemaRecord[];
}

function propertyCount(schema: Record<string, unknown>): number {
  const properties = schema.properties;
  if (!properties || typeof properties !== "object" || Array.isArray(properties)) {
    return 0;
  }
  return Object.keys(properties).length;
}

export function BuilderShell({ snapshot, schemas }: BuilderShellProps) {
  const [items, setItems] = useState(schemas);
  const [selectedKey, setSelectedKey] = useState(schemas[0]?.key ?? "");
  const [composerOpen, setComposerOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [key, setKey] = useState("");
  const [description, setDescription] = useState("");
  const [schemaText, setSchemaText] = useState(
    JSON.stringify(
      {
        type: "object",
        properties: {},
        required: [],
        additionalProperties: false
      },
      null,
      2
    )
  );
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const selected = useMemo(
    () => items.find((schema) => schema.key === selectedKey) ?? items[0] ?? null,
    [items, selectedKey]
  );

  function updateTitle(nextTitle: string) {
    setTitle(nextTitle);
    if (!key.trim()) {
      setKey(
        nextTitle
          .trim()
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "_")
          .replace(/^_+|_+$/g, "")
      );
    }
  }

  async function saveSchema() {
    setSaving(true);
    setMessage(null);
    try {
      const parsed = JSON.parse(schemaText) as unknown;
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        throw new Error("JSON must be an object.");
      }
      const response = await fetch("/api/llm-json-schemas", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          projectKey: snapshot.project.key,
          key,
          title,
          description,
          schema: parsed
        })
      });
      const payload = (await response.json()) as { schema?: LlmJsonSchemaRecord; error?: string };
      if (!response.ok || !payload.schema) {
        throw new Error(payload.error ?? "Could not save shape.");
      }
      setItems((current) => [...current, payload.schema as LlmJsonSchemaRecord].sort((a, b) => a.key.localeCompare(b.key)));
      setSelectedKey(payload.schema.key);
      setComposerOpen(false);
      setTitle("");
      setKey("");
      setDescription("");
      setMessage("Saved.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save shape.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-white">
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2">
        <Badge>schemas</Badge>
        <div className="text-sm font-medium text-zinc-900">Builder</div>
        <Badge>{items.length}</Badge>
        <span className="text-[11px] text-muted-foreground">{snapshot.project.title}</span>
        <div className="ml-auto flex items-center gap-2">
          {message ? <span className="text-[11px] text-muted-foreground">{message}</span> : null}
          <GhostButton
            size="xs"
            active={composerOpen}
            onClick={() => {
              setComposerOpen((open) => !open);
              setMessage(null);
            }}
          >
            + New
          </GhostButton>
        </div>
      </div>

      {composerOpen ? (
        <div className="grid gap-3 border-b border-border bg-zinc-50/50 px-3 py-3">
          <div className="grid grid-cols-[minmax(180px,240px)_minmax(180px,240px)_minmax(0,1fr)] gap-2">
            <FormLabel label="Title">
              <Input value={title} onChange={(event) => updateTitle(event.target.value)} />
            </FormLabel>
            <FormLabel label="Key">
              <Input
                value={key}
                onChange={(event) => setKey(event.target.value)}
                placeholder="my_response_v1"
              />
            </FormLabel>
            <FormLabel label="Description">
              <Input value={description} onChange={(event) => setDescription(event.target.value)} />
            </FormLabel>
          </div>
          <FormLabel label="JSON">
            <Textarea
              className="min-h-48 font-mono text-xs"
              value={schemaText}
              onChange={(event) => setSchemaText(event.target.value)}
              spellCheck={false}
            />
          </FormLabel>
          <div className="flex gap-2">
            <GhostButton size="xs" tone="primary" disabled={saving} onClick={() => void saveSchema()}>
              {saving ? "Saving..." : "Save"}
            </GhostButton>
            <GhostButton size="xs" disabled={saving} onClick={() => setComposerOpen(false)}>
              Cancel
            </GhostButton>
          </div>
        </div>
      ) : null}

      <div className="grid min-h-0 flex-1 grid-cols-[minmax(220px,280px)_minmax(0,1fr)] overflow-hidden">
        <aside className="border-r border-border bg-zinc-50/40 p-3">
          <div className="text-[10px] font-semibold uppercase text-muted-foreground">Library</div>
          {items.length === 0 ? (
            <div className="mt-3 rounded-md border border-dashed border-border bg-white p-3 text-xs text-muted-foreground">
              No saved shapes.
            </div>
          ) : (
            <ul className="mt-3 grid gap-2">
              {items.map((schema) => (
                <li key={schema.id}>
                  <button
                    type="button"
                    className={`w-full rounded-md border bg-white p-2 text-left ${
                      selected?.key === schema.key ? "border-teal-700" : "border-border"
                    }`}
                    onClick={() => setSelectedKey(schema.key)}
                  >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-zinc-950">{schema.title}</div>
                      <div className="truncate font-mono text-[10px] text-muted-foreground">{schema.key}</div>
                    </div>
                    <Badge>v{schema.version}</Badge>
                  </div>
                  {schema.description ? (
                    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{schema.description}</p>
                  ) : null}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </aside>

        <section className="min-w-0 overflow-auto p-3">
          <div className="grid max-w-3xl gap-3">
            <div className="text-[10px] font-semibold uppercase text-muted-foreground">Draft area</div>
            {selected ? (
              <div className="rounded-md border border-border bg-white p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-base font-semibold text-zinc-950">{selected.title}</h1>
                  <Badge>v{selected.version}</Badge>
                  <Badge>{propertyCount(selected.schema)} fields</Badge>
                </div>
                <pre className="mt-3 max-h-[520px] overflow-auto rounded-md border border-border bg-zinc-950 p-3 text-xs leading-relaxed text-zinc-50">
                  {JSON.stringify(selected.schema, null, 2)}
                </pre>
              </div>
            ) : (
              <div className="rounded-md border border-dashed border-border bg-zinc-50/50 p-4 text-sm text-muted-foreground">
                No draft selected.
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
