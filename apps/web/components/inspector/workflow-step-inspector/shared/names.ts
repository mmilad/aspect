export function nextUniqueName(existing: string[], base: string): string {
  let n = 1;
  let name = `${base}${n}`;
  const names = new Set(existing);
  while (names.has(name)) {
    n += 1;
    name = `${base}${n}`;
  }
  return name;
}
