import type { WorkflowPreset } from "../types";
import { nextWorkGraph } from "./graph";

export const nextWorkPreset: WorkflowPreset = {
  presetKey: "next_work",
  presetVersion: 3,
  title: "Next work",
  summary: "Rank eligible open tasks by work score into bag.candidates.",
  body: [
    "Pick the next eligible task candidates from the living graph.",
    "Outputs: candidates[] (RankedTaskCandidate), hasCandidates (boolean).",
    "Rank node uses port contracts + identity inputBindings/writeBindings.",
    "Agents may still call MCP next_work for a ranked pick; this pack is the workflow-shaped equivalent.",
    "Refresh seeded DB with: pnpm plan presets-ensure --force"
  ].join("\n"),
  status: "accepted",
  kind: "housekeeping",
  graph: nextWorkGraph
};
