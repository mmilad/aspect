#!/usr/bin/env node
import { loadConfig } from "./config";
import { parseArgs, printHelp } from "./cli";

function main(): number {
  let args;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    printHelp();
    return 1;
  }

  if (args.help || (!args.workflow && !args.flowId && !args.goal)) {
    printHelp();
    return args.help ? 0 : 0;
  }

  const config = loadConfig();
  if (args.baseUrl) {
    config.apiBaseUrl = args.baseUrl.replace(/\/$/, "");
  }

  console.log(
    [
      "@projectplaner/agent scaffold is installed.",
      `apiBaseUrl=${config.apiBaseUrl}`,
      `projectKey=${config.projectKey}`,
      args.workflow ? `workflow=${args.workflow}` : null,
      args.flowId ? `flowId=${args.flowId}` : null,
      args.goal ? `goal=${JSON.stringify(args.goal)}` : null,
      "",
      "Workflow run / pending_llm resume is not implemented yet (PLAN-55–57)."
    ]
      .filter(Boolean)
      .join("\n")
  );
  return 0;
}

process.exit(main());
