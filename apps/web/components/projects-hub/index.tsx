"use client";

import { useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FolderKanban, Trash2 } from "lucide-react";
import type { ProjectSummary } from "@projectplaner/db";
import { FormLabel, GhostButton, TextInput } from "../ui";
import { projectPaths } from "../../lib/project-paths";

const PROTECTED_KEY = "PLAN";

interface ProjectsHubProps {
  initialProjects: ProjectSummary[];
}

export function ProjectsHub({ initialProjects }: ProjectsHubProps) {
  const router = useRouter();
  const [projects, setProjects] = useState(initialProjects);
  const [key, setKey] = useState("");
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deletingKey, setDeletingKey] = useState<string | null>(null);

  const sorted = useMemo(
    () => [...projects].sort((a, b) => a.key.localeCompare(b.key)),
    [projects]
  );

  async function refreshList() {
    const response = await fetch("/api/projects");
    const payload = (await response.json()) as { projects?: ProjectSummary[]; error?: string };
    if (!response.ok || !payload.projects) {
      throw new Error(payload.error ?? "Could not reload projects.");
    }
    setProjects(payload.projects);
  }

  async function onCreate(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/projects", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ key, title })
      });
      const payload = (await response.json()) as { project?: ProjectSummary; error?: string };
      if (!response.ok || !payload.project) {
        throw new Error(payload.error ?? "Could not create project.");
      }
      setKey("");
      setTitle("");
      await refreshList();
      router.push(projectPaths.workspace(payload.project.key));
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create project.");
    } finally {
      setBusy(false);
    }
  }

  async function onDelete(project: ProjectSummary) {
    if (project.key === PROTECTED_KEY) {
      return;
    }
    const confirmed = window.confirm(
      `Delete project ${project.key} (${project.title})? This permanently removes its entities and workflows.`
    );
    if (!confirmed) {
      return;
    }
    setDeletingKey(project.key);
    setError(null);
    try {
      const response = await fetch(`/api/projects?key=${encodeURIComponent(project.key)}`, {
        method: "DELETE"
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "Could not delete project.");
      }
      await refreshList();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete project.");
    } finally {
      setDeletingKey(null);
    }
  }

  return (
    <main className="min-h-screen bg-[#f8faf9] text-zinc-900">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-4 px-4 py-6">
        <header className="flex items-center gap-2">
          <FolderKanban className="h-5 w-5 text-teal-800" />
          <div>
            <h1 className="text-base font-semibold">Projects</h1>
            <p className="text-xs text-muted-foreground">
              Multi-project hub — open a workspace, create, or delete. MCP stays PLAN-default.
            </p>
          </div>
        </header>

        <form
          onSubmit={onCreate}
          className="grid gap-3 rounded-md border border-border bg-white p-3 sm:grid-cols-[7rem_1fr_auto]"
        >
          <FormLabel label="Key">
            <TextInput
              value={key}
              onChange={(event) => setKey(event.target.value.toUpperCase())}
              placeholder="DEMO"
              maxLength={32}
              required
              disabled={busy}
            />
          </FormLabel>
          <FormLabel label="Title">
            <TextInput
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Demo project"
              required
              disabled={busy}
            />
          </FormLabel>
          <div className="flex items-end">
            <GhostButton type="submit" tone="primary" disabled={busy || !key.trim() || !title.trim()}>
              {busy ? "Creating…" : "Create project"}
            </GhostButton>
          </div>
        </form>

        {error ? <p className="text-xs text-rose-700">{error}</p> : null}

        <div className="overflow-hidden rounded-md border border-border bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border bg-zinc-50 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Key</th>
                <th className="px-3 py-2 font-medium">Title</th>
                <th className="px-3 py-2 font-medium tabular-nums">Entities</th>
                <th className="px-3 py-2 font-medium tabular-nums">Workflows</th>
                <th className="px-3 py-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((project) => (
                <tr key={project.id} className="border-b border-border last:border-0">
                  <td className="px-3 py-2">
                    <Link
                      href={projectPaths.workspace(project.key)}
                      className="font-mono text-xs font-semibold text-teal-900 hover:underline"
                    >
                      {project.key}
                    </Link>
                  </td>
                  <td className="px-3 py-2">
                    <Link href={projectPaths.workspace(project.key)} className="font-medium hover:underline">
                      {project.title}
                    </Link>
                  </td>
                  <td className="px-3 py-2 tabular-nums text-zinc-700">{project.entityCount}</td>
                  <td className="px-3 py-2 tabular-nums text-zinc-700">{project.workflowCount}</td>
                  <td className="px-3 py-2">
                    {project.key === PROTECTED_KEY ? (
                      <span className="text-xs text-muted-foreground">Protected</span>
                    ) : (
                      <GhostButton
                        size="xs"
                        tone="danger"
                        disabled={deletingKey === project.key}
                        onClick={() => onDelete(project)}
                      >
                        <span className="inline-flex items-center gap-1">
                          <Trash2 className="h-3.5 w-3.5" />
                          {deletingKey === project.key ? "Deleting…" : "Delete"}
                        </span>
                      </GhostButton>
                    )}
                  </td>
                </tr>
              ))}
              {sorted.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-sm text-muted-foreground">
                    No projects yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
