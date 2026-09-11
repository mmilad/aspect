vi.mock("../apps/web/node_modules/react/index.js", () => ({ useCallback: (callback: unknown) => callback }));
import { describe, expect, it, vi } from "vitest";


import { useAgentSelection } from "../apps/web/components/assistant/use-agent-selection";

const route = vi.hoisted(() => ({ pathname: "/projects/PLAN", query: "", push: vi.fn() }));
vi.mock("../apps/web/node_modules/next/navigation.js", () => ({
  usePathname: () => route.pathname,
  useSearchParams: () => new URLSearchParams(route.query),
  useRouter: () => ({ push: route.push })
}));
function read(query: string, pathname = "/projects/PLAN") {
  route.query = query;
  route.pathname = pathname;
  return useAgentSelection("PLAN");
}
describe("route-bound agent chats", () => {
  it("restores the agent from navigation and clears it on a normal route", () => {
    expect(read("assistant=1&agent=first").selectedAgentId).toBe("first");
    expect(read("assistant=1&agent=second").selectedAgentId).toBe("second");
    expect(read("assistant=1&agent=first").selectedAgentId).toBe("first");
    expect(read("")).toMatchObject({ selectedAgentId: null, mode: "inspect" });
    expect(read("agent=first", "/projects/OTHER").selectedAgentId).toBeNull();
  });
  it("switches between agent and Assistant while retaining other route context", () => {
    read("selected=node&agent=first").setSelectedAgentId("second");
    expect(route.push).toHaveBeenLastCalledWith("/projects/PLAN?selected=node&assistant=1&agent=second", { scroll: false });
    read("selected=node&agent=second").setSelectedAgentId(null);
    expect(route.push).toHaveBeenLastCalledWith("/projects/PLAN?selected=node&assistant=1", { scroll: false });
    read("selected=node&assistant=1&agent=second").setMode("inspect");
    expect(route.push).toHaveBeenLastCalledWith("/projects/PLAN?selected=node", { scroll: false });
  });
});




