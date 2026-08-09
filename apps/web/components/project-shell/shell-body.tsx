"use client";

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { PanelRight, PanelRightClose, PanelRightOpen } from "lucide-react";
import { GhostButton } from "../ui";
import styles from "./style.module.css";

const WIDTH_MIN = 280;
const WIDTH_MAX = 560;
const WIDTH_DEFAULT = 360;
const COLLAPSED_WIDTH = 36;

function storageKey(projectKey: string, kind: "width" | "collapsed") {
  return `projectplaner.inspector.${projectKey}.${kind}`;
}

function readStoredWidth(projectKey: string): number {
  if (typeof window === "undefined") {
    return WIDTH_DEFAULT;
  }
  const raw = window.localStorage.getItem(storageKey(projectKey, "width"));
  const parsed = raw ? Number(raw) : NaN;
  if (!Number.isFinite(parsed)) {
    return WIDTH_DEFAULT;
  }
  return Math.min(WIDTH_MAX, Math.max(WIDTH_MIN, parsed));
}

function readStoredCollapsed(projectKey: string): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  return window.localStorage.getItem(storageKey(projectKey, "collapsed")) === "1";
}

interface ShellBodyProps {
  projectKey: string;
  leftSidebar: ReactNode;
  center: ReactNode;
  rightSidebar: ReactNode;
}

export function ShellBody({ projectKey, leftSidebar, center, rightSidebar }: ShellBodyProps) {
  const [width, setWidth] = useState(WIDTH_DEFAULT);
  const [collapsed, setCollapsed] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const dragRef = useRef<{ startX: number; startWidth: number } | null>(null);

  useEffect(() => {
    setWidth(readStoredWidth(projectKey));
    setCollapsed(readStoredCollapsed(projectKey));
    setHydrated(true);
  }, [projectKey]);

  useEffect(() => {
    if (!hydrated) {
      return;
    }
    window.localStorage.setItem(storageKey(projectKey, "width"), String(width));
  }, [hydrated, projectKey, width]);

  useEffect(() => {
    if (!hydrated) {
      return;
    }
    window.localStorage.setItem(storageKey(projectKey, "collapsed"), collapsed ? "1" : "0");
  }, [collapsed, hydrated, projectKey]);

  function onResizePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (collapsed) {
      return;
    }
    event.preventDefault();
    dragRef.current = { startX: event.clientX, startWidth: width };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function onResizePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag) {
      return;
    }
    const delta = drag.startX - event.clientX;
    setWidth(Math.min(WIDTH_MAX, Math.max(WIDTH_MIN, drag.startWidth + delta)));
  }

  function onResizePointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    if (!dragRef.current) {
      return;
    }
    dragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  const rightWidth = collapsed ? COLLAPSED_WIDTH : width;

  return (
    <div
      className={styles.body}
      style={{
        gridTemplateColumns: `248px minmax(0, 1fr) ${rightWidth}px`
      }}
    >
      <aside className={styles.left}>{leftSidebar}</aside>
      <section className={styles.center}>{center}</section>
      <aside className={styles.right} aria-label="Right inspector">
        {!collapsed ? (
          <div
            className={styles.resizeHandle}
            role="separator"
            aria-orientation="vertical"
            aria-valuenow={width}
            aria-valuemin={WIDTH_MIN}
            aria-valuemax={WIDTH_MAX}
            aria-label="Resize inspector"
            onPointerDown={onResizePointerDown}
            onPointerMove={onResizePointerMove}
            onPointerUp={onResizePointerUp}
            onPointerCancel={onResizePointerUp}
          />
        ) : null}

        <div className={styles.rightFrame}>
          {collapsed ? (
            <div className={styles.collapsedRail}>
              <GhostButton
                size="xs"
                className={styles.collapsedButton}
                title="Expand inspector"
                aria-expanded={false}
                aria-controls="project-right-inspector"
                onClick={() => setCollapsed(false)}
              >
                <PanelRightOpen className="h-4 w-4" />
              </GhostButton>
            </div>
          ) : (
            <div className={styles.rightChrome}>
              <span className={styles.rightChromeLabel}>
                <PanelRight className="h-3.5 w-3.5" />
                Inspector
              </span>
              <GhostButton
                size="xs"
                title="Collapse inspector"
                aria-expanded={true}
                aria-controls="project-right-inspector"
                onClick={() => setCollapsed(true)}
              >
                <PanelRightClose className="h-3.5 w-3.5" />
              </GhostButton>
            </div>
          )}

          <div
            id="project-right-inspector"
            className={collapsed ? styles.hiddenInspector : styles.rightContent}
            aria-hidden={collapsed}
          >
            {rightSidebar}
          </div>
        </div>
      </aside>
    </div>
  );
}
