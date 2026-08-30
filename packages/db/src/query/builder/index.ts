export * from "./builder";
export * from "./conditions";
export * from "./types";

import * as builderFns from "./builder";
import * as conditionFns from "./conditions";

const builder = {
  ...builderFns,
  ...conditionFns
};

export default builder;
