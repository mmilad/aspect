import type { DatabaseSync } from "node:sqlite";
import { sqliteStorage } from "../index";
import { createServices, domainStorage } from "../../../services";
import { SemanticWrites as Writes } from "../../../semantic";
import { ensureWorkflowPresets as ensure } from "../../../presets";
import { createExampleProject as example } from "../../../example-signal-desk";
import { runWorkflow as run, advanceWorkflowRun as advance } from "../../../workflows/execute";
import type { DatabaseController } from "../../../controller";
export { createDatabase } from "../client";
export { EXAMPLE_PROJECT_KEY } from "../../../example-signal-desk";
export const PROTECTED_PROJECT_KEY = "PLAN";
const storage = (db: DatabaseSync) => domainStorage(sqliteStorage(db));
export const ensureWorkflowPresets = (db: DatabaseSync, options?: Parameters<typeof ensure>[1]) => storage(db).transaction(scope => ensure(scope, options));
export const createExampleProject = (db: DatabaseSync) => example(storage(db));
export const runWorkflow = (db: DatabaseSync, input: Parameters<typeof run>[1]) => run(storage(db), input);
export const advanceWorkflowRun = (db: DatabaseSync, input: Parameters<typeof advance>[1]) => advance(storage(db), input);
export class SemanticWrites extends Writes {
  constructor(db: DatabaseSync) { super(createServices(sqliteStorage(db))); }
}
export function testController(db: DatabaseSync): DatabaseController {
  return { ...createServices(sqliteStorage(db)), async shutdown() {} };
}
export default { run: runWorkflow, advance: advanceWorkflowRun };
