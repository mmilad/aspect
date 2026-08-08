import { describe, expect, it } from "vitest";
import { getNodeTemplate } from "./templates";

describe("node templates", () => {
  it("uses type-specific templates", () => {
    expect(getNodeTemplate("decision").map((field) => field.key)).toContain("rationale");
  });

  it("falls back for future node types", () => {
    expect(getNodeTemplate("unknown_type").map((field) => field.key)).toEqual(["purpose", "notes"]);
  });
});

