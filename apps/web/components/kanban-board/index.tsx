"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ProjectPlanSnapshot } from "@projectplaner/core";
import { Badge, Select, ToolbarLink } from "../ui";
import { formatEntityType, formatStatus } from "../../lib/entity-label";
import {
  buildKanbanBreadcrumbs,
  childColumnsForCard,
  columnToStatus,
  deriveParentColumn,
  kanbanColumnLabel,
  kanbanColumns,
  listBoardCards,
  statusToColumn,
  usedKanbanColumns,
  type KanbanCard,
  type KanbanCardKind,
  type KanbanColumnId
} from "../../lib/kanban";
import { projectPaths } from "../../lib/project-paths";
import { cn } from "../../lib/utils";

const KIND_STYLES: Record<KanbanCardKind, string> = {
  aspect: "border-l-cyan-600",
  feature: "border-l-teal-700",
  task: "border-l-zinc-500"
};

type TypeFilter = KanbanCardKind;
type ColumnVisibilityMode = "used" | "custom";

interface KanbanBoardProps {
  snapshot: ProjectPlanSnapshot;
  scopeId?: string | null;
  selectedId?: string;
}

function kanbanHref(projectKey: string, scopeId: string | null | undefined, selectedId?: string) {
  return projectPaths.kanban(projectKey, {
    scope: scopeId ?? undefined,
    selected: selectedId
  });
}

function getRootId(snapshot: ProjectPlanSnapshot): string | undefined {
  return snapshot.nodes[0]?.id;
}

export function KanbanBoard({ snapshot, scopeId = null, selectedId }: KanbanBoardProps) {
  const router = useRouter();
  const projectKey = snapshot.project.key;
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [typeFilters, setTypeFilters] = useState<Set<TypeFilter>>(
    () => new Set(["aspect", "feature", "task"])
  );
  const [columnMode, setColumnMode] = useState<ColumnVisibilityMode>("used");
  const [visibleColumns, setVisibleColumns] = useState<Set<KanbanColumnId>>(
    () => new Set(kanbanColumns.filter((column) => column !== "done"))
  );
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [localOverrides, setLocalOverrides] = useState<Record<string, { status: string; column: KanbanColumnId }>>(
    {}
  );

  const crumbs = useMemo(() => buildKanbanBreadcrumbs(snapshot, scopeId), [snapshot, scopeId]);
  const baseCards = useMemo(() => listBoardCards(snapshot, scopeId), [snapshot, scopeId]);

  const typedCards = useMemo(() => {
    return baseCards
      .map((card) => {
        const override = localOverrides[card.id];
        if (!override) {
          return card;
        }
        return { ...card, status: override.status, column: override.column };
      })
      .filter((card) => typeFilters.has(card.kind));
  }, [baseCards, localOverrides, typeFilters]);

  const displayColumns = useMemo(() => {
    if (columnMode === "used") {
      const used = usedKanbanColumns(typedCards);
      return used.length > 0 ? used : (["planned"] as KanbanColumnId[]);
    }
    return kanbanColumns.filter((column) => visibleColumns.has(column));
  }, [columnMode, typedCards, visibleColumns]);

  const cards = useMemo(
    () => typedCards.filter((card) => displayColumns.includes(card.column)),
    [typedCards, displayColumns]
  );

  const rollupById = useMemo(() => {
    const map = new Map<string, KanbanColumnId>();
    for (const card of baseCards) {
      if (!card.canEnter) {
        continue;
      }
      const derived = deriveParentColumn(childColumnsForCard(snapshot, card));
      if (derived) {
        map.set(card.id, derived);
      }
    }
    return map;
  }, [baseCards, snapshot]);

  const scopeTitle = crumbs.length > 0 ? crumbs[crumbs.length - 1]!.title : "Top-level Aspects";
  const graphFocusId = scopeId ?? selectedId ?? getRootId(snapshot);

  function toggleType(kind: TypeFilter) {
    setTypeFilters((prev) => {
      const next = new Set(prev);
      if (next.has(kind)) {
        if (next.size > 1) {
          next.delete(kind);
        }
      } else {
        next.add(kind);
      }
      return next;
    });
  }

  function toggleColumn(column: KanbanColumnId) {
    setColumnMode("custom");
    setVisibleColumns((prev) => {
      const next = new Set(prev);
      if (next.has(column)) {
        if (next.size > 1) {
          next.delete(column);
        }
      } else {
        next.add(column);
      }
      return next;
    });
  }

  async function moveCard(card: KanbanCard, column: KanbanColumnId) {
    if (card.column === column) {
      return;
    }
    const nextStatus = columnToStatus(column, card.kind);
    setError(null);
    setLocalOverrides((prev) => ({ ...prev, [card.id]: { status: nextStatus, column } }));

    const response = await fetch("/api/entities", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        id: card.id,
        patch: { status: nextStatus }
      })
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      setError(payload?.error ?? "Could not update status.");
      setLocalOverrides((prev) => {
        const next = { ...prev };
        delete next[card.id];
        return next;
      });
      return;
    }

    startTransition(() => {
      router.refresh();
    });
  }

  return (
    <section className="flex h-full min-h-0 flex-col bg-[#f8faf9]">
      <div className="border-b border-border bg-white px-4 py-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <div className="text-sm font-medium text-zinc-900">Kanban</div>
            <p className="mt-1 text-xs text-muted-foreground">
              Nested boards mirror graph scope. Mixed child types share process columns.
            </p>
          </div>
          <ToolbarLink href={projectPaths.graph(projectKey, graphFocusId ?? undefined)} size="xs">
            Open graph
          </ToolbarLink>
        </div>

        <nav className="mt-3 flex flex-wrap items-center gap-1 text-xs" aria-label="Kanban scope">
          <Link
            className={cn(
              "rounded-md border px-2 py-1",
              !scopeId ? "border-teal-700 bg-teal-50 text-teal-900" : "border-border bg-white hover:bg-muted"
            )}
            href={kanbanHref(projectKey, null, selectedId)}
          >
            Root
          </Link>
          {crumbs.map((crumb) => (
            <span key={crumb.id} className="inline-flex items-center gap-1">
              <span className="text-muted-foreground">/</span>
              <Link
                className={cn(
                  "rounded-md border px-2 py-1",
                  crumb.id === scopeId
                    ? "border-teal-700 bg-teal-50 text-teal-900"
                    : "border-border bg-white hover:bg-muted"
                )}
                href={kanbanHref(projectKey, crumb.id, selectedId)}
              >
                {crumb.title}
              </Link>
            </span>
          ))}
        </nav>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Select
            className="w-auto min-w-[10rem] text-xs"
            value={columnMode}
            onChange={(event) => setColumnMode(event.target.value as ColumnVisibilityMode)}
            aria-label="Column visibility mode"
          >
            <option value="used">Only used columns</option>
            <option value="custom">Custom columns</option>
          </Select>
          <span className="text-[11px] text-muted-foreground">
            {scopeTitle} · {cards.length} cards{pending ? " · saving…" : ""}
          </span>
        </div>

        <div className="mt-2 flex flex-wrap gap-1">
          {(["aspect", "feature", "task"] as const).map((kind) => {
            const active = typeFilters.has(kind);
            return (
              <button
                key={kind}
                type="button"
                className={cn(
                  "h-7 rounded-md border px-2 text-xs",
                  active
                    ? "border-teal-700 bg-teal-50 text-teal-900"
                    : "border-border bg-white text-muted-foreground hover:bg-muted"
                )}
                aria-pressed={active}
                onClick={() => toggleType(kind)}
              >
                {formatEntityType(kind)}
              </button>
            );
          })}
        </div>

        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
          {kanbanColumns.map((column) => {
            const checked =
              columnMode === "used" ? displayColumns.includes(column) : visibleColumns.has(column);
            return (
              <label key={column} className="inline-flex items-center gap-1.5 text-[11px] text-zinc-700">
                <input
                  type="checkbox"
                  className="h-3.5 w-3.5 accent-teal-700"
                  checked={checked}
                  disabled={columnMode === "used"}
                  onChange={() => toggleColumn(column)}
                />
                {kanbanColumnLabel[column]}
              </label>
            );
          })}
        </div>

        {error ? <p className="mt-2 text-xs text-red-700">{error}</p> : null}
      </div>

      <div className="min-h-0 flex-1 overflow-auto p-3">
        <div className="flex min-h-full gap-3">
          {displayColumns.map((column) => {
            const columnCards = cards.filter((card) => card.column === column);
            return (
              <div
                key={column}
                className="flex w-64 shrink-0 flex-col rounded-md border border-border bg-white"
                onDragOver={(event) => {
                  event.preventDefault();
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  const id = event.dataTransfer.getData("text/kanban-card") || draggingId;
                  const card = cards.find((item) => item.id === id) ?? baseCards.find((item) => item.id === id);
                  if (card) {
                    void moveCard(card, column);
                  }
                  setDraggingId(null);
                }}
              >
                <div className="border-b border-border px-2.5 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {kanbanColumnLabel[column]}
                  <span className="ml-2 font-normal normal-case text-zinc-500">({columnCards.length})</span>
                </div>
                <ul className="flex flex-1 flex-col gap-2 p-2">
                  {columnCards.length === 0 ? (
                    <li className="px-1 py-4 text-xs text-muted-foreground">Empty</li>
                  ) : (
                    columnCards.map((card) => {
                      const rollup = rollupById.get(card.id);
                      return (
                        <li
                          key={card.id}
                          draggable
                          onDragStart={(event) => {
                            setDraggingId(card.id);
                            event.dataTransfer.setData("text/kanban-card", card.id);
                            event.dataTransfer.effectAllowed = "move";
                          }}
                          onDragEnd={() => setDraggingId(null)}
                          className={cn(
                            "rounded-md border border-border border-l-4 bg-[#f8faf9] px-2.5 py-2 shadow-sm",
                            KIND_STYLES[card.kind],
                            draggingId === card.id && "opacity-60"
                          )}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                                {formatEntityType(card.kind)}
                                {card.key ? ` · ${card.key}` : ""}
                              </div>
                              {card.canEnter ? (
                                <Link
                                  className="mt-0.5 block text-sm font-medium text-teal-800 hover:underline"
                                  href={kanbanHref(projectKey, card.id, selectedId ?? card.id)}
                                >
                                  {card.title}
                                </Link>
                              ) : (
                                <Link
                                  className="mt-0.5 block text-sm font-medium text-teal-800 hover:underline"
                                  href={projectPaths.entity(projectKey, card.id)}
                                >
                                  {card.title}
                                </Link>
                              )}
                            </div>
                            <Badge>{formatStatus(card.status)}</Badge>
                          </div>
                          {rollup ? (
                            <div className="mt-1.5 text-[10px] text-muted-foreground">
                              Children rollup · {kanbanColumnLabel[rollup]}
                              {rollup !== statusToColumn(card.status) ? " (own differs)" : ""}
                            </div>
                          ) : null}
                          <div className="mt-2 flex flex-wrap gap-1">
                            {card.canEnter ? (
                              <ToolbarLink
                                href={kanbanHref(projectKey, card.id, selectedId ?? card.id)}
                                size="xs"
                              >
                                Enter
                              </ToolbarLink>
                            ) : null}
                            <ToolbarLink href={projectPaths.entity(projectKey, card.id)} size="xs">
                              Detail
                            </ToolbarLink>
                          </div>
                        </li>
                      );
                    })
                  )}
                </ul>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
