export type AssistantBlock =
  | { kind: "prose"; path: string; label?: string }
  | { kind: "fields"; fields: Array<{ label: string; path: string }> }
  | { kind: "chips"; path: string; label?: string }
  | { kind: "ref"; path: string; label?: string };

export type AssistantView =
  | { kind: "transcript" }
  | { kind: "detail"; blocks: AssistantBlock[] }
  | {
      kind: "list";
      path: string;
      title: string;
      sub?: string;
      itemView: string;
    };

export type AssistantProperty = {
  key: string;
  nav: string;
  /** Dot path(s) on the session; omit = always visible (transcript). */
  showWhen?: string | string[];
  view: AssistantView;
};
