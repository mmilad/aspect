import type { JsonRecord } from "@projectplaner/core";
import { MetadataBlock } from "../entity-chrome";

export function MetadataTab({ metadata }: { metadata: JsonRecord }) {
  return <MetadataBlock metadata={metadata} />;
}
