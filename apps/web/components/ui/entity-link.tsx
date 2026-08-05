import Link from "next/link";
import type { Entity } from "@projectplaner/core";
import { projectPaths } from "../../lib/project-paths";
import { formatEntityType } from "../../lib/entity-label";
import { cn } from "../../lib/utils";

type LinkEntity = Pick<Entity, "id" | "type" | "key" | "title">;

export function EntityLink({
  projectKey,
  entity,
  relationType,
  className
}: {
  projectKey: string;
  entity: LinkEntity;
  relationType?: string;
  className?: string;
}) {
  return (
    <Link
      className={cn("font-medium text-teal-800 hover:underline", className)}
      href={projectPaths.entity(projectKey, entity.id)}
    >
      {relationType ? `${relationType} · ` : ""}
      {formatEntityType(entity.type)}
      {entity.key ? ` · ${entity.key}` : ""} · {entity.title}
    </Link>
  );
}
