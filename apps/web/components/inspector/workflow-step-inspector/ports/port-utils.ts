export function identityFromPorts(ports: string[]): Record<string, string> {
  return Object.fromEntries(ports.map((portId) => [portId, portId]));
}
