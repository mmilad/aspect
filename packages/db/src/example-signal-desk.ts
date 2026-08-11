import type { Entity, EntityRelation, EntityStatus, EntityType, JsonRecord } from "@projectplaner/core";
import type { DatabaseSync } from "node:sqlite";
import { importGenericPlan, listProjects, type GenericPlanExport, type ProjectSummary } from "./repository";

export const EXAMPLE_PROJECT_KEY = "DEMO";

const PROJECT_ID = "demo_project";

function entity(
  id: string,
  type: EntityType,
  title: string,
  status: EntityStatus,
  opts: {
    key?: string | null;
    slug?: string;
    summary?: string;
    body?: string;
    sortOrder?: number;
    metadata?: JsonRecord;
  } = {}
): Entity {
  const fromTitle = title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const slug = opts.slug ?? (fromTitle || id);
  return {
    id,
    projectId: PROJECT_ID,
    type,
    key: opts.key === undefined ? null : opts.key,
    slug,
    title,
    summary: opts.summary ?? "",
    body: opts.body ?? opts.summary ?? "",
    status,
    sortOrder: opts.sortOrder ?? 0,
    metadata: opts.metadata ?? {}
  };
}

function rel(
  id: string,
  sourceEntityId: string,
  targetEntityId: string,
  type: EntityRelation["type"],
  isPrimary = false
): EntityRelation {
  return {
    id,
    projectId: PROJECT_ID,
    sourceEntityId,
    targetEntityId,
    type,
    label: null,
    isPrimary,
    metadata: {}
  };
}

/**
 * Hand-authored editorial content-pipeline graph for Kanban / Workspace demos.
 * Deterministic demo_* ids. Not auto-seeded — use createExampleProject.
 */
export function buildSignalDeskExamplePlan(): GenericPlanExport {
  const entities: Entity[] = [
    entity("demo_root", "project", "Signal Desk", "in_progress", {
      key: EXAMPLE_PROJECT_KEY,
      slug: "signal-desk",
      summary: "Weekly newsletter + podcast studio pipeline.",
      body: "Plan editorial, production, and distribution work as nested aspects and linked features/tasks.",
      sortOrder: 0
    }),

    // Root aspects
    entity("demo_aspect_editorial", "aspect", "Editorial", "in_progress", {
      summary: "Story selection, briefs, and issue planning.",
      sortOrder: 10
    }),
    entity("demo_aspect_production", "aspect", "Production", "planned", {
      summary: "Recording, editing, and asset prep.",
      sortOrder: 20
    }),
    entity("demo_aspect_distribution", "aspect", "Distribution", "done", {
      summary: "Send, publish, and clip syndication.",
      sortOrder: 30
    }),
    // Nested under Editorial
    entity("demo_aspect_season", "aspect", "Season Planning", "in_planning", {
      summary: "Arc and theme for the next season.",
      sortOrder: 11
    }),

    // Features
    entity("demo_feat_brief_kit", "feature", "Brief Kit", "done", {
      key: "DEMO-FEAT-1",
      summary: "Reusable brief template for writers.",
      sortOrder: 100,
      metadata: { acceptanceShape: "Writers can open a filled brief per issue." }
    }),
    entity("demo_feat_issue_calendar", "feature", "Issue Calendar", "in_progress", {
      key: "DEMO-FEAT-2",
      summary: "Schedule next four issues with owners.",
      sortOrder: 110,
      metadata: { acceptanceShape: "Calendar shows owners and ship dates." }
    }),
    entity("demo_feat_guest_slots", "feature", "Guest Slots", "in_planning", {
      key: "DEMO-FEAT-3",
      summary: "Nested under Issue Calendar — guest booking windows.",
      sortOrder: 111,
      metadata: { acceptanceShape: "Each issue has 0–2 booked guests." }
    }),
    entity("demo_feat_arc_outline", "feature", "Arc Outline", "planned", {
      key: "DEMO-FEAT-4",
      summary: "Season-level narrative outline.",
      sortOrder: 120,
      metadata: { acceptanceShape: "Six-episode arc documented." }
    }),
    entity("demo_feat_recording_day", "feature", "Recording Day", "in_progress", {
      key: "DEMO-FEAT-5",
      summary: "Studio day checklist and capture.",
      sortOrder: 200,
      metadata: { acceptanceShape: "Raw takes landed and labeled." }
    }),
    entity("demo_feat_edit_pass", "feature", "Edit Pass", "planned", {
      key: "DEMO-FEAT-6",
      summary: "Cut, levels, and show notes draft.",
      sortOrder: 210,
      metadata: { acceptanceShape: "Master + show notes ready for QA." }
    }),
    entity("demo_feat_newsletter_send", "feature", "Newsletter Send", "done", {
      key: "DEMO-FEAT-7",
      summary: "Last issue mailed and archived.",
      sortOrder: 300,
      metadata: { acceptanceShape: "Send report stored; unsubs handled." }
    }),
    entity("demo_feat_clip_farm", "feature", "Clip Farm", "canceled", {
      key: "DEMO-FEAT-8",
      summary: "Short-form clip mill — paused.",
      sortOrder: 310,
      metadata: { acceptanceShape: "Three clips per episode on social." }
    }),

    // Tasks
    entity("demo_task_intake_prompts", "task", "Refresh intake prompts", "done", {
      key: "DEMO-1",
      summary: "Update writer intake questions for Q2.",
      sortOrder: 1000,
      metadata: {
        priority: "medium",
        acceptanceCriteria: ["Prompts reviewed with editor", "Template published to Brief Kit"]
      }
    }),
    entity("demo_task_assign_owners", "task", "Assign issue owners", "in_progress", {
      key: "DEMO-2",
      summary: "Name owners for the next four issues.",
      sortOrder: 1010,
      metadata: { priority: "high", acceptanceCriteria: ["Owners listed on calendar"] }
    }),
    entity("demo_task_lock_themes", "task", "Lock issue themes", "planned", {
      key: "DEMO-3",
      summary: "Confirm theme line for each upcoming issue.",
      sortOrder: 1020,
      metadata: { priority: "medium", acceptanceCriteria: ["Themes approved in editorial standup"] }
    }),
    entity("demo_task_guest_outreach", "task", "Guest outreach list", "in_planning", {
      key: "DEMO-4",
      summary: "Draft guest shortlist for nested Guest Slots.",
      sortOrder: 1030,
      metadata: { priority: "low", acceptanceCriteria: ["Eight names with contact status"] }
    }),
    entity("demo_task_season_bible", "task", "Draft season bible", "in_planning", {
      key: "DEMO-5",
      summary: "One-pager for Season Planning arc.",
      sortOrder: 1040,
      metadata: { priority: "high", acceptanceCriteria: ["Shared with production lead"] }
    }),
    entity("demo_task_book_studio", "task", "Book studio block", "in_progress", {
      key: "DEMO-6",
      summary: "Reserve room and engineer for Recording Day.",
      sortOrder: 1050,
      metadata: { priority: "critical", acceptanceCriteria: ["Calendar invite sent"] }
    }),
    entity("demo_task_mic_check", "task", "Mic check sheet", "planned", {
      key: "DEMO-7",
      summary: "Print levels sheet for guests.",
      sortOrder: 1060,
      metadata: { priority: "low", acceptanceCriteria: ["Sheet in studio binder"] }
    }),
    entity("demo_task_rough_cut", "task", "Rough cut episode", "planned", {
      key: "DEMO-8",
      summary: "First pass edit for Edit Pass.",
      sortOrder: 1070,
      metadata: { priority: "high", acceptanceCriteria: ["Rough cut shared for notes"] }
    }),
    entity("demo_task_show_notes", "task", "Write show notes", "in_planning", {
      key: "DEMO-9",
      summary: "Outline chapters and links.",
      sortOrder: 1080,
      metadata: { priority: "medium", acceptanceCriteria: ["Notes attached to master"] }
    }),
    entity("demo_task_send_report", "task", "Archive send report", "done", {
      key: "DEMO-10",
      summary: "Store last Newsletter Send metrics.",
      sortOrder: 1090,
      metadata: { priority: "medium", acceptanceCriteria: ["Report linked from Distribution"] }
    }),
    entity("demo_task_clip_pilot", "task", "Clip pilot batch", "canceled", {
      key: "DEMO-11",
      summary: "Pilot three clips — canceled with Clip Farm.",
      sortOrder: 1100,
      metadata: { priority: "low", acceptanceCriteria: ["Decision logged"] }
    }),
    entity("demo_task_audience_survey", "task", "Audience survey pulse", "planned", {
      key: "DEMO-12",
      summary: "Quick pulse on Distribution channel health.",
      sortOrder: 1110,
      metadata: { priority: "medium", acceptanceCriteria: ["20 responses or two weeks"] }
    }),
    entity("demo_task_style_guide", "task", "Tone style guide update", "in_progress", {
      key: "DEMO-13",
      summary: "Align Brief Kit tone with season themes.",
      sortOrder: 1120,
      metadata: { priority: "medium", acceptanceCriteria: ["Guide diff reviewed"] }
    }),
    entity("demo_task_broll_list", "task", "B-roll shot list", "planned", {
      key: "DEMO-14",
      summary: "Shots for Recording Day B-roll.",
      sortOrder: 1130,
      metadata: { priority: "low", acceptanceCriteria: ["List taped to camera cart"] }
    })
  ];

  const relations: EntityRelation[] = [
    // Root → aspects
    rel("demo_rel_root_editorial", "demo_root", "demo_aspect_editorial", "contains", true),
    rel("demo_rel_root_production", "demo_root", "demo_aspect_production", "contains", true),
    rel("demo_rel_root_distribution", "demo_root", "demo_aspect_distribution", "contains", true),
    // Nested aspect
    rel("demo_rel_editorial_season", "demo_aspect_editorial", "demo_aspect_season", "contains", true),

    // Features → aspects
    rel("demo_rel_brief_editorial", "demo_feat_brief_kit", "demo_aspect_editorial", "implements", true),
    rel("demo_rel_calendar_editorial", "demo_feat_issue_calendar", "demo_aspect_editorial", "implements", true),
    rel("demo_rel_arc_season", "demo_feat_arc_outline", "demo_aspect_season", "implements", true),
    rel("demo_rel_record_production", "demo_feat_recording_day", "demo_aspect_production", "implements", true),
    rel("demo_rel_edit_production", "demo_feat_edit_pass", "demo_aspect_production", "affects", true),
    rel("demo_rel_send_distribution", "demo_feat_newsletter_send", "demo_aspect_distribution", "implements", true),
    rel("demo_rel_clip_distribution", "demo_feat_clip_farm", "demo_aspect_distribution", "affects", true),

    // Nested feature under Issue Calendar
    rel("demo_rel_calendar_guests", "demo_feat_issue_calendar", "demo_feat_guest_slots", "contains", true),
    rel("demo_rel_guests_editorial", "demo_feat_guest_slots", "demo_aspect_editorial", "supports", false),

    // Tasks → features / aspects
    rel("demo_rel_t1", "demo_task_intake_prompts", "demo_feat_brief_kit", "implements", true),
    rel("demo_rel_t2", "demo_task_assign_owners", "demo_feat_issue_calendar", "implements", true),
    rel("demo_rel_t3", "demo_task_lock_themes", "demo_feat_issue_calendar", "affects", true),
    rel("demo_rel_t4", "demo_task_guest_outreach", "demo_feat_guest_slots", "implements", true),
    rel("demo_rel_t5", "demo_task_season_bible", "demo_feat_arc_outline", "implements", true),
    rel("demo_rel_t6", "demo_task_book_studio", "demo_feat_recording_day", "implements", true),
    rel("demo_rel_t7", "demo_task_mic_check", "demo_feat_recording_day", "affects", true),
    rel("demo_rel_t8", "demo_task_rough_cut", "demo_feat_edit_pass", "implements", true),
    rel("demo_rel_t9", "demo_task_show_notes", "demo_feat_edit_pass", "affects", true),
    rel("demo_rel_t10", "demo_task_send_report", "demo_feat_newsletter_send", "implements", true),
    rel("demo_rel_t11", "demo_task_clip_pilot", "demo_feat_clip_farm", "implements", true),
    rel("demo_rel_t12", "demo_task_audience_survey", "demo_aspect_distribution", "investigates", true),
    rel("demo_rel_t13", "demo_task_style_guide", "demo_feat_brief_kit", "affects", true),
    rel("demo_rel_t14", "demo_task_broll_list", "demo_feat_recording_day", "affects", true)
  ];

  const tags = [
    { id: "demo_tag_newsletter", projectId: PROJECT_ID, slug: "newsletter", label: "Newsletter", kind: "domain" as const },
    { id: "demo_tag_podcast", projectId: PROJECT_ID, slug: "podcast", label: "Podcast", kind: "domain" as const },
    { id: "demo_tag_ops", projectId: PROJECT_ID, slug: "ops", label: "Ops", kind: "workflow" as const }
  ];

  const tagAssignments = [
    { id: "demo_ta_1", tagId: "demo_tag_newsletter", entityId: "demo_feat_newsletter_send" },
    { id: "demo_ta_2", tagId: "demo_tag_newsletter", entityId: "demo_feat_brief_kit" },
    { id: "demo_ta_3", tagId: "demo_tag_podcast", entityId: "demo_feat_recording_day" },
    { id: "demo_ta_4", tagId: "demo_tag_podcast", entityId: "demo_feat_edit_pass" },
    { id: "demo_ta_5", tagId: "demo_tag_ops", entityId: "demo_aspect_production" },
    { id: "demo_ta_6", tagId: "demo_tag_ops", entityId: "demo_task_book_studio" }
  ];

  return {
    project: {
      id: PROJECT_ID,
      key: EXAMPLE_PROJECT_KEY,
      title: "Signal Desk",
      description: "Example editorial content pipeline (newsletter + podcast) for Graph, Workspace, and Kanban demos."
    },
    entities,
    relations,
    tags,
    tagAssignments
  };
}

export async function createExampleProject(db: DatabaseSync): Promise<{ project: ProjectSummary }> {
  const existing = db.prepare("SELECT id FROM projects WHERE key = ?").get(EXAMPLE_PROJECT_KEY);
  if (existing) {
    throw new Error(`Example project ${EXAMPLE_PROJECT_KEY} already exists. Delete it to recreate.`);
  }

  await importGenericPlan(db, buildSignalDeskExamplePlan());

  const project = (await listProjects(db)).find((item) => item.key === EXAMPLE_PROJECT_KEY);
  if (!project) {
    throw new Error("Example project imported but could not be reloaded.");
  }
  return { project };
}
