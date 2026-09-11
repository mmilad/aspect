import type { AgentRunEvent } from "@projectplaner/core";

/** Finite persisted replay; synchronous runs do not stream model progress. */
export function replayResponse(events: AgentRunEvent[]): Response {
  const body = events.map(event =>
    'id: ' + event.id + '\nevent: ' + event.type + '\ndata: ' + JSON.stringify(event) + '\n\n'
  ).join('');
  return new Response(body, { headers: {
    "Content-Type": "text/event-stream", "Cache-Control": "no-store",
    "X-Agent-Events-Mode": "replay"
  } });
}

export function replayCursor(request: Request): string | undefined {
  return new URL(request.url).searchParams.get("after") ||
    request.headers.get("Last-Event-ID") || undefined;
}
