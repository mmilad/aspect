#!/usr/bin/env node
import { loadConfig } from "./config";
import { parseArgs, printHelp } from "./cli";
import { WorkflowClient, WorkflowClientError, isPendingLlm } from "./client";

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
    const bag = args.goal ? { goal: args.goal } : undefined;
    const result = await client.start({
      key: args.workflow,
      id: args.flowId,
      goal: args.goal,
      bag
    });

    console.log(
      JSON.stringify(
        {
          flowId: result.flow.id,
          flowTitle: result.flow.title,
          runId: result.run.id,
          status: result.run.status,
          step: result.step.kind,
          note: result.note,
          pendingLlm: isPendingLlm(result) ? client.pendingLlm(result) : null
        },
        null,
        2
      )
    );
    return result.step.kind === "failed" ? 1 : 0;
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
