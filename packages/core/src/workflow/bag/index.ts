export * from "./shapes";
export * from "./contracts";
export * from "./ports";
export * from "./template";
export * from "./run-inputs";

import {
  inputPortKeys,
  shouldStrictValidateInputs,
  shouldStrictValidateOutputs,
  validateNodeInputs,
  validateNodeOutputs
} from "./contracts";
import {
  derivedReads,
  derivedWrites,
  mapPortValuesToBag,
  normalizeNodePorts,
  pickBagByInputPorts,
  resolveInputBindings,
  resolveWriteBindings
} from "./ports";
import {
  defaultRunInputValue,
  describeRunInput,
  missingRequiredRunInputs,
  seedRunInputBag,
  workflowRunInputs
} from "./run-inputs";
import {
  arrayOfRef,
  bagViewAtNode,
  BAG_SHAPE_CATALOG,
  deriveMapOutputShape,
  inferNodeOutputShapes,
  isRecordShape,
  isShapeAssignable,
  isShapeConnectable,
  listShapePaths,
  nullable,
  parseBagShape,
  parseShapeSlim,
  refShape,
  resolveBagShape,
  serializeBagViewSlim,
  serializeShapeSlim,
  shapeAcceptsNull,
  shapeAtPath,
  shapeMayBeNull,
  slimShapesForReads,
  union,
  validateValueAgainstShape,
  warnShapeMismatches
} from "./shapes";
import { formatBagTemplateValue, renderBagTemplate } from "./template";

const bag = {
  BAG_SHAPE_CATALOG,
  resolveBagShape,
  nullable,
  union,
  shapeAcceptsNull,
  shapeMayBeNull,
  isShapeAssignable,
  isShapeConnectable,
  arrayOfRef,
  refShape,
  listShapePaths,
  shapeAtPath,
  deriveMapOutputShape,
  inferNodeOutputShapes,
  bagViewAtNode,
  warnShapeMismatches,
  serializeShapeSlim,
  parseShapeSlim,
  serializeBagViewSlim,
  slimShapesForReads,
  isRecordShape,
  validateValueAgainstShape,
  parseBagShape,
  inputPortKeys,
  validateNodeInputs,
  validateNodeOutputs,
  shouldStrictValidateInputs,
  shouldStrictValidateOutputs,
  resolveInputBindings,
  resolveWriteBindings,
  derivedReads,
  derivedWrites,
  mapPortValuesToBag,
  pickBagByInputPorts,
  normalizeNodePorts,
  formatBagTemplateValue,
  renderBagTemplate,
  workflowRunInputs,
  defaultRunInputValue,
  seedRunInputBag,
  missingRequiredRunInputs,
  describeRunInput
};

export default bag;
