/**
 * Minimal bag-scoped template fill for LLM instructions.
 * Tokens: {{key}}, {{key.path}}, {{@reads}}, {{@shapes}}
 */

export interface RenderBagTemplateInput {
  keys: Record<string, unknown>;
  /** Keys the template may reference (LLM reads / inputKeys). */
  allowedKeys: string[];
  shapes?: Record<string, string>;
}

export interface RenderBagTemplateResult {
  text: string;
  warnings: string[];
}

const TOKEN_RE = /\{\{\s*([^}]+?)\s*\}\}/g;

function readPath(value: unknown, path: string): unknown {
  if (!path) {
    return value;
  }
  const parts = path.split(".");
  let current: unknown = value;
  for (const part of parts) {
    if (typeof current !== "object" || current === null || !(part in (current as Record<string, unknown>))) {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

/** Format a bag value for injection into instruction text. */
export function formatBagTemplateValue(value: unknown): string {
  if (value === undefined || value === null) {
    return "(empty)";
  }
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function formatReadsBlock(keys: Record<string, unknown>, allowedKeys: string[]): string {
  if (allowedKeys.length === 0) {
    return "(no declared reads)";
  }
  return allowedKeys
    .map((key) => `- ${key}: ${formatBagTemplateValue(key in keys ? keys[key] : undefined)}`)
    .join("\n");
}

function formatShapesBlock(allowedKeys: string[], shapes: Record<string, string> | undefined): string {
  if (allowedKeys.length === 0) {
    return "(no declared reads)";
  }
  return allowedKeys
    .map((key) => `- ${key}: ${shapes?.[key] ?? "(unknown)"}`)
    .join("\n");
}

/**
 * Render `{{…}}` tokens against declared bag reads.
 * Unknown tokens are left in place with a warning; missing values become `(empty)`.
 */
export function renderBagTemplate(
  template: string,
  input: RenderBagTemplateInput
): RenderBagTemplateResult {
  const warnings: string[] = [];
  const allowed = new Set(input.allowedKeys);

  const text = template.replace(TOKEN_RE, (match, rawExpr: string) => {
    const expr = rawExpr.trim();
    if (!expr) {
      warnings.push("Empty template token {{}}.");
      return match;
    }

    if (expr === "@reads") {
      return formatReadsBlock(input.keys, input.allowedKeys);
    }
    if (expr === "@shapes") {
      return formatShapesBlock(input.allowedKeys, input.shapes);
    }

    // {{@key}} / {{@key.path}} — same as key lookup (meta alias; still must be allowed).
    const withoutAt = expr.startsWith("@") ? expr.slice(1) : expr;
    if (!withoutAt) {
      warnings.push(`Invalid template token ${match}.`);
      return match;
    }

    const root = withoutAt.split(".")[0] ?? withoutAt;
    if (!allowed.has(root)) {
      warnings.push(`Template token ${match} is not in declared LLM reads.`);
      return match;
    }

    const value = readPath(input.keys, withoutAt);
    if (!(root in input.keys) && withoutAt === root) {
      return "(empty)";
    }
    if (value === undefined && withoutAt.includes(".")) {
      return "(empty)";
    }
    return formatBagTemplateValue(value);
  });

  return { text, warnings };
}
