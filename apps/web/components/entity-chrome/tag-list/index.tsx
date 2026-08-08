import type { Tag } from "@projectplaner/core";
import { Badge } from "../../ui";
import { cn } from "../../../lib/utils";

interface TagListProps {
  tags: Tag[];
  compact?: boolean;
  empty?: string | null;
  className?: string;
}

export function TagList({ tags, compact = false, empty = "No tags.", className }: TagListProps) {
  if (tags.length === 0) {
    return compact || empty === null ? null : <p className="text-sm text-muted-foreground">{empty}</p>;
  }

  return (
    <div className={cn("flex flex-wrap gap-1", className)}>
      {tags.map((tag) => (
        <Badge key={tag.id}>{tag.label}</Badge>
      ))}
    </div>
  );
}
