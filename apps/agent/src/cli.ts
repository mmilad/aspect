export type CliArgs = {
  help: boolean;
  workflow?: string;
  flowId?: string;
  /** Optional bag seed for goal-planning / other flows. */
  goal?: string;
  baseUrl?: string;
  /** Use packaged fixtures dir, or a custom path when value is a string. */
  fixtures?: string | true;
  /** External command for live LLM (stdin prompt → stdout JSON writes). */
  llmHook?: string;
  maxLlmSteps?: number;
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
    if (token === "--fixtures") {
      const next = argv[i + 1];
      if (next && !next.startsWith("-")) {
        args.fixtures = argv[++i];
      } else {
        args.fixtures = true;
      }
      continue;
    }
    if (token === "--llm-hook") {
      args.llmHook = argv[++i];
      continue;
    }
    if (token === "--max-llm-steps") {
      const raw = argv[++i];
      const parsed = Number(raw);
      if (!Number.isInteger(parsed) || parsed < 1) {
        throw new Error(`Invalid --max-llm-steps: ${raw}`);
      }
      args.maxLlmSteps = parsed;
      continue;
    }
    throw new Error(`Unknown argument: ${token}`);
  }
  return args;
}

export function printHelp(): void {
  const lines = [
    "projectplaner-agent — semi-agent workflow host",
    "",
    "Usage:",
    "  pnpm --filter @projectplaner/agent start -- -w <preset> [--fixtures] [options]",
    "",
    "Options:",
    "  -w, --workflow <key>     Preset/workflow key to run",
    "      --flow <id>          Flow entity id to run",
    "      --goal <text>        Optional bag/goal seed",
    "      --base-url <url>     Override PROJECTPLANER_API_BASE_URL",
    "      --fixtures [dir]     Auto-resume pending_llm from fixture JSON",
    "      --llm-hook <cmd>     Live path: prompt on stdin → JSON llmWrites on stdout",
    "      --max-llm-steps <n>  Cap LLM resumes (default 8)",
    "  -h, --help               Show help",
    "",
    "Runs defined Projectplaner workflows only (no open-ended tools).",
    "Without --fixtures / --llm-hook, stops at the first pending_llm and prints it."
  ];
  console.log(lines.join("\n"));
}
