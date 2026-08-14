"use client";

import { useEffect, useMemo, useState } from "react";
import { SearchSelect, type SearchSelectOption } from "../../ui/search-select";

type SchemaListItem = {
  key: string;
  title: string;
  description: string;
  version: number;
};

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
    fetch(`/api/llm-json-schemas?projectKey=${encodeURIComponent(projectKey)}`)
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
    </div>
  );
}
