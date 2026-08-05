import { Badge } from "./badge";
import { formatEntityType, formatStatus } from "../../lib/entity-label";

export function EntityBadges({
  type,
  status,
  entityKey,
  extras = []
}: {
  type: string;
  status: string;
  entityKey?: string | null;
  extras?: Array<string | null | undefined>;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Badge tone={type}>{formatEntityType(type)}</Badge>
      <Badge>{formatStatus(status)}</Badge>
      {entityKey ? <Badge>{entityKey}</Badge> : null}
      {extras.filter(Boolean).map((item) => (
        <Badge key={item}>{item}</Badge>
      ))}
    </div>
  );
}
