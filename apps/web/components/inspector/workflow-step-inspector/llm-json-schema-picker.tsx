"use client";

import { useEffect, useMemo, useState } from "react";
import { getLlmJsonSchemaPreset } from "@projectplaner/core";
import { SearchSelect, type SearchSelectOption } from "../../ui/search-select";

type SchemaListItem = {
  key: string;
  title: string;
  description: string;
  version: number;
  schema?: Record<string, unknown>;
};

function isSchemaObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value) && Object.keys(value).length > 0;
}

function previewBody(item: SchemaListItem | undefined, key: string): Record<string, unknown> | null {
  if (isSchemaObject(item?.schema)) {
    return item.schema;
  }
  const preset = getLlmJsonSchemaPreset(key);
  return preset?.schema ?? null;
}

export function LlmJsonSchemaPicker({
  projectKey,
  value,
  onChange
}: {
  projectKey: string;
  value: string;
  onChange: (key: string) => void;
}) {
  const [schemas, setSchemas] = useState<SchemaListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/llm-json-schemas?projectKey=${encodeURIComponent(projectKey)}`, { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`Could not load JSON schemas (${response.status}).`);
        }
        const payload = (await response.json()) as { schemas?: SchemaListItem[] };
        if (!cancelled) {
          setSchemas(payload.schemas ?? []);
          setError(null);
        }
      })
      .catch((caught: unknown) => {
        if (!cancelled) {
          setError(caught instanceof Error ? caught.message : "Could not load JSON schemas.");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [projectKey]);

  const options = useMemo((): SearchSelectOption[] => {
    const mapped = schemas.map((schema) => ({
      value: schema.key,
      label: schema.title || schema.key,
      hint: schema.description
    }));
    if (value && !mapped.some((option) => option.value === value)) {
      return [{ value, label: value, hint: "not in library" }, ...mapped];
    }
    return mapped;
  }, [schemas, value]);

  const selected = schemas.find((schema) => schema.key === value);
  const body = value ? previewBody(selected, value) : null;
  const previewJson = body ? JSON.stringify(body, null, 2) : null;

  return (
    <div className="space-y-1">
      <SearchSelect
        label="JSON schema"
        value={value}
        options={options}
        onChange={onChange}
        placeholder="Search schemas…"
        emptyText="No schemas match"
        loading={loading}
      />
      {error ? <div className="text-[11px] text-red-700">{error}</div> : null}
      {value ? (
        <details className="rounded-md border border-border bg-white px-2 py-1">
          <summary className="cursor-pointer text-[10px] font-semibold uppercase tracking-wide text-zinc-600">
            Schema preview
            {selected?.version ? (
              <span className="ml-1 font-mono font-normal normal-case tracking-normal text-zinc-500">
                v{selected.version}
              </span>
            ) : null}
          </summary>
          {previewJson ? (
            <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap font-mono text-[10px] leading-relaxed text-zinc-800">
              {previewJson}
            </pre>
          ) : (
            <div className="mt-2 text-[11px] text-muted-foreground">Not in library — no preview.</div>
          )}
        </details>
      ) : null}
    </div>
  );
}
