import { identityBindings } from "../bindings";
import type { WorkflowGraph } from "../../graph";
import { AGENT_PROFILE_V1_KEY } from "../../llm/llm-json-schemas";
import { STRING, RESULTS } from "./shapes";
export const profileNodes: WorkflowGraph["nodes"] = [
{
            id: "summarize",
            type: "llm",
            position: {
                x: 600,
                y: 160
            },
            data: {
                title: "Extract responsibilities",
                reads: [
                    "query", "instructions", "results"
                ],
                inputs: {
                    query: {
                        required: true,
                        shape: STRING
                    },
                    instructions: {
                        required: false,
                        shape: STRING
                    },
                    results: {
                        required: true,
                        shape: RESULTS
                    }
                },
                writes: [
                    "responsibilities"
                ],
                writeBindings: identityBindings([
                    "responsibilities"
                ]),
                outputContracts: {
                    responsibilities: {
                        required: true,
                        shape: STRING
                    }
                },
                llm: {
                    format: "text",
                    outputSchema: [
                        "responsibilities"
                    ],
                    instructions: "Based on the search results, summarize the role's core responsibilities and recurring activities for designing an agent. Role/query: {{query}}. Additional instructions: {{instructions}}. Search results: {{results}}"
                }
            }
        },
{
            id: "profile",
            type: "llm",
            position: {
                x: 900,
                y: 160
            },
            data: {
                title: "Build agent profile",
                reads: [
                    "query", "instructions", "results", "responsibilities"
                ],
                inputs: {
                    query: {
                        required: true,
                        shape: STRING
                    },
                    instructions: {
                        required: false,
                        shape: STRING
                    },
                    results: {
                        required: true,
                        shape: RESULTS
                    },
                    responsibilities: {
                        required: true,
                        shape: STRING
                    }
                },
                writes: [
                    "profile"
                ],
                writeBindings: identityBindings([
                    "profile"
                ]),
                outputContracts: {
                    profile: {
                        required: true,
                        shape: {
                            kind: "any"
                        }
                    }
                },
                llm: {
                    schemaKey: AGENT_PROFILE_V1_KEY,
                    outputSchema: [
                        "profile"
                    ],
                    instructions: "Create a structured agent profile. Role: {{query}}. Instructions: {{instructions}}. Summary: {{responsibilities}}. Sources: {{results}}"
                }
            }
        },
{
            id: "persist",
            type: "write",
            position: {
                x: 1200,
                y: 160
            },
            data: {
                title: "Persist agent profile",
                reads: [
                    "query", "profile"
                ],
                inputs: {
                    query: {
                        required: true,
                        shape: STRING
                    },
                    profile: {
                        required: true,
                        shape: {
                            kind: "any"
                        }
                    }
                },
                writes: [
                    "agentId"
                ],
                writeBindings: identityBindings([
                    "agentId"
                ]),
                outputContracts: {
                    agentId: {
                        required: true,
                        shape: STRING
                    }
                },
                write: {
                    action: "create_entity",
                    argsFromBag: {
                        title: "query",
                        document: "profile"
                    },
                    defaults: {
                        type: "agent",
                        status: "planned",
                        kind: "agent_profile",
                        resultAs: "agentId",
                        reason: "Recruit agent profile from role research"
                    }
                }
            }
        }
];
