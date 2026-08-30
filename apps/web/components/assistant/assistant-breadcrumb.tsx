"use client";

import { Fragment } from "react";
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
            const key = `${frame.key}:${frame.itemId ?? ""}:${index}`;
            return (
              <Fragment key={key}>
                {index > 0 ? <BreadcrumbSeparator /> : null}
                <BreadcrumbItem>
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
              </Fragment>
            );
          })}
        </BreadcrumbList>
      </Breadcrumb>
    </div>
  );
}
