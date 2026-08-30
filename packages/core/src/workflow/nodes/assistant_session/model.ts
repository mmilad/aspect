import type { BagShape } from "../_shared/types";
import type { WorkflowNodeModel } from "../_shared/model";
import { executeAssistantSession } from "./execute";
import { parseAssistantSessionNodeConfig } from "./schema";

const JSON_SHAPE: BagShape = { kind: "any" };
const JSON_ARRAY: BagShape = { kind: "array", items: JSON_SHAPE };

export const assistantSessionNode: WorkflowNodeModel = {
  type: "assistant_session",
  kind: "work",
  description: "Unpacks the current assistant session as prior standing fields.",
  defaultData: () => ({
    title: "Session read",
    inputs: {
      session: { required: true, shape: JSON_SHAPE }
    },
    outputContracts: {
      priorSummary: { required: false, shape: JSON_SHAPE },
      priorTopics: { required: true, shape: JSON_ARRAY },
      priorQuestions: { required: true, shape: JSON_ARRAY },
      priorContext: { required: true, shape: JSON_SHAPE }
    }
  }),
  parseConfig: parseAssistantSessionNodeConfig,
  execute: executeAssistantSession,
  execInputDescriptions: () => ({
    in: "Read current session standing data."
  }),
  execOutputDescriptions: () => ({
    then: "Continue with prior snapshot pins."
  }),
  dataInputs: () => ["session"],
  dataOutputs: () => ["priorSummary", "priorTopics", "priorQuestions", "priorContext"],
  canvasFields: () => [{ label: "session", value: "prior*" }]
};
