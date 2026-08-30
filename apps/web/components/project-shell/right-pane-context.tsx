"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import assistant from "@projectplaner/core/assistant";
import type { AssistantContext, AssistantSessionRecord } from "@projectplaner/core/assistant";
import { createContext, useContext } from "react";

const { merge } = assistant;

export type RightPaneMode = "inspect" | "assistant";

export type AssistantNavFrame = {
  key: string;
  label: string;
  itemId?: string;
};

export type AssistantSessionListItem = {
  id: string;
  title: string;
  updatedAt: string;
};

type RightPaneContextValue = {
  projectKey: string;
  mode: RightPaneMode;
  setMode: (mode: RightPaneMode) => void;
  record: AssistantSessionRecord | null;
  sessions: AssistantSessionListItem[];
  loading: boolean;
  sending: boolean;
  error: string | null;
  nav: AssistantNavFrame[];
  setNav: (nav: AssistantNavFrame[]) => void;
  sendMessage: (message: string, patch?: unknown) => Promise<void>;
  publishContext: (context: Partial<AssistantContext>) => void;
  openChat: () => void;
  selectSession: (id: string) => Promise<void>;
  createSession: () => Promise<void>;
};

const RightPaneContext = createContext<RightPaneContextValue | null>(null);

function modeStorageKey(projectKey: string) {
  return `projectplaner.pane.${projectKey}.mode`;
}

function sessionIdStorageKey(projectKey: string) {
  return `projectplaner.assistant.${projectKey}.sessionId`;
}

function toListItem(row: AssistantSessionRecord): AssistantSessionListItem {
  return { id: row.id, title: row.title, updatedAt: row.updatedAt };
}

const CHAT_FRAME: AssistantNavFrame = { key: "transcript", label: "Chat" };

export function RightPaneProvider({
  projectKey,
  children
}: {
  projectKey: string;
  children: ReactNode;
}) {
  const [mode, setModeState] = useState<RightPaneMode>("inspect");
  const [record, setRecord] = useState<AssistantSessionRecord | null>(null);
  const [sessions, setSessions] = useState<AssistantSessionListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nav, setNav] = useState<AssistantNavFrame[]>([CHAT_FRAME]);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recordRef = useRef(record);
  recordRef.current = record;

  useEffect(() => {
    const stored = window.localStorage.getItem(modeStorageKey(projectKey));
    setModeState(stored === "assistant" ? "assistant" : "inspect");
  }, [projectKey]);

  const rememberSession = useCallback((id: string) => {
    window.localStorage.setItem(sessionIdStorageKey(projectKey), id);
  }, [projectKey]);

  const applyRecord = useCallback(
    (next: AssistantSessionRecord) => {
      setRecord(next);
      recordRef.current = next;
      rememberSession(next.id);
      setSessions((current) => {
        const item = toListItem(next);
        const rest = current.filter((row) => row.id !== next.id);
        return [item, ...rest];
      });
    },
    [rememberSession]
  );

  const setMode = useCallback(
    (next: RightPaneMode) => {
      setModeState(next);
      window.localStorage.setItem(modeStorageKey(projectKey), next);
    },
    [projectKey]
  );

  const selectSession = useCallback(
    async (id: string) => {
      setError(null);
      const response = await fetch(`/api/assistant/sessions/${encodeURIComponent(id)}`);
      const payload = (await response.json()) as { session?: AssistantSessionRecord; error?: string };
      if (!response.ok || !payload.session) {
        throw new Error(payload.error ?? "Could not open session.");
      }
      applyRecord(payload.session);
      setNav([CHAT_FRAME]);
      setMode("assistant");
    },
    [applyRecord, setMode]
  );

  const createSession = useCallback(async () => {
    setError(null);
    const response = await fetch("/api/assistant/sessions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ projectKey, new: true })
    });
    const payload = (await response.json()) as { session?: AssistantSessionRecord; error?: string };
    if (!response.ok || !payload.session) {
      throw new Error(payload.error ?? "Could not create session.");
    }
    applyRecord(payload.session);
    setNav([CHAT_FRAME]);
    setMode("assistant");
  }, [applyRecord, projectKey, setMode]);

  const openChat = useCallback(() => {
    if (!recordRef.current) {
      void createSession().catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Could not open chat.");
      });
      return;
    }
    setMode("assistant");
    setNav([CHAT_FRAME]);
  }, [createSession, setMode]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    void (async () => {
      try {
        const listResponse = await fetch(
          `/api/assistant/sessions?projectKey=${encodeURIComponent(projectKey)}`
        );
        const listPayload = (await listResponse.json()) as {
          sessions?: AssistantSessionRecord[];
          error?: string;
        };
        if (!listResponse.ok) {
          throw new Error(listPayload.error ?? "Could not list sessions.");
        }
        const rows = listPayload.sessions ?? [];
        if (cancelled) {
          return;
        }
        setSessions(rows.map(toListItem));
        const lastId = window.localStorage.getItem(sessionIdStorageKey(projectKey));
        const pick = rows.find((row) => row.id === lastId) ?? rows[0];
        if (pick) {
          applyRecord(pick);
          setNav([CHAT_FRAME]);
        } else {
          setRecord(null);
          recordRef.current = null;
        }
      } catch (err: unknown) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Could not load assistant sessions.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [applyRecord, projectKey]);

  const sendMessage = useCallback(async (message: string, patch?: unknown) => {
    const current = recordRef.current;
    if (!current) {
      return;
    }
    setSending(true);
    setError(null);
    try {
      const response = await fetch("/api/assistant/turn", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sessionId: current.id, message, patch })
      });
      const payload = (await response.json()) as { session?: AssistantSessionRecord; error?: string };
      if (!response.ok || !payload.session) {
        throw new Error(payload.error ?? "Turn failed.");
      }
      applyRecord(payload.session);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Turn failed.");
    } finally {
      setSending(false);
    }
  }, [applyRecord]);

  const persistContext = useCallback((sessionId: string, context: Partial<AssistantContext>) => {
    fetch(`/api/assistant/sessions/${encodeURIComponent(sessionId)}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ context })
    }).catch(() => {
      /* selection chatter; next turn still has client session */
    });
  }, []);

  const publishContext = useCallback(
    (context: Partial<AssistantContext>) => {
      const current = recordRef.current;
      if (!current) {
        return;
      }
      const nextSession = merge(current.session, { context });
      const nextRecord = { ...current, session: nextSession };
      setRecord(nextRecord);
      recordRef.current = nextRecord;
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
      debounceRef.current = setTimeout(() => persistContext(current.id, context), 400);
    },
    [persistContext]
  );

  const value = useMemo(
    () => ({
      projectKey,
      mode,
      setMode,
      record,
      sessions,
      loading,
      sending,
      error,
      nav,
      setNav,
      sendMessage,
      publishContext,
      openChat,
      selectSession,
      createSession
    }),
    [
      projectKey,
      mode,
      setMode,
      record,
      sessions,
      loading,
      sending,
      error,
      nav,
      sendMessage,
      publishContext,
      openChat,
      selectSession,
      createSession
    ]
  );

  return <RightPaneContext.Provider value={value}>{children}</RightPaneContext.Provider>;
}

export function useRightPane(): RightPaneContextValue {
  const ctx = useContext(RightPaneContext);
  if (!ctx) {
    throw new Error("useRightPane requires RightPaneProvider");
  }
  return ctx;
}

export function useAssistantContextPublisher() {
  const ctx = useContext(RightPaneContext);
  return ctx?.publishContext;
}
