import { describe, expect, it } from "vitest";
import { formatBagTemplateValue, renderBagTemplate } from "./template";

describe("renderBagTemplate", () => {
  it("fills simple keys and paths", () => {
    const result = renderBagTemplate("Title={{title}}; id={{candidates.0.id}}", {
      keys: {
        title: "Ensure Aspect",
        candidates: [{ id: "aspect_1", title: "A" }]
      },
      allowedKeys: ["title", "candidates"]
    });
    expect(result.text).toBe("Title=Ensure Aspect; id=aspect_1");
    expect(result.warnings).toEqual([]);
  });

  it("expands @reads and @shapes", () => {
    const result = renderBagTemplate("Data:\n{{@reads}}\nShapes:\n{{@shapes}}", {
      keys: { title: "T", candidates: [{ id: "a" }] },
      allowedKeys: ["title", "candidates"],
      shapes: { title: "string", candidates: "object{id}[]" }
    });
    expect(result.text).toContain("- title: T");
    expect(result.text).toContain('- candidates: [{"id":"a"}]');
    expect(result.text).toContain("- title: string");
    expect(result.text).toContain("- candidates: object{id}[]");
  });

  it("uses (empty) for missing allowed keys", () => {
    const result = renderBagTemplate("x={{summary}}", {
      keys: {},
      allowedKeys: ["summary"]
    });
    expect(result.text).toBe("x=(empty)");
    expect(result.warnings).toEqual([]);
  });

  it("leaves disallowed keys and warns", () => {
    const result = renderBagTemplate("secret={{password}}", {
      keys: { password: "nope", title: "ok" },
      allowedKeys: ["title"]
    });
    expect(result.text).toBe("secret={{password}}");
    expect(result.warnings.some((w) => w.includes("password"))).toBe(true);
  });

  it("formats primitives and objects", () => {
    expect(formatBagTemplateValue(null)).toBe("(empty)");
    expect(formatBagTemplateValue(true)).toBe("true");
    expect(formatBagTemplateValue({ a: 1 })).toBe('{"a":1}');
  });
});
