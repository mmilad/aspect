import type { BagShape } from "@projectplaner/core";
import workflow from "@projectplaner/core/workflow";

const { listShapePaths } = workflow.bag;

export function pathOptionsForKey(view: Record<string, BagShape>, key: string): string[] {
  return listShapePaths(view[key]);
}
