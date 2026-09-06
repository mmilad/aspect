/** Rename token roots only; preserve prose, paths, whitespace and reserved blocks. */
export function renameTemplateRoot(text: string | undefined, from: string, to: string): string | undefined {
  return text?.replace(/\{\{(\s*)([^}]+?)(\s*)\}\}/g, (token, before, expression: string, after) => {
    if (expression === "@reads" || expression === "@shapes") return token;
    const prefix = expression.startsWith("@") ? "@" : "";
    const path = expression.slice(prefix.length);
    if (path !== from && !path.startsWith(from + ".")) return token;
    return "{{" + before + prefix + to + path.slice(from.length) + after + "}}";
  });
}
