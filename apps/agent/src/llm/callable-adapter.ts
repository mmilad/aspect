import { buildAdapterPrompt, parseLlmWrites } from "./parse-writes";
import type { LlmAdapter, LlmCompleteInput } from "./types";

export type CallableLlmAdapterOptions = {
  /**
   * Produce model text from the slim adapter prompt.
   * Inject a real provider here later; tests inject a stub.
   */
  completeText: (prompt: string, input: LlmCompleteInput) => Promise<string>;
};

/** Live/callable path: prompt glue + JSON parse into llmWrites. */
export class CallableLlmAdapter implements LlmAdapter {
  private readonly completeText: CallableLlmAdapterOptions["completeText"];

  constructor(options: CallableLlmAdapterOptions) {
    this.completeText = options.completeText;
  }

  async complete(input: LlmCompleteInput): Promise<Record<string, unknown>> {
    const prompt = buildAdapterPrompt(input.pending);
    const text = await this.completeText(prompt, input);
    return parseLlmWrites(text, input.pending.outputSchema);
  }
}
