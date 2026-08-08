export function slugifyTitle(title: string): string {
  return title
    .trim()
    .toLowerCase()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72);
}

export function buildNodePath(parentPath: string | null, slug: string): string {
  return parentPath ? `${parentPath}.${slug}` : slug;
}

export function uniqueSlug(title: string, siblingSlugs: Iterable<string>): string {
  const base = slugifyTitle(title) || "node";
  const used = new Set(siblingSlugs);
  if (!used.has(base)) {
    return base;
  }

  let index = 2;
  while (used.has(`${base}-${index}`)) {
    index += 1;
  }

  return `${base}-${index}`;
}

