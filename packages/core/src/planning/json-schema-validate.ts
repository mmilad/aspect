/** Minimal JSON Schema subset used to lock plan.v1 (no Ajv). */

export type JsonSchema = Record<string, unknown>;

export function validateJsonSchema(
  schema: JsonSchema,
  value: unknown,
  path = "$"
): string[] {
  return check(schema, value, path, schema);
}

function check(schema: JsonSchema, value: unknown, path: string, root: JsonSchema): string[] {
  if (typeof schema.$ref === "string") {
    const resolved = resolveRef(schema.$ref, root);
    if (!resolved) {
      return [`${path}: unresolved $ref ${schema.$ref}`];
    }
    return check(resolved, value, path, root);
  }

  const errors: string[] = [];
  if (Array.isArray(schema.type)) {
    const ok = schema.type.some((type) => valueMatchesType(type, value));
    if (!ok) {
      errors.push(`${path}: expected type ${schema.type.join("|")}`);
      return errors;
    }
  } else if (typeof schema.type === "string" && !valueMatchesType(schema.type, value)) {
    errors.push(`${path}: expected type ${schema.type}`);
    return errors;
  }

  if (schema.const !== undefined && value !== schema.const) {
    errors.push(`${path}: expected const ${JSON.stringify(schema.const)}`);
  }
  if (Array.isArray(schema.enum) && !schema.enum.includes(value as never)) {
    errors.push(`${path}: expected enum ${schema.enum.join("|")}`);
  }
  if (typeof schema.minLength === "number" && typeof value === "string" && value.length < schema.minLength) {
    errors.push(`${path}: minLength ${schema.minLength}`);
  }
  if (typeof schema.minimum === "number" && typeof value === "number" && value < schema.minimum) {
    errors.push(`${path}: minimum ${schema.minimum}`);
  }
  if (typeof schema.maximum === "number" && typeof value === "number" && value > schema.maximum) {
    errors.push(`${path}: maximum ${schema.maximum}`);
  }

  if (Array.isArray(schema.oneOf)) {
    const matches = schema.oneOf.filter((option) => check(option as JsonSchema, value, path, root).length === 0);
    if (matches.length !== 1) {
      errors.push(`${path}: expected exactly one oneOf match`);
    }
    return errors;
  }

  if (schema.type === "object" || (!schema.type && value && typeof value === "object" && !Array.isArray(value))) {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      const record = value as Record<string, unknown>;
      const properties = (schema.properties as Record<string, JsonSchema> | undefined) ?? {};
      const required = Array.isArray(schema.required) ? schema.required : [];
      for (const key of required) {
        if (!(key in record)) {
          errors.push(`${path}: missing required ${key}`);
        }
      }
      for (const [key, child] of Object.entries(record)) {
        if (key in properties) {
          errors.push(...check(properties[key]!, child, `${path}.${key}`, root));
        } else if (schema.additionalProperties === false) {
          errors.push(`${path}: additional property ${key}`);
        } else if (schema.additionalProperties && typeof schema.additionalProperties === "object") {
          errors.push(...check(schema.additionalProperties as JsonSchema, child, `${path}.${key}`, root));
        }
      }
    }
  }

  if (schema.type === "array" && Array.isArray(value)) {
    if (typeof schema.minItems === "number" && value.length < schema.minItems) {
      errors.push(`${path}: minItems ${schema.minItems}`);
    }
    if (typeof schema.maxItems === "number" && value.length > schema.maxItems) {
      errors.push(`${path}: maxItems ${schema.maxItems}`);
    }
    if (schema.items && typeof schema.items === "object") {
      value.forEach((item, index) => {
        errors.push(...check(schema.items as JsonSchema, item, `${path}[${index}]`, root));
      });
    }
  }

  if (schema.if && typeof schema.if === "object") {
    const matched = check(schema.if as JsonSchema, value, path, root).length === 0;
    const branch = matched ? schema.then : schema.else;
    if (branch && typeof branch === "object") {
      errors.push(...check(branch as JsonSchema, value, path, root));
    }
  }

  return errors;
}

function valueMatchesType(type: string, value: unknown): boolean {
  if (type === "object") {
    return Boolean(value) && typeof value === "object" && !Array.isArray(value);
  }
  if (type === "array") {
    return Array.isArray(value);
  }
  if (type === "null") {
    return value === null;
  }
  if (type === "integer") {
    return typeof value === "number" && Number.isInteger(value);
  }
  return typeof value === type;
}

function resolveRef(ref: string, root: JsonSchema): JsonSchema | null {
  if (!ref.startsWith("#/")) {
    return null;
  }
  const parts = ref.slice(2).split("/");
  let current: unknown = root;
  for (const part of parts) {
    if (!current || typeof current !== "object" || !(part in (current as Record<string, unknown>))) {
      return null;
    }
    current = (current as Record<string, unknown>)[part];
  }
  return current && typeof current === "object" && !Array.isArray(current) ? (current as JsonSchema) : null;
}
