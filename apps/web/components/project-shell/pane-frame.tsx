import type { ReactNode } from "react";
import { cn } from "../../lib/utils";

export function PaneFrame({
  header,
  footer,
  children,
  className
}: {
  header?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex h-full min-h-0 flex-col", className)}>
      {header}
      <div className="min-h-0 flex-1 overflow-hidden">{children}</div>
      {footer}
    </div>
  );
}
