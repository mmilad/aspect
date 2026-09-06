"use client";

import type {
  QueryConstField,
  WorkflowQueryConfig,
  WorkflowQueryOp
} from "@projectplaner/core";
import workflow from "@projectplaner/core/workflow";
import { FormLabel, Input, NativeSelect } from "../../../ui";

const { defaultSlotsForOp, QUERY_CATALOG, queryEntityTypes, queryOps } = workflow.nodes;

export function QueryOperationSelect({
  query,
  onCommit
}: {
  query: WorkflowQueryConfig;
  onCommit: (next: WorkflowQueryConfig) => void;
}) {
  return (
    <FormLabel label="Operation">
      <NativeSelect
        value={query.op}
        onChange={(event) => {
          const op = event.target.value as WorkflowQueryOp;
          onCommit({ ...query, op, slots: defaultSlotsForOp(op) });
        }}
      >
        {queryOps.map((op) => (
          <option key={op} value={op}>
            {QUERY_CATALOG[op].label}
          </option>
        ))}
      </NativeSelect>
    </FormLabel>
  );
}

export function QueryConstFields({
  fields,
  query,
  onCommit
}: {
  fields: Set<QueryConstField>;
  query: WorkflowQueryConfig;
  onCommit: (next: WorkflowQueryConfig) => void;
}) {
  return (
    <>
      {fields.has("type") ? (
        <FormLabel label="Entity type">
          <NativeSelect
            value={query.type ?? ""}
            onChange={(event) => {
              const value = event.target.value;
              onCommit({ ...query, type: value ? (value as WorkflowQueryConfig["type"]) : undefined });
            }}
          >
            <option value="">any</option>
            {queryEntityTypes.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </NativeSelect>
        </FormLabel>
      ) : null}
      {fields.has("limit") ? (
        <FormLabel label="Limit">
          <Input
            value={query.limit !== undefined ? String(query.limit) : ""}
            onChange={(event) => {
              const raw = event.target.value.trim();
              onCommit({ ...query, limit: raw ? Number(raw) || undefined : undefined });
            }}
          />
        </FormLabel>
      ) : null}
      {fields.has("depth") ? (
        <FormLabel label="Depth">
          <Input
            value={query.depth !== undefined ? String(query.depth) : "1"}
            onChange={(event) => {
              const parsed = Number(event.target.value);
              onCommit({ ...query, depth: Number.isInteger(parsed) && parsed >= 1 ? parsed : 1 });
            }}
          />
        </FormLabel>
      ) : null}
      {fields.has("select") ? (
        <FormLabel label="Select">
          <NativeSelect
            value={query.select ?? "compact"}
            onChange={(event) =>
              onCommit({ ...query, select: event.target.value === "full" ? "full" : "compact" })
            }
          >
            <option value="compact">compact</option>
            <option value="full">full</option>
          </NativeSelect>
        </FormLabel>
      ) : null}
      {fields.has("includeArchived") ? (
        <FormLabel label="Include archived">
          <NativeSelect
            value={query.includeArchived === true ? "true" : "false"}
            onChange={(event) => onCommit({ ...query, includeArchived: event.target.value === "true" })}
          >
            <option value="false">no</option>
            <option value="true">yes</option>
          </NativeSelect>
        </FormLabel>
      ) : null}
    </>
  );
}
