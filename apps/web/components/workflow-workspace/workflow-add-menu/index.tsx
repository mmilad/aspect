"use client";

import { useEffect, useRef, useState } from "react";
import {
  workflowControlNodeTypes,
  workflowWorkNodeTypes,
  type WorkflowEdgeKind,
  type WorkflowNodeType
} from "@projectplaner/core";
import { GhostButton } from "../../ui";

type MenuPosition = { x: number; y: number } | null;

export function WorkflowAddMenuBody({
  connectKind,
  onConnectKindChange,
  onAddNode,
  onClose
}: {
  connectKind: WorkflowEdgeKind;
  onConnectKindChange: (kind: WorkflowEdgeKind) => void;
  onAddNode: (type: WorkflowNodeType) => void;
  onClose?: () => void;
}) {
  function add(type: WorkflowNodeType) {
    onAddNode(type);
    onClose?.();
  }

  return (
    <div className="min-w-[180px] rounded-md border border-border bg-white p-2 shadow-pane">
      <div className="mb-2">
        <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          Connect as
        </div>
        <select
          className="w-full rounded border border-border bg-white px-2 py-1 text-xs"
          value={connectKind}
          onChange={(event) => onConnectKindChange(event.target.value as WorkflowEdgeKind)}
        >
          <option value="next">next</option>
          <option value="route">route</option>
          <option value="depends_on">depends_on</option>
          <option value="error">error</option>
        </select>
      </div>
      <Section label="Control" types={workflowControlNodeTypes} onAdd={add} />
      <Section label="Work" types={workflowWorkNodeTypes} onAdd={add} />
    </div>
  );
}

function Section({
  label,
  types,
  onAdd
}: {
  label: string;
  types: readonly WorkflowNodeType[];
  onAdd: (type: WorkflowNodeType) => void;
}) {
  return (
    <div className="mb-2 last:mb-0">
      <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="flex flex-col gap-0.5">
        {types.map((type) => (
          <button
            key={type}
            type="button"
            className="rounded px-2 py-1 text-left text-xs capitalize hover:bg-muted"
            onClick={() => onAdd(type)}
          >
            {type.replaceAll("_", " ")}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Toolbar dropdown for Add + connect kind. */
export function WorkflowToolbarAdd({
  connectKind,
  onConnectKindChange,
  onAddNode
}: {
  connectKind: WorkflowEdgeKind;
  onConnectKindChange: (kind: WorkflowEdgeKind) => void;
  onAddNode: (type: WorkflowNodeType) => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    function onDoc(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <GhostButton size="xs" tone={open ? "accent" : "default"} active={open} onClick={() => setOpen((v) => !v)}>
        Add
      </GhostButton>
      {open ? (
        <div className="absolute right-0 top-full z-50 mt-1">
          <WorkflowAddMenuBody
            connectKind={connectKind}
            onConnectKindChange={onConnectKindChange}
            onAddNode={onAddNode}
            onClose={() => setOpen(false)}
          />
        </div>
      ) : null}
    </div>
  );
}

/** Floating context menu at cursor. */
export function WorkflowCanvasContextMenu({
  position,
  connectKind,
  onConnectKindChange,
  onAddNode,
  onClose
}: {
  position: MenuPosition;
  connectKind: WorkflowEdgeKind;
  onConnectKindChange: (kind: WorkflowEdgeKind) => void;
  onAddNode: (type: WorkflowNodeType) => void;
  onClose: () => void;
}) {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!position) {
      return;
    }
    function onDoc(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        onClose();
      }
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [position, onClose]);

  if (!position) {
    return null;
  }

  return (
    <div
      ref={rootRef}
      className="fixed z-50"
      style={{ left: position.x, top: position.y }}
      onContextMenu={(event) => event.preventDefault()}
    >
      <WorkflowAddMenuBody
        connectKind={connectKind}
        onConnectKindChange={onConnectKindChange}
        onAddNode={onAddNode}
        onClose={onClose}
      />
    </div>
  );
}
