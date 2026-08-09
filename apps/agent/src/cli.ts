export type CliArgs = {
  help: boolean;
  workflow?: string;
  flowId?: string;
  /** Optional bag seed for later goal-planning workflows (not executed in scaffold). */
  goal?: string;
  baseUrl?: string;
};

export function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = { help: false };
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (token === "--help" || token === "-h") {
      args.help = true;
      continue;
    }
    if (token === "--workflow" || token === "-w") {
      args.workflow = argv[++i];
      continue;
    }
    if (token === "--flow") {
      args.flowId = argv[++i];
      continue;
    }
    if (token === "--goal") {
      args.goal = argv[++i];
      continue;
    }
    if (token === "--base-url") {
      args.baseUrl = argv[++i];
      continue;
    }
    throw new Error(`Unknown argument: ${token}`);
  }
  return args;
}

export function printHelp(): void {
  const lines = [
    "projectplaner-agent — semi-agent workflow host (scaffold)",
    "",
    "Usage:",
    "  pnpm --filter @projectplaner/agent start -- [options]",
    "",
    "Options:",
    "  -w, --workflow <key>   Preset/workflow key to run (PLAN-57)",
    "      --flow <id>        Flow entity id to run (PLAN-57)",
    "      --goal <text>      Optional bag seed for goal-planning flows",
    "      --base-url <url>   Override PROJECTPLANER_API_BASE_URL",
    "  -h, --help             Show help",
    "",
    "This package hosts defined Projectplaner workflows only.",
    "run_workflow client + pending_llm resume ship in PLAN-55–57."
  ];
  console.log(lines.join("\n"));
}
