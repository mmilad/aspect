import type { NodeExecuteContext, WorkflowStepResult } from "../../runtime/types";
export async function executeWebSearch(ctx: NodeExecuteContext): Promise<WorkflowStepResult> {
    if (!ctx.adapters.webSearch)
        return ctx.fail("Web search is not configured.");
    const config = ctx.node.data.webSearch ?? {};
    const value = ctx.read(config.queryFrom ?? "query");
    const query = typeof value === "string" ? value.trim() : "";
    if (!query)
        return ctx.fail(`Web search ${ctx.node.id}: query must be a non-empty string.`);
    const rawLimit = ctx.read(config.maxResultsFrom ?? "maxResults");
    const maxResults = rawLimit === undefined ? 10 : Number(rawLimit);
    if (!Number.isInteger(maxResults) || maxResults < 1 || maxResults > 50)
        return ctx.fail(`Web search ${ctx.node.id}: maxResults must be an integer between 1 and 50.`);
    try {
        const response = await ctx.adapters.webSearch({
            query, maxResults
        });
        const applied = ctx.applyWrites({
            results: response.results
        });
        return applied.ok ? ctx.advance() : ctx.fail(applied.error);
    }
    catch (error) {
        return ctx.fail(error instanceof Error ? error.message : "Web search failed.");
    }
}
