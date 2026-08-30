export * from "./assemble";

import { assembleFromStepDrafts, assembleWorkflowFragment } from "./assemble";

const assemble = {
  fragment: assembleWorkflowFragment,
  fromStepDrafts: assembleFromStepDrafts,
  assembleWorkflowFragment,
  assembleFromStepDrafts
};

export default assemble;
