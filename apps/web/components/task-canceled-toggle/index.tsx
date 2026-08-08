"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { JsonRecord } from "@projectplaner/core";
import { GhostButton } from "../ui";

interface TaskCanceledToggleProps {
  entityId: string;
  metadata: JsonRecord;
}

export function TaskCanceledToggle({ entityId, metadata }: TaskCanceledToggleProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [disabled, setDisabled] = useState(metadata.disabled === true);
  const [error, setError] = useState<string | null>(null);

  async function toggle() {
    setError(null);
    const nextDisabled = !disabled;
    const nextMetadata: JsonRecord = { ...metadata };
    if (nextDisabled) {
      nextMetadata.disabled = true;
    } else {
      delete nextMetadata.disabled;
    }

    const response = await fetch("/api/entities", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        id: entityId,
        patch: { metadata: nextMetadata }
      })
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      setError(payload?.error ?? "Could not update canceled flag.");
      return;
    }

    setDisabled(nextDisabled);
    startTransition(() => {
      router.refresh();
    });
  }

  return (
    <div className="rounded-md border border-border bg-white p-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Canceled</div>
          <p className="mt-1 text-sm text-zinc-700">
            {disabled
              ? "Excluded from New Task candidacy (fallen decision branch)."
              : "Mark disabled when a decision branch falls away."}
          </p>
        </div>
        <GhostButton size="xs" tone={disabled ? "danger" : "default"} disabled={pending} onClick={() => void toggle()}>
          {pending ? "Saving…" : disabled ? "Restore" : "Cancel task"}
        </GhostButton>
      </div>
      {error ? <p className="mt-2 text-xs text-rose-700">{error}</p> : null}
    </div>
  );
}
