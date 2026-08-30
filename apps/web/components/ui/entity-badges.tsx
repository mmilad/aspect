import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { formatEntityType, formatStatus } from "../../lib/entity-label";
import { badgeClassForTone } from "../../lib/entity-tones";

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
  const typeLabel = formatEntityType(type || "unknown");
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Badge className={cn("border-transparent text-white hover:opacity-90", badgeClassForTone(type || "reference"))}>
        {typeLabel}
      </Badge>
      <Badge variant="secondary">{formatStatus(status)}</Badge>
      {entityKey ? <Badge variant="outline">{entityKey}</Badge> : null}
      {extras.filter(Boolean).map((item) => (
        <Badge key={item} variant="outline">
          {item}
        </Badge>
      ))}
    </div>
  );
}
