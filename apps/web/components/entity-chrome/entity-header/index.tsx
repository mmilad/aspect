import { EntityBadges } from "../../ui";
import type { EntityPreview } from "../../../lib/entity-preview";

interface EntityHeaderProps {
  entity: EntityPreview;
  extras?: Array<string | null | undefined>;
  showPath?: boolean;
  showSummary?: boolean;
  titleClassName?: string;
  summaryClassName?: string;
}

export function EntityHeader({
  entity,
  extras,
  showPath = true,
  showSummary = true,
  titleClassName = "mt-3 text-2xl font-semibold tracking-tight text-zinc-950",
  summaryClassName = "mt-2 text-sm leading-6 text-muted-foreground"
}: EntityHeaderProps) {
  return (
    <>
      <EntityBadges type={entity.type} status={entity.status} entityKey={entity.key} extras={extras} />
      <h1 className={titleClassName}>{entity.title}</h1>
      {showPath && entity.path ? (
        <div className="mt-2 truncate rounded-md border border-border bg-background px-2 py-1 font-mono text-xs text-muted-foreground">
          {entity.path}
        </div>
      ) : null}
      {showSummary && entity.summary ? <p className={summaryClassName}>{entity.summary}</p> : null}
    </>
  );
}
