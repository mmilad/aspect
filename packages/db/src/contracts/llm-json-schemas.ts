export type LlmJsonSchemaRecord = {
  id: string;
  projectId: string;
  key: string;
  title: string;
  description: string;
  schema: Record<string, unknown>;
  status: string;
  version: number;
};
export type EnsureLlmJsonSchemasOptions = {
  projectKey?: string;
  force?: boolean;
  only?: string[];
};
export type EnsureLlmJsonSchemasResult = {
  seeded: string[];
  skipped: string[];
  reseeded: string[];
};
export type CreateLlmJsonSchemaInput = {
  projectKey?: string;
  key: string;
  title: string;
  description?: string;
  schema: Record<string, unknown>;
};
export interface Operations {
  getByKey(key: string, projectKey?: string): Promise<LlmJsonSchemaRecord | null>;
  list(projectKey?: string): Promise<LlmJsonSchemaRecord[]>;
  create(input: CreateLlmJsonSchemaInput): Promise<LlmJsonSchemaRecord>;
  ensure(options?: EnsureLlmJsonSchemasOptions): Promise<EnsureLlmJsonSchemasResult>;
}
