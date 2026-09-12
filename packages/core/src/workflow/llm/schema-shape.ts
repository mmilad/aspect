import { getLlmJsonSchemaPreset } from "./llm-json-schemas";
import type { BagShape } from "../nodes";

function schemaShape(schema: unknown): BagShape {
  if (!schema || typeof schema !== "object" || Array.isArray(schema)) return { kind: "any" };
  const value = schema as Record<string, unknown>;
  if (Array.isArray(value.oneOf) || Array.isArray(value.anyOf)) {
    const options = (value.oneOf ?? value.anyOf) as unknown[];
    return { kind: "union", options: options.map(schemaShape) };
  }
  if (Array.isArray(value.type)) {
    return {
      kind: "union",
      options: value.type.map((type) => schemaShape({ ...value, type })).filter((shape) => shape.kind !== "any")
    };
  }
  switch (value.type) {
    case "string": return { kind: "primitive", type: "string" };
    case "number": case "integer": return { kind: "primitive", type: "number" };
    case "boolean": return { kind: "primitive", type: "boolean" };
    case "null": return { kind: "primitive", type: "null" };
    case "array": return { kind: "array", items: schemaShape(value.items) };
    case "object": {
      const properties = value.properties && typeof value.properties === "object" && !Array.isArray(value.properties)
        ? value.properties as Record<string, unknown> : {};
      const required = Array.isArray(value.required) ? value.required.filter((item): item is string => typeof item === "string") : [];
      return { kind: "object", fields: Object.fromEntries(Object.entries(properties).map(([key, item]) => [key, schemaShape(item)])), requiredFields: required };
    }
    default: return { kind: "any" };
  }
}

export function bagShapeFromLlmSchema(schemaKey: string | undefined): BagShape | undefined {
  const preset = schemaKey ? getLlmJsonSchemaPreset(schemaKey) : undefined;
  return preset ? schemaShape(preset.schema) : undefined;
}
