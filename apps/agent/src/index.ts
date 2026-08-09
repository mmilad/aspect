#!/usr/bin/env node
import { loadConfig } from "./config";
import { parseArgs, printHelp } from "./cli";
import { WorkflowClient, WorkflowClientError, isPendingLlm } from "./client";
import {
  createHookLlmAdapter,
  defaultFixturesDir,
  loadFixtureAdapter,
  type LlmAdapter
} from "./llm";
import { runWorkflowLoop } from "./run-loop";

async function resolveAdapter(args: ReturnType<typeof parseArgs>): Promise<LlmAdapter | undefined> {
  if (args.llmHook) {
    return createHookLlmAdapter(args.llmHook);
  }
  if (args.fixtures !== undefined) {
    const dir = args.fixtures === true ? defaultFixturesDir() : args.fixtures;
    return loadFixtureAdapter(dir);
  }
  if (process.env.PROJECTPLANER_LLM_HOOK?.trim()) {
    return createHookLlmAdapter(process.env.PROJECTPLANER_LLM_HOOK.trim());
  }
  return undefined;
}

async function main(): Promise<number> {
  let args;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    printHelp();
    return 1;
  }

  if (args.help || (!args.workflow && !args.flowId)) {
    printHelp();
    return 0;
  }

  const config = loadConfig();
  if (args.baseUrl) {
    config.apiBaseUrl = args.baseUrl.replace(/\/$/, "");
  }

  const client = new WorkflowClient({
    apiBaseUrl: config.apiBaseUrl,
    projectKey: config.projectKey
  });

  try {
    const adapter = await resolveAdapter(args);
    const bag = args.goal ? { goal: args.goal } : undefined;
    const { response, llmSteps, history } = await runWorkflowLoop({
      client,
      adapter,
      workflowKey: args.workflow,
      maxLlmSteps: args.maxLlmSteps,
      start: {
        key: args.workflow,
        id: args.flowId,
        goal: args.goal,
        bag
      }
    });

    console.log(
      JSON.stringify(
        {
          flowId: response.flow.id,
          flowTitle: response.flow.title,
          runId: response.run.id,
          status: response.run.status,
          step: response.step.kind,
          note: response.note,
          llmSteps,
          history,
          pendingLlm: isPendingLlm(response) ? client.pendingLlm(response) : null,
          bagKeys: Object.keys(response.step.bag ?? {})
        },
        null,
        2
      )
    );

    if (response.step.kind === "failed") {
      return 1;
    }
    if (isPendingLlm(response) && !adapter) {
      return 0;
    }
    return 0;
  } catch (error) {
    if (error instanceof WorkflowClientError) {
      console.error(`WorkflowClientError (${error.status}): ${error.message}`);
      return 1;
    }
    console.error(error instanceof Error ? error.message : error);
    return 1;
  }
}

main().then((code) => process.exit(code));
