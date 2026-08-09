import { NextResponse } from "next/server";
import {
  buildWorkflowCompileSystemPrompt,
  buildWorkflowCompileUserPrompt,
  buildWorkflowOutlineSystemPrompt,
  buildWorkflowOutlineUserPrompt,
  generateWorkflowTwoTurn,
  readLlmChatConfigFromEnv,
  scaffoldWorkflowFromBrief
} from "@projectplaner/core";

interface GenerateBody {
  brief?: string;
  title?: string;
  /** When true, skip LLM and always return the deterministic scaffold. */
  scaffoldOnly?: boolean;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as GenerateBody;
    const brief = body.brief?.trim();
    if (!brief) {
      return NextResponse.json({ error: "brief is required." }, { status: 400 });
    }

    const title = body.title?.trim();
    const config = readLlmChatConfigFromEnv();
    const configured = Boolean(config);

    if (body.scaffoldOnly || !config) {
      const graph = scaffoldWorkflowFromBrief({ brief, title });
      return NextResponse.json({
        graph,
        source: "scaffold",
        llmConfigured: configured,
        prompt: {
          outline: {
            system: buildWorkflowOutlineSystemPrompt(),
            user: buildWorkflowOutlineUserPrompt({ brief, title })
          },
          compile: {
            system: buildWorkflowCompileSystemPrompt(),
            user: buildWorkflowCompileUserPrompt({
              brief,
              title,
              outline: "(outline from turn 1)"
            })
          }
        }
      });
    }

    const result = await generateWorkflowTwoTurn({ brief, title }, config);
    if (!result.graph) {
      return NextResponse.json(
        {
          error: result.parseErrors?.join("; ") ?? "Generated JSON failed schema checks.",
          outline: result.outline,
          graphJson: result.graphJson,
          source: "llm_two_turn",
          llmConfigured: true
        },
        { status: 400 }
      );
    }
    return NextResponse.json({
      graph: result.graph,
      outline: result.outline,
      graphJson: result.graphJson,
      source: "llm_two_turn",
      llmConfigured: true
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not generate workflow." },
      { status: 400 }
    );
  }
}
