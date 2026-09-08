export type ProjectRow = { id: string; key: string; title: string; description: string };

export type EntityRow = {
  id: string;
  project_id: string;
  type: string;
  key: string | null;
  slug: string;
  title: string;
  summary: string;
  body: string;
  status: string;
  sort_order: number;
  metadata_json: string;
};

export type EntityRelationV2Row = {
  id: string;
  project_id: string;
  source_entity_id: string;
  target_entity_id: string;
  type: string;
  label: string | null;
  is_primary: number;
  metadata_json: string;
};

export type TagRow = {
  id: string;
  project_id: string;
  slug: string;
  label: string;
  kind: string;
};

export type EntityTagAssignmentRow = {
  id: string;
  tag_id: string;
  entity_id: string;
};
