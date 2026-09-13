import { ASSISTANT_CONTEXT_V2_KEY, ASSISTANT_ROUTE_V1_KEY } from "../../llm/llm-json-schemas";
import { serializeAssistantRoleManifest } from "../../../assistant";
import { WORKFLOW_SCHEMA_VERSION, type BagShape, type WorkflowNode, type WorkflowQueryConfig } from "../../nodes";
import type { WorkflowEdge, WorkflowGraph } from "../../graph";

const STRING: BagShape = { kind: "primitive", type: "string" };
const NUMBER: BagShape = { kind: "primitive", type: "number" };
const ANY: BagShape = { kind: "any" };
const NULL: BagShape = { kind: "primitive", type: "null" };
const nullable = (shape: BagShape): BagShape => ({ kind: "union", options: [shape, NULL] });
const arrayOf = (items: BagShape): BagShape => ({ kind: "array", items });
const object = (fields: Record<string, BagShape>, requiredFields?: string[]): BagShape => ({
  kind: "object", fields, ...(requiredFields ? { requiredFields } : {})
});
const FILE_ENTRIES: BagShape = arrayOf(object({
  path: STRING,
  kind: STRING,
  bytes: nullable(NUMBER)
}));

const CONTEXT_PACK: BagShape = object({
  summary: object({ text: STRING }, ["text"]),
  topics: arrayOf(object({ id: STRING, title: STRING, status: STRING, weight: NUMBER }, ["id", "title", "status", "weight"])),
  questions: arrayOf(object({ id: STRING, text: STRING, status: STRING }, ["id", "text", "status"])),
  context: object({ projectKey: STRING, flowId: STRING, nodeId: STRING, entityId: STRING }, ["projectKey"])
}, ["summary", "topics", "questions", "context"]);
const LOOKUP: BagShape = nullable(object({ kind: STRING, query: nullable(STRING), id: nullable(STRING) }, ["kind", "query", "id"]));
const ROUTE: BagShape = object({
  route: STRING, reason: STRING, question: nullable(STRING), lookup: LOOKUP,
  lookupKind: nullable(STRING), lookupQuery: nullable(STRING), lookupId: nullable(STRING),
  agentId: nullable(STRING), task: nullable(STRING), runId: nullable(STRING), message: nullable(STRING)
}, ["route", "reason"]);

function data(id: string, source: string, sourcePin: string, target: string, targetPin: string): WorkflowEdge {
  return { id, source, target, kind: "data", sourcePin, targetPin };
}
function next(id: string, source: string, target: string): WorkflowEdge {
  return { id, source, target, kind: "next", sourcePin: "then", targetPin: "in" };
}
function route(id: string, source: string, target: string, label: string): WorkflowEdge {
  return { id, source, target, kind: "route", sourcePin: label, targetPin: "in", label };
}
function queryNode(id: string, title: string, y: number, query: WorkflowQueryConfig, outputPin: string, outputKey: string): WorkflowNode {
  return { id, type: "query", position: { x: 1420, y }, data: { title, query, writeBindings: { [outputPin]: outputKey } } };
}

function knowledgeNode(): WorkflowNode {
  return {
    id: "search_knowledge",
    type: "knowledge_search",
    position: { x: 1420, y: 680 },
    data: {
      title: "Search project knowledge",
      inputs: {
        datasetKey: { required: false, shape: STRING },
        query: { required: true, shape: STRING }
      },
      outputContracts: {
        hits: { required: true, shape: arrayOf(ANY) },
        query: { required: true, shape: STRING },
        embeddingModel: { required: true, shape: nullable(STRING) },
        totalSearched: { required: true, shape: NUMBER },
        searchMode: { required: true, shape: STRING }
      },
      knowledgeSearch: {}
    }
  };
}

function knowledgeContextIndexNode(): WorkflowNode {
  return {
    id: "knowledge_context_index",
    type: "knowledge_context_index",
    position: { x: 1420, y: 780 },
    data: {
      title: "Read knowledge catalog",
      outputContracts: {
        datasets: { required: true, shape: arrayOf(ANY) },
        tools: { required: true, shape: arrayOf(ANY) },
        relationshipCount: { required: true, shape: NUMBER },
        usageHint: { required: true, shape: STRING }
      },
      knowledgeContextIndex: {}
    }
  };
}

function fileListNode(): WorkflowNode {
  return {
    id: "list_files",
    type: "file_list",
    position: { x: 1420, y: 780 },
    data: {
      title: "List workspace files",
      inputs: { path: { required: false, shape: STRING } },
      outputContracts: { entries: { required: true, shape: FILE_ENTRIES } },
      fileList: {}
    }
  };
}

function fileReadNode(): WorkflowNode {
  return {
    id: "read_file",
    type: "file_read",
    position: { x: 1420, y: 880 },
    data: {
      title: "Read workspace file",
      inputs: { path: { required: true, shape: STRING } },
      outputContracts: {
        path: { required: true, shape: STRING },
        content: { required: true, shape: STRING },
        bytes: { required: true, shape: NUMBER },
        truncated: { required: true, shape: { kind: "primitive", type: "boolean" } },
        encoding: { required: true, shape: STRING }
      },
      fileRead: {}
    }
  };
}

const retrievalQueries: WorkflowNode[] = [
  queryNode("list_agents", "List active agents", 80, { op: "list", type: "agent", select: "full", limit: 50 }, "entities", "agentFacts"),
  queryNode("get_agent", "Get agent", 180, { op: "get", type: "agent", select: "full", slots: [{ id: "id", slot: "id", source: "pin" }] }, "entity", "agentFact"),
  queryNode("search_entities", "Search entities", 280, { op: "search", select: "compact", limit: 20, slots: [{ id: "q", slot: "q", source: "pin" }] }, "matches", "entityMatches"),
  queryNode("get_entity", "Get entity", 380, { op: "get", select: "full", slots: [{ id: "id", slot: "id", source: "pin" }] }, "entity", "entityFact"),
  queryNode("list_workflows", "List workflows", 480, { op: "list", type: "flow", select: "full", limit: 50 }, "entities", "workflowFacts"),
  queryNode("neighborhood", "Load neighborhood", 580, { op: "neighborhood", depth: 1, select: "compact", slots: [{ id: "id", slot: "id", source: "pin" }] }, "entities", "neighborhoodEntities"),
  knowledgeNode(),
  knowledgeContextIndexNode(),
  fileListNode(),
  fileReadNode()
];

const TURN_A_SYSTEM = [
  "Build the durable standing context for this Assistant turn.",
  "Use only prior session data, the conversation, and supplied facts. Never invent facts, ids, capabilities, actions, or outcomes.",
  "Rewrite the full topic and question lists; park omitted topics and mark answered questions instead of deleting them.",
  "Return JSON matching assistant_context_v2."
].join(" ");
const TURN_A_INSTRUCTIONS = [
  "Prior summary: {{priorSummary}}", "Prior topics: {{priorTopics}}", "Prior questions: {{priorQuestions}}",
  "Prior context: {{priorContext}}", "Recent turns: {{recentTurns}}", "User message: {{message}}"
].join("\n");
const DECISION_SYSTEM = [
  "You are the routing controller for a truthful, useful Projectplaner Assistant.",
  `Assistant role manifest (assistant_role_v1): ${serializeAssistantRoleManifest()}`,
  "The role manifest describes your authority, not project facts. Treat agentFacts as the evidence for which active agents exist, bounded file results as workspace evidence, knowledgeHits as searchable memory evidence, and delegation results as the evidence for work performed.",
  "Use only the durable context, current message, retrieved facts, delegation results, and confirmed runtime state.",
  "Never invent facts, agents, capabilities, entities, actions, sources, or outcomes.",
  "Choose reply when evidence is sufficient, clarify when one focused question is needed, retrieve when a listed read lookup is needed, delegate only to a known registered specialist, and resume only the pending run.",
  "Return JSON matching assistant_route_v1."
].join(" ");
const DECISION_INSTRUCTIONS = [
  "Durable context pack: {{contextPack}}", "Pending delegation: {{pendingDelegation}}", "Agents: {{agentFacts}}",
  "Selected agent: {{agentFact}}", "Entity matches: {{entityMatches}}", "Selected entity: {{entityFact}}", "Workspace file entries: {{fileEntries}}", "Workspace file path: {{filePath}}", "Workspace file content: {{fileContent}}", "Knowledge catalog: {{knowledgeCatalog}}", "Knowledge hits: {{knowledgeHits}}",
  "Workflows: {{workflowFacts}}", "Neighborhood entities: {{neighborhoodEntities}}", "Neighborhood relations: {{neighborhoodRelations}}",
  "Delegation result: {{delegation}}", "User message: {{message}}"
].join("\n");
const REPLY_SYSTEM = [
  "You are the user's direct Projectplaner Assistant.",
  `Assistant role manifest (assistant_role_v1): ${serializeAssistantRoleManifest()}`,
  "The role manifest describes your authority, not project facts. Treat retrieved agent facts as the evidence for which agents exist, bounded file results as workspace evidence, knowledge search hits as searchable memory evidence, and confirmed delegation results as the evidence for work performed.",
  "Be useful, concise, truthful, and transparent. Use only the supplied context, retrieved facts, and confirmed delegation result.",
  "Do not claim an agent was contacted, a workflow ran, or a write completed unless the runtime result explicitly confirms it.",
  "If the route is clarify, ask exactly the focused question supplied by the controller.",
  "If information is unavailable, say so plainly. Plain text only."
].join(" ");
const REPLY_INSTRUCTIONS = [
  "Route: {{route}}", "Route reason: {{reason}}", "Clarifying question: {{question}}", "Context pack: {{contextPack}}",
  "Retrieved agents: {{agentFacts}}", "Retrieved agent: {{agentFact}}", "Retrieved entity matches: {{entityMatches}}", "Workspace file entries: {{fileEntries}}", "Workspace file path: {{filePath}}", "Workspace file content: {{fileContent}}", "Knowledge catalog: {{knowledgeCatalog}}", "Retrieved knowledge: {{knowledgeHits}}",
  "Retrieved entity: {{entityFact}}", "Retrieved workflows: {{workflowFacts}}", "Neighborhood: {{neighborhoodEntities}} {{neighborhoodRelations}}",
  "Delegation result: {{delegation}}", "Delegation status: {{delegationStatus}}", "Delegation question: {{delegationQuestion}}",
  "Delegation error: {{delegationError}}", "User message: {{message}}"
].join("\n");

export const assistantTurnGraph: WorkflowGraph = {
  version: WORKFLOW_SCHEMA_VERSION,
  variables: [
    { name: "session", role: "input", shape: ANY, required: true },
    { name: "message", role: "input", shape: STRING, required: true },
    { name: "windowSize", role: "input", shape: NUMBER, required: false },
    { name: "projectKey", role: "input", shape: STRING, required: false },
    { name: "knowledgeDataset", role: "input", shape: STRING, required: false },
    { name: "knowledgeAccess", role: "input", shape: ANY, required: false },
    { name: "pendingDelegation", role: "input", shape: ANY, required: false },
    { name: "contextPack", role: "output", shape: CONTEXT_PACK, required: true },
    { name: "reply", role: "output", shape: STRING, required: true },
    { name: "pendingDelegationOut", role: "output", shape: ANY, required: false }
  ],
  nodes: [
    { id: "start", type: "start", position: { x: 40, y: 360 }, data: { title: "Start" } },
    { id: "session_read", type: "assistant_session", position: { x: 300, y: 360 }, data: {
      title: "Session read", inputs: { session: { required: true, shape: ANY }, windowSize: { required: false, shape: NUMBER } },
      outputContracts: {
        priorSummary: { required: false, shape: ANY }, priorTopics: { required: true, shape: arrayOf(ANY) }, priorQuestions: { required: true, shape: arrayOf(ANY) },
        priorContext: { required: true, shape: ANY }, allTurns: { required: true, shape: arrayOf(ANY) }, recentTurns: { required: true, shape: arrayOf(ANY) }
      }
    } },
    { id: "llm_context", type: "llm", position: { x: 620, y: 360 }, data: {
      title: "Build durable context pack",
      inputs: { priorSummary: { required: false, shape: ANY }, priorTopics: { required: true, shape: arrayOf(ANY) }, priorQuestions: { required: true, shape: arrayOf(ANY) }, priorContext: { required: true, shape: ANY }, recentTurns: { required: true, shape: arrayOf(ANY) }, message: { required: true, shape: STRING } },
      outputContracts: { contextPack: { required: true, shape: CONTEXT_PACK } },
      llm: { schemaKey: ASSISTANT_CONTEXT_V2_KEY, outputSchema: ["contextPack"], systemPrompt: TURN_A_SYSTEM, instructions: TURN_A_INSTRUCTIONS }
    } },
    { id: "llm_decide", type: "llm", position: { x: 980, y: 360 }, data: {
      title: "Assistant decision", executionPolicy: { maxVisits: 5, onExhausted: "fail_run" },
      inputs: {
        contextPack: { required: true, shape: CONTEXT_PACK }, message: { required: true, shape: STRING }, pendingDelegation: { required: false, shape: ANY },
        agentFacts: { required: false, shape: ANY }, agentFact: { required: false, shape: ANY }, entityMatches: { required: false, shape: ANY }, entityFact: { required: false, shape: ANY }, workflowFacts: { required: false, shape: ANY }, neighborhoodEntities: { required: false, shape: ANY }, neighborhoodRelations: { required: false, shape: ANY }, fileEntries: { required: false, shape: FILE_ENTRIES }, filePath: { required: false, shape: STRING }, fileContent: { required: false, shape: STRING }, knowledgeCatalog: { required: false, shape: ANY }, knowledgeHits: { required: false, shape: arrayOf(ANY) }, delegation: { required: false, shape: ANY }
      },
      outputContracts: { decision: { required: true, shape: ROUTE } },
      llm: { schemaKey: ASSISTANT_ROUTE_V1_KEY, outputSchema: ["decision"], systemPrompt: DECISION_SYSTEM, instructions: DECISION_INSTRUCTIONS }
    } },
    { id: "break_decision", type: "break", position: { x: 1240, y: 360 }, data: { title: "Break route", break: { from: "decision" } } },
    { id: "decision_switch", type: "switch", position: { x: 1480, y: 360 }, data: { title: "Route", switch: { on: "route", cases: ["reply", "clarify", "retrieve", "delegate", "resume"], defaultLabel: "default" } } },
    { id: "lookup_switch", type: "switch", position: { x: 1730, y: 360 }, data: { title: "Read lookup", switch: { on: "lookupKind", cases: ["agents", "agent", "entities", "entity", "workflows", "neighborhood", "knowledge_catalog", "knowledge", "files", "file"], defaultLabel: "default" } } },
    ...retrievalQueries,
    { id: "delegate", type: "delegate", position: { x: 1730, y: 980 }, data: { title: "Delegate / resume" } },
    { id: "llm_reply", type: "llm", position: { x: 2080, y: 360 }, data: {
      title: "Generate grounded answer",
      inputs: {
        route: { required: true, shape: STRING }, reason: { required: true, shape: STRING }, question: { required: false, shape: nullable(STRING) }, contextPack: { required: true, shape: CONTEXT_PACK }, message: { required: true, shape: STRING },
        agentFacts: { required: false, shape: ANY }, agentFact: { required: false, shape: ANY }, entityMatches: { required: false, shape: ANY }, entityFact: { required: false, shape: ANY }, workflowFacts: { required: false, shape: ANY }, neighborhoodEntities: { required: false, shape: ANY }, neighborhoodRelations: { required: false, shape: ANY }, fileEntries: { required: false, shape: FILE_ENTRIES }, filePath: { required: false, shape: STRING }, fileContent: { required: false, shape: STRING }, knowledgeCatalog: { required: false, shape: ANY }, knowledgeHits: { required: false, shape: arrayOf(ANY) }, delegation: { required: false, shape: ANY }, delegationStatus: { required: false, shape: STRING }, delegationQuestion: { required: false, shape: ANY }, delegationError: { required: false, shape: ANY }
      },
      outputContracts: { reply: { required: true, shape: STRING } }, llm: { format: "text", outputSchema: ["reply"], systemPrompt: REPLY_SYSTEM, instructions: REPLY_INSTRUCTIONS }
    } },
    { id: "end", type: "end", position: { x: 2360, y: 360 }, data: { title: "End" } }
  ],
  edges: [
    next("e_start_session", "start", "session_read"), next("e_session_context", "session_read", "llm_context"), next("e_context_agents", "llm_context", "list_agents"), next("e_agents_decision", "list_agents", "llm_decide"), next("e_decision_switch", "llm_decide", "decision_switch"), next("e_delegate_reply", "delegate", "llm_reply"), next("e_reply_end", "llm_reply", "end"),
    route("r_reply", "decision_switch", "llm_reply", "reply"), route("r_clarify", "decision_switch", "llm_reply", "clarify"), route("r_retrieve", "decision_switch", "lookup_switch", "retrieve"), route("r_delegate", "decision_switch", "delegate", "delegate"), route("r_resume", "decision_switch", "delegate", "resume"), route("r_decision_default", "decision_switch", "llm_reply", "default"),
    route("r_lookup_agents", "lookup_switch", "list_agents", "agents"), route("r_lookup_agent", "lookup_switch", "get_agent", "agent"), route("r_lookup_entities", "lookup_switch", "search_entities", "entities"), route("r_lookup_entity", "lookup_switch", "get_entity", "entity"), route("r_lookup_workflows", "lookup_switch", "list_workflows", "workflows"), route("r_lookup_neighborhood", "lookup_switch", "neighborhood", "neighborhood"), route("r_lookup_knowledge_catalog", "lookup_switch", "knowledge_context_index", "knowledge_catalog"), route("r_lookup_knowledge", "lookup_switch", "search_knowledge", "knowledge"), route("r_lookup_files", "lookup_switch", "list_files", "files"), route("r_lookup_file", "lookup_switch", "read_file", "file"), route("r_lookup_default", "lookup_switch", "llm_decide", "default"),
    ...retrievalQueries.map((node, index) => next(`e_query_${index}`, node.id, "llm_decide")),
    data("d_start_session", "start", "session", "session_read", "session"), data("d_start_window", "start", "windowSize", "session_read", "windowSize"), data("d_start_knowledge_dataset", "start", "knowledgeDataset", "search_knowledge", "datasetKey"), data("d_start_knowledge_access", "start", "knowledgeAccess", "search_knowledge", "access"),
    data("d_session_summary", "session_read", "priorSummary", "llm_context", "priorSummary"), data("d_session_topics", "session_read", "priorTopics", "llm_context", "priorTopics"), data("d_session_questions", "session_read", "priorQuestions", "llm_context", "priorQuestions"), data("d_session_context", "session_read", "priorContext", "llm_context", "priorContext"), data("d_session_recent", "session_read", "recentTurns", "llm_context", "recentTurns"),
    data("d_context_decision", "llm_context", "contextPack", "llm_decide", "contextPack"), data("d_agents_decision", "list_agents", "entities", "llm_decide", "agentFacts"), data("d_agents_reply", "list_agents", "entities", "llm_reply", "agentFacts"), data("d_file_entries_decision", "list_files", "entries", "llm_decide", "fileEntries"), data("d_file_entries_reply", "list_files", "entries", "llm_reply", "fileEntries"), data("d_file_path", "read_file", "path", "llm_decide", "filePath"), data("d_file_content_decision", "read_file", "content", "llm_decide", "fileContent"), data("d_file_path_reply", "read_file", "path", "llm_reply", "filePath"), data("d_file_content_reply", "read_file", "content", "llm_reply", "fileContent"), data("d_knowledge_catalog_decision", "knowledge_context_index", "datasets", "llm_decide", "knowledgeCatalog"), data("d_knowledge_catalog_reply", "knowledge_context_index", "datasets", "llm_reply", "knowledgeCatalog"), data("d_knowledge_decision", "search_knowledge", "hits", "llm_decide", "knowledgeHits"), data("d_knowledge_reply", "search_knowledge", "hits", "llm_reply", "knowledgeHits"), data("d_decision_break", "llm_decide", "decision", "break_decision", "value"), data("d_context_reply", "llm_context", "contextPack", "llm_reply", "contextPack"), data("d_context_end", "llm_context", "contextPack", "end", "contextPack"),
    data("d_start_message_context", "start", "message", "llm_context", "message"), data("d_start_message_decision", "start", "message", "llm_decide", "message"), data("d_start_message_reply", "start", "message", "llm_reply", "message"), data("d_start_pending_decision", "start", "pendingDelegation", "llm_decide", "pendingDelegation"),
    data("d_break_route", "break_decision", "route", "decision_switch", "route"), data("d_break_kind", "break_decision", "lookupKind", "lookup_switch", "lookupKind"), data("d_break_query_search", "break_decision", "lookupQuery", "search_entities", "q"), data("d_break_query_knowledge", "break_decision", "lookupQuery", "search_knowledge", "query"), data("d_break_query_files", "break_decision", "lookupQuery", "list_files", "path"), data("d_break_id_agent", "break_decision", "lookupId", "get_agent", "id"), data("d_break_id_entity", "break_decision", "lookupId", "get_entity", "id"), data("d_break_id_neighborhood", "break_decision", "lookupId", "neighborhood", "id"), data("d_break_id_file", "break_decision", "lookupId", "read_file", "path"), data("d_break_agent", "break_decision", "agentId", "delegate", "agentId"), data("d_break_task", "break_decision", "task", "delegate", "task"), data("d_break_run", "break_decision", "runId", "delegate", "runId"), data("d_break_message", "break_decision", "message", "delegate", "message"), data("d_start_pending_delegate", "start", "pendingDelegation", "delegate", "pendingDelegation"),
    data("d_break_route_reply", "break_decision", "route", "llm_reply", "route"), data("d_break_reason_reply", "break_decision", "reason", "llm_reply", "reason"), data("d_break_question_reply", "break_decision", "question", "llm_reply", "question"),
    data("d_start_pending_end", "start", "pendingDelegation", "end", "pendingDelegationOut"), data("d_delegate_result_reply", "delegate", "delegation", "llm_reply", "delegation"), data("d_delegate_status_reply", "delegate", "delegationStatus", "llm_reply", "delegationStatus"), data("d_delegate_question_reply", "delegate", "delegationQuestion", "llm_reply", "delegationQuestion"), data("d_delegate_error_reply", "delegate", "delegationError", "llm_reply", "delegationError"), data("d_delegate_pending_end", "delegate", "pendingDelegation", "end", "pendingDelegationOut"), data("d_reply_end", "llm_reply", "reply", "end", "reply")
  ]
};
