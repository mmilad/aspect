"use client";
import { useCallback } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

/** The URL owns chat selection, including reload and browser history. */
export function useAgentSelection(projectKey: string) {
  const pathname = usePathname();
  const params = useSearchParams();
  const router = useRouter();
  const inProject = pathname === `/projects/${projectKey}` || pathname.startsWith(`/projects/${projectKey}/`);
  const agentId = inProject ? params.get("agent") || null : null;
  const mode = inProject && (agentId || params.get("assistant") === "1") ? "assistant" : "inspect";
  const navigate = useCallback((id: string | null, open: boolean) => {
    const next = new URLSearchParams(params.toString());
    next.delete("agent");
    next.delete("assistant");
    if (open) {
      next.set("assistant", "1");
      if (id) next.set("agent", id);
    }
    const query = next.toString();
    router.push(pathname + (query ? `?${query}` : ""), { scroll: false });
  }, [pathname, params, router]);
  const select = useCallback((id: string | null) => navigate(id, true), [navigate]);
  const setMode = useCallback((next: "inspect" | "assistant") => navigate(agentId, next === "assistant"), [navigate, agentId]);
  return { selectedAgentId: agentId, setSelectedAgentId: select, mode, setMode } as const;
}
