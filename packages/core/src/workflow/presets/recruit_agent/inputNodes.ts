import { identityBindings } from "../bindings";
import type { WorkflowGraph } from "../../graph";
import { STRING, NUMBER, RESULTS } from "./shapes";
export const inputNodes: WorkflowGraph["nodes"] = [
{
            id: "start",
            type: "start",
            position: {
                x: 40,
                y: 160
            },
            data: {
                title: "Recruit agent",
                writes: [
                    "role", "query", "instructions", "maxResults"
                ],
                writeBindings: identityBindings([
                    "role", "query", "instructions", "maxResults"
                ]),
                outputContracts: {
                    role: {
                        required: false,
                        shape: STRING
                    },
                    query: {
                        required: false,
                        shape: STRING
                    },
                    instructions: {
                        required: false,
                        shape: STRING
                    },
                    maxResults: {
                        required: false,
                        shape: NUMBER
                    }
                }
            }
        },
{
            id: "normalize_input",
            type: "transform",
            position: {
                x: 260,
                y: 160
            },
            data: {
                title: "Normalize role/query",
                reads: [
                    "role", "query"
                ],
                inputs: {
                    role: {
                        required: false,
                        shape: STRING
                    },
                    query: {
                        required: false,
                        shape: STRING
                    }
                },
                writes: [
                    "query"
                ],
                writeBindings: identityBindings([
                    "query"
                ]),
                outputContracts: {
                    query: {
                        required: true,
                        shape: STRING
                    }
                },
                auto: {
                    assign: {
                        coalesce: {
                            from: [
                                "query", "role"
                            ]
                        }
                    }
                }
            }
        },
{
            id: "research",
            type: "web_search",
            position: {
                x: 500,
                y: 160
            },
            data: {
                title: "Research role responsibilities",
                reads: [
                    "query", "maxResults"
                ],
                inputs: {
                    query: {
                        required: true,
                        shape: STRING
                    },
                    maxResults: {
                        required: false,
                        shape: NUMBER
                    }
                },
                writes: [
                    "results"
                ],
                writeBindings: identityBindings([
                    "results"
                ]),
                outputContracts: {
                    results: {
                        required: true,
                        shape: RESULTS
                    }
                },
                webSearch: {}
            }
        }
];
