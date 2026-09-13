import { expect, it } from "vitest";
import { parseAgentProfile } from "../profile";
import { canRunCapability } from "./policy";

it("requires an explicit registered capability instead of descriptive expertise", () => {
  const expertiseOnly = parseAgentProfile({ capabilities: ["project.get_entity"] });
  const registered = parseAgentProfile({ capabilities: ["coding"], registeredCapabilities: ["project.get_entity"] });
  expect(canRunCapability(expertiseOnly, "project.get_entity")).toBe(false);
  expect(canRunCapability(registered, "project.get_entity")).toBe(true);
});
