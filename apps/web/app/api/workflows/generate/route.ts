import { NextResponse } from "next/server";
import {
  buildWorkflowAuthorSystemPrompt,
  buildWorkflowAuthorUserPrompt,
  parseGeneratedWorkflowGraph,
  scaffoldWorkflowFromBrief,
  type WorkflowGraph
} from "@projectplaner/core";

interface GenerateBody {
  brief?: string;
  title?: string;
  /** When true, skip LLM and always return the deterministic scaffold. */
  scaffoldOnly?: boolean;
}

function llmConfig() {
  const baseUrl = process.env.PROJECTPLANER_LLM_BASE_URL?.replace(/\/$/, "");
  const model = process.env.PROJECTPLANER_LLM_MODEL;
  const apiKey = process.env.PROJECTPLANER_LLM_API_KEY;
  if (!baseUrl || !model) {
    return null;
  }
  return { baseUrl, model, apiKey };
}

async function generateWithLlm(brief: string, title?: string): Promise<WorkflowGraph> {
  const config = llmConfig();
  if (!config) {
    throw new Error("LLM is not configured.");
  }

  const response = await fetch(`${config.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(config.apiKey ? { authorization: `Bearer ${config.apiKey}` } : {})
    },
    body: JSON.stringify({
      model: config.model,
      temperature: 0.2,
      messages: [
        { role: "system", content: buildWorkflowAuthorSystemPrompt() },
        { role: "user", content: buildWorkflowAuthorUserPrompt({ brief, title }) }
      ]
    })
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`LLM request failed (${response.status}): ${text.slice(0, 240)}`);
  }

  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = payload.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("LLM returned an empty response.");
  }

  const parsed = parseGeneratedWorkflowGraph(content);
  if (!parsed.ok) {
    throw new Error(parsed.errors.join("; "));
  }
  return parsed.graph;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as GenerateBody;
    const brief = body.brief?.trim();
    if (!brief) {
      return NextResponse.json({ error: "brief is required." }, { status: 400 });
    }

    const title = body.title?.trim();
    const configured = Boolean(llmConfig());

    if (body.scaffoldOnly || !configured) {
      const graph = scaffoldWorkflowFromBrief({ brief, title });
      return NextResponse.json({
        graph,
        source: "scaffold",
        llmConfigured: configured,
        prompt: {
          system: buildWorkflowAuthorSystemPrompt(),
          user: buildWorkflowAuthorUserPrompt({ brief, title })
        }
      });
    }

    const graph = await generateWithLlm(brief, title);
    return NextResponse.json({
      graph,
      source: "llm",
      llmConfigured: true
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not generate workflow." },
      { status: 400 }
    );
  }
}
