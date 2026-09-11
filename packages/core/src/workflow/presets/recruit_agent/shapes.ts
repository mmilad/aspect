export const STRING = { kind: "primitive" as const, type: "string" as const };
export const NUMBER = { kind: "primitive" as const, type: "number" as const };
export const RESULTS = { kind: "array" as const, items: { kind: "ref" as const, ref: "Json" } };
