import type { ReactNode } from "react";
import styles from "./style.module.css";

interface WorkspaceCenterProps {
  children: ReactNode;
  scroll?: boolean;
}

export function WorkspaceCenter({ children, scroll = false }: WorkspaceCenterProps) {
  return <div className={scroll ? styles.scroll : styles.center}>{children}</div>;
}
