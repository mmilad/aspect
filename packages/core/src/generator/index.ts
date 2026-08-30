/**
 * Generator workspace: convert Projectplaner data into reason/meaning artifacts
 * (playbook prompts, runnable workflow steps, and later feature/task prompts).
 */
export * from "./workflow";
export * from "./views";
export * from "./author";

import author from "./author";
import compile from "./workflow";
import views from "./views";

const generator = {
  author,
  views,
  compile
};

export default generator;
