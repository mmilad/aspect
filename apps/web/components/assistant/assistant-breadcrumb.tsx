"use client";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator
} from "../ui";
import { useRightPane } from "../project-shell/right-pane-context";

export function AssistantBreadcrumb() {
  const { nav, setNav } = useRightPane();
  if (nav.length <= 1) {
    return null;
  }

  return (
    <div className="border-b border-border px-4 py-2">
      <Breadcrumb>
        <BreadcrumbList>
          {nav.map((frame, index) => {
            const last = index === nav.length - 1;
            return (
              <BreadcrumbItem key={`${frame.key}:${frame.itemId ?? ""}:${index}`}>
                {index > 0 ? <BreadcrumbSeparator /> : null}
                {last ? (
                  <BreadcrumbPage>{frame.label}</BreadcrumbPage>
                ) : (
                  <BreadcrumbLink
                    onClick={() => {
                      setNav(nav.slice(0, index + 1));
                    }}
                  >
                    {frame.label}
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
            );
          })}
        </BreadcrumbList>
      </Breadcrumb>
    </div>
  );
}
