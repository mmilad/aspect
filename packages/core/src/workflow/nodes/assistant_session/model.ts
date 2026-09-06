import type { BagShape } from "../_shared/types";
import type { WorkflowNodeModel } from "../_shared/model";
import { executeAssistantSession } from "./execute";
import { parseAssistantSessionNodeConfig } from "./schema";

const JSON_SHAPE: BagShape = { kind: "any" };
const JSON_ARRAY: BagShape = { kind: "array", items: JSON_SHAPE };
const NUMBER: BagShape = { kind: "primitive", type: "number" };

export const assistantSessionNode: WorkflowNodeModel = {
  type: "assistant_session",
  kind: "work",
  description: "Unpacks the current assistant session into standing state and transcript views.",
  defaultData: () => ({
    title: "Session read",
    inputs: {
      session: { required: true, shape: JSON_SHAPE },
      windowSize: { required: false, shape: NUMBER }
    },
    outputContracts: {
      priorSummary: { required: false, shape: JSON_SHAPE },
      priorTopics: { required: true, shape: JSON_ARRAY },
      priorQuestions: { required: true, shape: JSON_ARRAY },
      priorContext: { required: true, shape: JSON_SHAPE },
      allTurns: { required: true, shape: JSON_ARRAY },
      recentTurns: { required: true, shape: JSON_ARRAY }
    }
  }),
  parseConfig: parseAssistantSessionNodeConfig,
  execute: executeAssistantSession,
  execInputDescriptions: () => ({
    in: "Read current assistant session state."
  }),
  execOutputDescriptions: () => ({
    then: "Continue with prior snapshot and transcript pins."
  }),
  dataInputs: () => ["session", "windowSize"],
  dataOutputs: () => ["priorSummary", "priorTopics", "priorQuestions", "priorContext", "allTurns", "recentTurns"],
  canvasFields: () => [{ label: "session", value: "prior + turns" }]
};
