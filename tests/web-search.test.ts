import { afterEach, expect, it, vi } from "vitest";
import { createSearxngProvider } from "../packages/db/src/web-search";

afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });
const search = () => createSearxngProvider("http://local").search({ query: "coding", maxResults: 1 });
it("normalizes SearXNG results and limits output", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ results: [
    { title: "A", url: "https://a", content: "summary", engine: "engine" }, { title: "B", url: "https://b" }
  ] })));
  expect((await search()).results).toEqual([{ title: "A", url: "https://a", snippet: "summary", source: "engine" }]);
});
it.each([{}, { results: null }, { results: [{}] }])("rejects malformed results", async payload => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json(payload)));
  await expect(search()).rejects.toThrow(/result/i);
});
it("reports service errors", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("", { status: 503 })));
  await expect(search()).rejects.toThrow("503");
});
it("aborts after 15 seconds", async () => {
  vi.useFakeTimers();
  vi.stubGlobal("fetch", vi.fn((_url, options) => new Promise((_resolve, reject) => {
    options.signal.addEventListener("abort", () => reject(new Error("aborted")));
  })));
  const result = expect(search()).rejects.toThrow("15 seconds");
  await vi.advanceTimersByTimeAsync(15000);
  await result;
});
