"use client";

import { useCallback, useEffect, useState } from "react";
import type { WorkspaceView } from "@projectplaner/core";
import { Button, Input } from "../ui";

export function CodeWorkspacePanel({ projectKey }: { projectKey: string }) {
  const [view, setView] = useState<WorkspaceView | null>(null);
  const [sourceUrl, setSourceUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endpoint = `/api/projects/${encodeURIComponent(projectKey)}/workspace`;
  const refresh = useCallback(async () => {
    const response = await fetch(endpoint, { cache: "no-store" });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error?.message ?? "Could not load workspace.");
    setView(payload);
  }, [endpoint]);
  useEffect(() => { void refresh().catch((err: Error) => setError(err.message)); }, [refresh]);
  useEffect(() => {
    if (view?.workspace?.status !== "provisioning" || busy) return;
    const timer = setInterval(() => { void refresh().catch((err: Error) => setError(err.message)); }, 3000);
    return () => clearInterval(timer);
  }, [view?.workspace?.status, busy, refresh]);

  async function action(suffix: string, body?: unknown) {
    setBusy(true); setError(null);
    try {
      const response = await fetch(endpoint + suffix, {
        method: "POST", headers: { "content-type": "application/json" },
        ...(body === undefined ? {} : { body: JSON.stringify(body) })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error?.message ?? "Workspace action failed.");
      await refresh();
    } catch (err) { setError(err instanceof Error ? err.message : "Workspace action failed."); }
    finally { setBusy(false); }
  }
  const workspace = view?.workspace;
  const provisioning = workspace?.status === "provisioning" || (busy && (!workspace || workspace.status === "failed"));
  return <section className="space-y-3 rounded-md border border-border bg-white p-3" aria-label="Code workspace">
    <div className="flex items-center justify-between gap-2">
      <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Code workspace</h2>
      <Button size="xs" disabled={busy} onClick={() => {
        setError(null); void refresh().catch((err: Error) => setError(err.message));
      }}>Refresh</Button>
    </div>
    {view?.archivedAt ? <p className="text-xs">Project archived. Restore it in Projects before provisioning a repository.</p> : null}
    {!view && !error ? <p className="text-xs">Loading workspace…</p> : null}
    {view && !workspace ? <div className="space-y-2">
      <p className="text-xs text-muted-foreground">Optional app-managed repository on this machine. Import uses your existing Git authentication.</p>
      <Button size="sm" disabled={provisioning || Boolean(view.archivedAt)} onClick={() => void action("", { mode: "create" })}>Create repository</Button>
      <form className="flex gap-2" onSubmit={(event) => { event.preventDefault(); void action("", { mode: "import", sourceUrl }); }}>
        <Input aria-label="Repository URL" placeholder="HTTPS or SSH repository URL" value={sourceUrl} onChange={(event) => setSourceUrl(event.target.value)} disabled={provisioning || Boolean(view.archivedAt)} />
        <Button size="sm" type="submit" disabled={provisioning || Boolean(view.archivedAt) || !sourceUrl.trim()}>Import repository</Button>
      </form>
    </div> : null}
    {provisioning ? <p role="status" className="text-xs">Provisioning repository… Git may take up to five minutes.</p> : null}
    {workspace ? <div className="space-y-2 text-xs">
      <p>Status: {workspace.status === "ready" && view?.error ? "Unavailable" : workspace.status}</p>
      <p className="break-all font-mono">{workspace.repositoryPath}</p>
      {view?.git ? <div className="space-y-1">
        <p>Branch: {view.git.branch ?? "Detached HEAD"}</p>
        <p>HEAD: <span className="font-mono">{view.git.head ?? "No commits yet"}</span></p>
        <p>Working copy: {view.git.dirty ? "Uncommitted changes" : "Clean"}</p>
        {view.git.origin ? <p className="break-all">Origin: {view.git.origin}</p> : null}
      </div> : null}
      <div className="flex gap-2">
        <Button size="xs" onClick={() => void navigator.clipboard.writeText(workspace.repositoryPath).catch(() => setError("Could not copy path."))}>Copy path</Button>
        <Button size="xs" disabled={provisioning || !view?.git} onClick={() => void action("/open-folder")}>Open folder</Button>
        {workspace.status === "failed" ? <Button size="xs" disabled={provisioning || Boolean(view?.archivedAt)} onClick={() => void action("/retry")}>Retry</Button> : null}
      </div>
    </div> : null}
    {error || view?.error ? <p role="alert" className="text-xs text-rose-700">{error ?? view?.error?.message}</p> : null}
  </section>;
}
