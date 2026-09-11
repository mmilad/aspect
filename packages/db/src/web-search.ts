import type { SearchResponse, SearchResult, WebSearchProvider } from "@projectplaner/core";

function normalize(payload: unknown, maxResults: number): SearchResponse {
  if (!payload || typeof payload !== "object" || !Array.isArray((payload as { results?: unknown }).results)) {
    throw new Error("Web search returned an invalid results list.");
  }
  const rows = (payload as { results: unknown[] }).results;
  const results: SearchResult[] = [];
  for (const row of rows) {
    if (!row || typeof row !== "object") throw new Error("Web search returned an invalid result.");
    const item = row as Record<string, unknown>;
    if (typeof item.title !== "string" || typeof item.url !== "string") {
      throw new Error("Web search result requires title and URL.");
    }
    if (results.length < maxResults) results.push({
      title: item.title, url: item.url,
      snippet: typeof item.content === "string" ? item.content : undefined,
      source: typeof item.engine === "string" ? item.engine : undefined
    });
  }
  return { results };
}

export function createSearxngProvider(endpoint: string): WebSearchProvider {
  const base = endpoint.replace(/\/$/, "");
  return {
    async search(input) {
      if (!input.query.trim()) throw new Error("Web search query is required.");
      if (!Number.isInteger(input.maxResults) || input.maxResults < 1 || input.maxResults > 50) {
        throw new Error("Web search maxResults must be between 1 and 50.");
      }
      const url = new URL(base + '/search');
      url.searchParams.set("q", input.query);
      url.searchParams.set("format", "json");
      const abort = new AbortController();
      const timer = setTimeout(() => abort.abort(), 15000);
      try {
        const response = await fetch(url, { signal: abort.signal });
        if (!response.ok) throw new Error('Web search provider returned HTTP ' + response.status + '.');
        return normalize(await response.json(), input.maxResults);
      } catch (error) {
        if (abort.signal.aborted) throw new Error("Web search timed out after 15 seconds.");
        throw error;
      } finally { clearTimeout(timer); }
    }
  };
}
export function createWebSearchProvider(): WebSearchProvider {
  return createSearxngProvider(process.env.WEB_SEARCH_ENDPOINT ?? "http://localhost:8080");
}
