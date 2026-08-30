import type { BagShape } from "../_shared/types";
import type { WorkflowNodeModel } from "../_shared/model";
import { executeAssistantWindow } from "./execute";
import { parseAssistantWindowNodeConfig } from "./schema";

const JSON_SHAPE: BagShape = { kind: "any" };
const NUMBER: BagShape = { kind: "primitive", type: "number" };
const TURNS: BagShape = { kind: "array", items: JSON_SHAPE };

export const assistantWindowNode: WorkflowNodeModel = {
  type: "assistant_window",
  kind: "work",
  description: "Slices the last N session messages into recentTurns.",
  defaultData: () => ({
    title: "Window",
    inputs: {
      session: { required: true, shape: JSON_SHAPE },
      windowSize: { required: false, shape: NUMBER }
    },
    outputContracts: {
      recentTurns: { required: true, shape: TURNS }
    }
  }),
  parseConfig: parseAssistantWindowNodeConfig,
  execute: executeAssistantWindow,
  execInputDescriptions: () => ({
    in: "Slice the transcript window."
  }),
  execOutputDescriptions: () => ({
    then: "Continue with recentTurns."
  }),
  dataInputs: () => ["session", "windowSize"],
  dataOutputs: () => ["recentTurns"],
  canvasFields: () => [{ label: "window", value: "last N" }]
};
