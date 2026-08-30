"use client";

import { Plus } from "lucide-react";
import { Button } from "../ui";
import { cn } from "../../lib/utils";
import { useRightPane } from "../project-shell/right-pane-context";
import styles from "./style.module.css";

export function AssistantSessionsSection() {
  const { record, sessions, loading, createSession, selectSession, error } = useRightPane();

  return (
    <section className={styles.section} aria-label="Assistant">
      <div className={styles.heading}>Assistant</div>
      <Button
        type="button"
        size="sm"
        className="mb-2 w-full justify-start"
        onClick={() => {
          void createSession().catch(() => undefined);
        }}
      >
        <Plus className="h-3.5 w-3.5" />
        New chat
      </Button>
      {loading && sessions.length === 0 ? (
        <p className={styles.contextHint}>Loading…</p>
      ) : null}
      {sessions.length === 0 && !loading ? (
        <p className={styles.contextHint}>No chats yet.</p>
      ) : null}
      <div className={styles.nav}>
        {sessions.map((session) => {
          const active = record?.id === session.id;
          return (
            <button
              key={session.id}
              type="button"
              className={cn(styles.scopeItem, active && styles.activeSession)}
              onClick={() => {
                void selectSession(session.id).catch(() => undefined);
              }}
            >
              {session.title || "Chat"}
            </button>
          );
        })}
      </div>
      {error ? <p className={styles.createError}>{error}</p> : null}
    </section>
  );
}
