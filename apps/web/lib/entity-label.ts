/** Humanize underscored enum-like labels: "in_work" → "in work". */
export function formatLabel(value: string): string {
  return value.replaceAll("_", " ");
}

export function formatEntityType(type: string): string {
  return formatLabel(type);
}

export function formatStatus(status: string): string {
  return formatLabel(status);
}

export function isCompleteStatus(status: string): boolean {
  return ["implemented", "done", "accepted", "answered"].includes(status);
}
