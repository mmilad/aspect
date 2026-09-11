import type { BagShape } from "../_shared/types";
import type { WorkflowNodeModel } from "../_shared/model";
import { executeWebSearch } from "./execute";
import { parseWebSearchNodeConfig } from "./schema";
const STRING: BagShape = { kind: "primitive", type: "string" }; const NUMBER: BagShape = { kind: "primitive", type: "number" }; const RESULTS: BagShape = { kind: "array", items: { kind: "ref", ref: "Json" } };
export const webSearchNode: WorkflowNodeModel = { type: "web_search", kind: "work", configKey: "webSearch", defaultData: () => ({ title: "Web Search", inputs: { query: { required: true, shape: STRING }, maxResults: { shape: NUMBER } }, outputContracts: { results: { required: true, shape: RESULTS } }, webSearch: {} }), parseConfig: parseWebSearchNodeConfig, execute: executeWebSearch, dataInputs: () => ["query", "maxResults"], dataOutputs: () => ["results"], execInputDescriptions: () => ({ in: "Search the web." }), execOutputDescriptions: () => ({ then: "Continue with the search results." }), canvasFields: () => [{ label: "capability", value: "web.search" }] };
