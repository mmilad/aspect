"use client";

import { useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { EntityRelationType, ProjectNode, ProjectPlanSnapshot } from "@projectplaner/core";
import { GhostButton, TextInput, Select, FormLabel } from "../ui";
import styles from "./style.module.css";
import {
  RELATION_TYPE_OPTIONS,
  TASK_LINK_OPTIONS,
  type CreationKind,
  defaultAspectParentId,
  defaultFeatureAspectId,
  defaultTaskTarget,
  resolveCreationContext
} from "./creation-context";

interface CreationRailProps {
  snapshot: ProjectPlanSnapshot;
  selectedId?: string;
  centerNode?: ProjectNode;
  onCreated?: (id: string) => void;
}

const KIND_BUTTONS: Array<{ kind: CreationKind; label: string }> = [
  { kind: "aspect", label: "Aspect" },
  { kind: "feature", label: "Feature" },
  { kind: "task", label: "Task" },
  { kind: "entry", label: "Entry" },
  { kind: "reference", label: "Reference" },
  { kind: "relation", label: "Relation" }
];

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
  const payload = (await response.json()) as T & { error?: string };
  if (!response.ok) {
    throw new Error(payload.error ?? `Request failed (${response.status})`);
  }
  return payload;
}

export function CreationRail({ snapshot, selectedId, centerNode, onCreated }: CreationRailProps) {
  const router = useRouter();
  const context = useMemo(
    () => resolveCreationContext(snapshot, selectedId, centerNode),
    [snapshot, selectedId, centerNode]
  );
  const [kind, setKind] = useState<CreationKind | null>(null);
  const [title, setTitle] = useState("");
  const [relationType, setRelationType] = useState<EntityRelationType>("related_to");
  const [relationTargetId, setRelationTargetId] = useState("");
  const [taskLinkType, setTaskLinkType] = useState<(typeof TASK_LINK_OPTIONS)[number]>("affects");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const targetOptions = useMemo(() => {
    const options: Array<{ id: string; label: string }> = [];
    for (const node of snapshot.nodes) {
      if (node.type === "project") continue;
      options.push({ id: node.id, label: `${node.type}: ${node.title}` });
    }
    for (const feature of snapshot.features) {
      options.push({ id: feature.id, label: `feature: ${feature.title}` });
    }
    for (const task of snapshot.tasks) {
      options.push({ id: task.id, label: `task: ${task.title}` });
    }
    return options;
  }, [snapshot]);

  function resetForm(nextKind: CreationKind | null = null) {
    setKind(nextKind);
    setTitle("");
    setRelationTargetId("");
    setRelationType("related_to");
    setTaskLinkType("affects");
    setError(null);
    setStatus(null);
  }

  async function finish(createdId: string, label: string) {
    setStatus(`Created ${label}`);
    setTitle("");
    setRelationTargetId("");
    onCreated?.(createdId);
    router.refresh();
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!kind) return;
    setBusy(true);
    setError(null);
    setStatus(null);
    try {
      const projectKey = snapshot.project.key;
      const trimmed = title.trim();

      if (kind === "relation") {
        if (!context?.id) {
          throw new Error("Select an entity as the relation source.");
        }
        if (!relationTargetId) {
          throw new Error("Pick a relation target.");
        }
        await postJson("/api/relations", {
          projectKey,
          sourceEntityId: context.id,
          targetEntityId: relationTargetId,
          type: relationType,
          isPrimary: relationType === "contains"
        });
        await finish(relationTargetId, "relation");
        return;
      }

      if (!trimmed) {
        throw new Error("Title is required.");
      }

      if (kind === "task") {
        const target = defaultTaskTarget(context, snapshot);
        if (!target) {
          throw new Error("Select an Aspect or Feature as the task target.");
        }
        const result = await postJson<{ task: { id: string; key?: string | null } }>("/api/tasks", {
          projectKey,
          title: trimmed,
          targetType: target.targetType,
          targetId: target.targetId,
          linkType: taskLinkType
        });
        await finish(result.task.id, result.task.key ?? "task");
        return;
      }

      if (kind === "feature") {
        const aspectId = defaultFeatureAspectId(context, snapshot);
        if (!aspectId) {
          throw new Error("Select an Aspect (or Feature under one) for the new Feature.");
        }
        const result = await postJson<{ entity: { id: string; key?: string | null } }>("/api/entities", {
          projectKey,
          type: "feature",
          title: trimmed,
          relations: [{ targetEntityId: aspectId, type: "implements", isPrimary: true }]
        });
        await finish(result.entity.id, result.entity.key ?? "feature");
        return;
      }

      if (kind === "aspect" || kind === "entry") {
        const parentId = defaultAspectParentId(context, snapshot);
        if (!parentId) {
          throw new Error("No parent available for nesting.");
        }
        const result = await postJson<{ entity: { id: string } }>("/api/entities", {
          projectKey,
          type: kind,
          title: trimmed
        });
        await postJson("/api/relations", {
          projectKey,
          sourceEntityId: parentId,
          targetEntityId: result.entity.id,
          type: "contains",
          isPrimary: true
        });
        await finish(result.entity.id, kind);
        return;
      }

      if (kind === "reference") {
        if (!context?.id) {
          throw new Error("Select an entity to reference.");
        }
        const result = await postJson<{ entity: { id: string } }>("/api/entities", {
          projectKey,
          type: "reference",
          title: trimmed,
          relations: [{ targetEntityId: context.id, type: "references", isPrimary: true }]
        });
        const parentId = defaultAspectParentId(context, snapshot);
        if (parentId) {
          await postJson("/api/relations", {
            projectKey,
            sourceEntityId: parentId,
            targetEntityId: result.entity.id,
            type: "contains",
            isPrimary: true
          });
        }
        await finish(result.entity.id, "reference");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Create failed.");
    } finally {
      setBusy(false);
    }
  }

  const contextHint = context
    ? `${context.type}: ${context.title}`
    : "No selection — uses project root where needed";

  return (
    <section className={styles.section} aria-label="Create">
      <div className={styles.heading}>Create</div>
      <div className={styles.contextHint} title={contextHint}>
        Context: {contextHint}
      </div>
      <div className={styles.createGrid}>
        {KIND_BUTTONS.map((item) => (
          <GhostButton
            key={item.kind}
            size="xs"
            active={kind === item.kind}
            onClick={() => resetForm(kind === item.kind ? null : item.kind)}
          >
            {item.label}
          </GhostButton>
        ))}
      </div>

      {kind ? (
        <form className={styles.createForm} onSubmit={onSubmit}>
          {kind === "relation" ? (
            <>
              <FormLabel label="Type">
                <Select value={relationType} onChange={(event) => setRelationType(event.target.value as EntityRelationType)}>
                  {RELATION_TYPE_OPTIONS.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </Select>
              </FormLabel>
              <FormLabel label="Target">
                <Select value={relationTargetId} onChange={(event) => setRelationTargetId(event.target.value)} required>
                  <option value="">Select target…</option>
                  {targetOptions
                    .filter((option) => option.id !== context?.id)
                    .map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.label}
                      </option>
                    ))}
                </Select>
              </FormLabel>
            </>
          ) : (
            <>
              <FormLabel label="Title">
                <TextInput
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder={`${kind} title`}
                  autoFocus
                  required
                />
              </FormLabel>
              {kind === "task" ? (
                <FormLabel label="Link">
                  <Select
                    value={taskLinkType}
                    onChange={(event) => setTaskLinkType(event.target.value as (typeof TASK_LINK_OPTIONS)[number])}
                  >
                    {TASK_LINK_OPTIONS.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </Select>
                </FormLabel>
              ) : null}
            </>
          )}

          <div className={styles.createActions}>
            <GhostButton type="submit" size="xs" tone="primary" disabled={busy}>
              {busy ? "Saving…" : "Add"}
            </GhostButton>
            <GhostButton type="button" size="xs" disabled={busy} onClick={() => resetForm(null)}>
              Cancel
            </GhostButton>
          </div>
        </form>
      ) : null}

      {error ? <div className={styles.createError}>{error}</div> : null}
      {status ? <div className={styles.createStatus}>{status}</div> : null}
    </section>
  );
}
