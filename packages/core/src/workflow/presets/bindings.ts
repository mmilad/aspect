/** Identity portId → bagKey map for preset authors. */
export function identityBindings(ports: string[]): Record<string, string> {
  return Object.fromEntries(ports.map((portId) => [portId, portId]));
}
