import type { JsonRecord } from "@projectplaner/core";

interface MetadataBlockProps {
  metadata: JsonRecord;
  className?: string;
}

export function MetadataBlock({
  metadata,
  className = "overflow-auto rounded-md border border-border bg-zinc-950 px-3 py-3 text-xs leading-5 text-zinc-100"
}: MetadataBlockProps) {
  return <pre className={className}>{JSON.stringify(metadata, null, 2)}</pre>;
}
