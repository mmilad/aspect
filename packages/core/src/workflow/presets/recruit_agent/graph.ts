import type { WorkflowGraph } from "../../graph";
import { WORKFLOW_SCHEMA_VERSION } from "../../nodes";
import { inputNodes } from "./inputNodes";
import { profileNodes } from "./profileNodes";
export const recruitAgentGraph: WorkflowGraph = {
 version: WORKFLOW_SCHEMA_VERSION,
 nodes: [...inputNodes, ...profileNodes, {
            id: "end",
            type: "end",
            position: {
                x: 1500,
                y: 160
            },
            data: {
                title: "Research ready"
            }
        }],
 edges: [
        {
            id: "e_start_normalize",
            source: "start",
            target: "normalize_input",
            kind: "next",
            sourcePin: "then",
            targetPin: "in"
        },
        {
            id: "e_normalize_research",
            source: "normalize_input",
            target: "research",
            kind: "next",
            sourcePin: "then",
            targetPin: "in"
        },
        {
            id: "e_research_summarize",
            source: "research",
            target: "summarize",
            kind: "next",
            sourcePin: "then",
            targetPin: "in"
        },
        {
            id: "e_summarize_profile",
            source: "summarize",
            target: "profile",
            kind: "next",
            sourcePin: "then",
            targetPin: "in"
        },
        {
            id: "e_profile_persist",
            source: "profile",
            target: "persist",
            kind: "next",
            sourcePin: "then",
            targetPin: "in"
        },
        {
            id: "e_persist_end",
            source: "persist",
            target: "end",
            kind: "next",
            sourcePin: "then",
            targetPin: "in"
        }
    ]
};
