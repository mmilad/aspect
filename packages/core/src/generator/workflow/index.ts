export {
  compileGraphToIr,
  isCompiledGraphIr
} from "./compile";
export type {
  CompiledFunctionDecl,
  CompiledStep,
  CompiledWorkflow,
  CompileOptions
} from "./types";
export { BUILTIN_FUNCTION_DESCRIPTIONS } from "./types";
export {
  renderWorkflowPrompt,
  type PromptRenderOptions,
  type WorkflowPromptInput
} from "./prompt";

import { compileGraphToIr, isCompiledGraphIr } from "./compile";
import { renderWorkflowPrompt } from "./prompt";
import { BUILTIN_FUNCTION_DESCRIPTIONS } from "./types";

const compile = {
  graphToIr: compileGraphToIr,
  isGraphIr: isCompiledGraphIr,
  compileGraphToIr,
  isCompiledGraphIr,
  renderPrompt: renderWorkflowPrompt,
  renderWorkflowPrompt,
  BUILTIN_FUNCTION_DESCRIPTIONS
};

export default compile;
