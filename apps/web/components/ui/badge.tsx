import { cn } from "../../lib/utils";
import { badgeToneByType } from "../../lib/entity-tones";
import { formatEntityType } from "../../lib/entity-label";

export function Badge({
  children,
  tone,
  className
}: {
  children: React.ReactNode;
  tone?: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center rounded-md px-2 text-xs font-medium",
        tone ? (badgeToneByType[tone] ?? "bg-muted text-muted-foreground") : "bg-muted text-muted-foreground",
        className
      )}
    >
      {children ?? (tone ? formatEntityType(tone) : null)}
    </span>
  );
}
