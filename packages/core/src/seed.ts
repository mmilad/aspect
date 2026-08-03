import { buildNodePath } from "./paths";
import type {
  DraftChange,
  DraftPlan,
  Feature,
  FeatureAspectLink,
  LegacyEntityRelation,
  ProjectNode,
  ProjectPlanSnapshot,
  ProjectRelation,
  Tag,
  TagAssignment,
  Task,
  TaskLink
} from "./types";

type SeedNodeInput = Omit<ProjectNode, "projectId" | "path" | "sortOrder"> & {
  children?: SeedNodeInput[];
};

const project = {
  id: "project_self",
  key: "PLAN",
  title: "Projectplaner",
  description: "A local graph-first planning tool where aspects, tasks and relationships stay navigable."
};

const nodeInputs: SeedNodeInput[] = [
  {
    id: "node_project",
    parentId: null,
    type: "project",
    slug: "projectplaner",
    title: "Projectplaner",
    summary: "The product should plan projects through nested aspects and bidirectional relationships.",
    body: "Aspects are meaning anchors. They can contain subaspects, tasks, references and relationships so people and AI can understand which part of a project a new task affects.",
    status: "active",
    metadata: {
      purpose: "Make project planning addressable, explainable and conflict-checkable.",
      principles: [
        "Graph is primary navigation.",
        "Aspects describe what should exist or hold.",
        "Tasks attach to affected aspects.",
        "Relations should help humans and AI move in both directions."
      ],
      nonGoals: ["Auth", "multi-user sync", "MCP", "embeddings"]
    },
    children: [
      {
        id: "node_app",
        parentId: "node_project",
        type: "aspect",
        slug: "should-have-application-shell",
        title: "Should have Application Shell",
        summary: "The planner should open into a focused local application shell.",
        body: "This aspect is satisfied when the user can orient inside a project without starting from docs or issue lists.",
        status: "in_work",
        metadata: {
          statement: "The product should have an application shell.",
          why: "A planning tool needs a stable work surface before issues become useful.",
          affectedByTasks: "Any task that changes app layout, navigation or workspace composition should attach here or to a subaspect.",
          evidence: ["Local Next.js app", "project route", "graph-centered workspace"],
          implementationSignal: "If a child aspect has open work, this aspect should be treated as in work."
        },
        children: [
          {
            id: "node_project_home",
            parentId: "node_app",
            type: "aspect",
            slug: "should-open-project-home",
            title: "Should open Project Home",
            summary: "The root URL should open the active project plan.",
            body: "The home entry is satisfied when opening the app lands directly in a useful planning context.",
            status: "implemented",
            metadata: {
              statement: "The app should open a project home by default.",
              why: "The first screen should be the planning surface, not marketing or setup.",
              affectedByTasks: "Routing and seed-loading tasks affect this aspect.",
              evidence: ["/ redirects to /projects/PLAN"],
              implementationSignal: "HTTP /projects/PLAN returns 200."
            }
          },
          {
            id: "node_workspace",
            parentId: "node_app",
            type: "aspect",
            slug: "should-have-project-workspace",
            title: "Should have Project Workspace",
            summary: "The app should provide one workspace where graph, details and later issue views cooperate.",
            body: "The workspace is the main planning surface. Tabs and panels should change the main view without hiding aspect relationships.",
            status: "in_work",
            metadata: {
              statement: "The product should have a project workspace.",
              why: "Planning should start with affected aspects, not detached task lists.",
              affectedByTasks: "Canvas, inspector, tab layout and issue-view tasks attach under this aspect.",
              evidence: ["graph canvas", "selected aspect inspector", "draft conflict visibility"],
              implementationSignal: "Graph remains available while tabs change the main planning view."
            },
            children: [
              {
                id: "node_graph_view",
                parentId: "node_workspace",
                type: "aspect",
                slug: "should-navigate-by-scoped-graph",
                title: "Should navigate by Scoped Graph",
                summary: "Double-clicking an aspect should open a graph centered on that aspect.",
                body: "The graph is the primary navigation surface. A node can be selected for detail or opened as the new center.",
                status: "in_work",
                metadata: {
                  statement: "The workspace should navigate by scoped graph.",
                  why: "An aspect should unfold into its own local planning map.",
                  affectedByTasks: "Graph interaction, drag behavior, layout and focus-navigation tasks affect this aspect.",
                  evidence: ["double-click scope change", "center node layout", "parent back navigation"],
                  implementationSignal: "Double-clicking Application Shell centers the graph on Application Shell."
                }
              },
              {
                id: "node_sidebar",
                parentId: "node_workspace",
                type: "aspect",
                slug: "should-have-sidebar",
                title: "Should have Sidebar",
                summary: "The workspace should have a sidebar for regular project operation views.",
                body: "The sidebar is not the primary planning navigation. It should host tabs such as issues, kanban and graph controls that change the main view.",
                status: "not_implemented",
                metadata: {
                  statement: "The workspace should have a sidebar.",
                  why: "Operational views need a predictable place without taking over the aspect graph.",
                  affectedByTasks: "Any issue, board or tab-navigation task should point to this aspect or its subaspects.",
                  evidence: ["planned sidebar", "planned project tab section"],
                  implementationSignal: "Sidebar can switch the main view while preserving selected aspect context."
                },
                children: [
                  {
                    id: "node_sidebar_tabs",
                    parentId: "node_sidebar",
                    type: "aspect",
                    slug: "should-have-dynamic-project-tabs",
                    title: "Should have Dynamic Project Tab Section",
                    summary: "Sidebar tabs should switch the main workspace view for the current project.",
                    body: "Tabs are project-specific entry points into issues, kanban and graph views.",
                    status: "not_implemented",
                    metadata: {
                      statement: "The sidebar should have a dynamic project tab section.",
                      why: "Different projects need different planning surfaces without losing aspect context.",
                      affectedByTasks: "Tab state, tab registry and main-view switching tasks attach here.",
                      evidence: ["planned Issues tab", "planned Kanban tab", "planned Graph tab"],
                      implementationSignal: "Changing tabs updates the main view while keeping the same selected aspect."
                    },
                    children: [
                      {
                        id: "node_tab_issues",
                        parentId: "node_sidebar_tabs",
                        type: "aspect",
                        slug: "should-show-issues",
                        title: "Should show Issues",
                        summary: "A project tab should show issue/task lists affected by the current aspect.",
                        body: "The issues view should answer which tasks are open and which aspect each task affects.",
                        status: "not_implemented",
                        metadata: {
                          statement: "The project tabs should include Issues.",
                          why: "A task is more useful when its affected aspect is explicit.",
                          affectedByTasks: "Issue model, issue list and task-aspect linking tasks attach here.",
                          evidence: ["planned issue tab"],
                          implementationSignal: "Every displayed issue has an affected aspect."
                        }
                      },
                      {
                        id: "node_tab_kanban",
                        parentId: "node_sidebar_tabs",
                        type: "aspect",
                        slug: "should-show-kanban-board",
                        title: "Should show Kanban Board",
                        summary: "A project tab should show tasks by status without replacing aspect planning.",
                        body: "Kanban is an operational view over aspect-attached tasks.",
                        status: "not_implemented",
                        metadata: {
                          statement: "The project tabs should include Kanban.",
                          why: "Status scanning is useful after the affected aspect is known.",
                          affectedByTasks: "Board columns, drag status changes and task filtering attach here.",
                          evidence: ["planned kanban tab"],
                          implementationSignal: "Moving a card keeps its affected aspect relationship."
                        }
                      },
                      {
                        id: "node_tab_graph",
                        parentId: "node_sidebar_tabs",
                        type: "aspect",
                        slug: "should-show-graph",
                        title: "Should show Graph",
                        summary: "A project tab should return to the aspect graph as the planning view.",
                        body: "The graph tab is the semantic map of aspects, subaspects and relationships.",
                        status: "in_work",
                        metadata: {
                          statement: "The project tabs should include Graph.",
                          why: "Graph navigation is the core planning mode.",
                          affectedByTasks: "Canvas, relationship rendering and focus behavior attach here.",
                          evidence: ["current React Flow canvas"],
                          implementationSignal: "The graph can center on any aspect."
                        }
                      }
                    ]
                  }
                ]
              },
              {
                id: "node_draft_plans",
                parentId: "node_workspace",
                type: "aspect",
                slug: "should-isolate-draft-plans",
                title: "Should isolate Draft Plans",
                summary: "Idea dumps should be conflict-checked before changing accepted aspects.",
                body: "Drafts are plan branches with proposed changes and conflict checks.",
                status: "not_implemented",
                metadata: {
                  statement: "Draft planning should stay isolated.",
                  why: "Rough ideas must not pollute accepted project structure.",
                  affectedByTasks: "Draft creation, conflict checking and merge tasks attach here.",
                  evidence: ["draft_plans", "draft_changes", "conflict checks"],
                  implementationSignal: "A draft can report conflicts without mutating aspects."
                }
              }
            ]
          }
        ]
      },
      {
        id: "node_domain",
        parentId: "node_project",
        type: "aspect",
        slug: "should-have-queryable-domain-model",
        title: "Should have Queryable Domain Model",
        summary: "The data model should be generic, extensible and queryable.",
        body: "The domain model keeps stable relational fields queryable and flexible payloads extensible.",
        status: "in_work",
        metadata: {
          statement: "The planner should have a queryable domain model.",
          why: "Later MCP and embeddings need a clean graph of anchors, not loose docs.",
          affectedByTasks: "Schema, relation and retrieval tasks attach here.",
          evidence: ["nodes", "relations", "draft plans", "typed core plus JSON"],
          implementationSignal: "Core data can be queried by project, path, parent, relation and draft scope."
        },
        children: [
          {
            id: "node_addressable_nodes",
            parentId: "node_domain",
            type: "aspect",
            slug: "should-have-addressable-aspects",
            title: "Should have Addressable Aspects",
            summary: "Every meaningful project part has a stable path and title.",
            body: "Aspects are anchors used by humans and AI to know where to crawl for meaning.",
            status: "implemented",
            metadata: {
              statement: "Every meaningful project part should have a stable address.",
              why: "The same concept should be findable by path, title, relationship or later embedding.",
              affectedByTasks: "Path generation, title quality and search tasks attach here.",
              evidence: ["slug", "path", "parentId"],
              implementationSignal: "Stable paths are generated from parent path and slug."
            }
          },
          {
            id: "node_misc",
            parentId: "node_domain",
            type: "aspect",
            slug: "misc",
            title: "Misc",
            summary: "Fallback aspect for work that is not properly classified yet.",
            body: "A task may attach here only when no meaningful aspect or feature is known yet. It should be treated as a planning smell.",
            status: "not_implemented",
            metadata: {
              statement: "The planner should have a visible fallback aspect.",
              why: "Every task needs orientation, even when the orientation is temporarily unclear.",
              affectedByTasks: "Unclassified work attaches here until it can be moved to a better aspect or feature.",
              evidence: ["fallback task link"],
              implementationSignal: "Misc has tasks only when classification still needs work."
            }
          },
          {
            id: "node_agent_orientation",
            parentId: "node_domain",
            type: "aspect",
            slug: "should-orient-agents-through-projectplaner",
            title: "Should orient Agents through Projectplaner",
            summary: "Agents should use the Aspect Graph before and after implementation work.",
            body: "The repository should make Projectplaner itself the first stop for understanding affected aspects, nearby features, and linked tasks. Agent instructions and terminal commands should keep planning context in the graph instead of scattered notes.",
            status: "implemented",
            metadata: {
              statement: "Agents should orient through Projectplaner.",
              why: "AI orientation is a core goal, and the tool should prove that by helping agents navigate this project.",
              affectedByTasks: "Agent workflow documentation, local planning commands and self-planning seed updates attach here.",
              evidence: ["AGENTS.md workflow", "pnpm plan orient", "pnpm plan add-task"],
              implementationSignal: "A fresh agent can inspect graph context and add linked tasks from the terminal."
            }
          },
          {
            id: "node_decision_tree",
            parentId: "node_domain",
            type: "decision",
            slug: "aspect-graph-plus-tree",
            title: "Use Aspect Graph Plus Tree",
            summary: "Nested aspects give ownership; relationships give navigation.",
            body: "A pure graph becomes hard to browse. A pure tree hides cross-cutting impact. The tool needs both.",
            status: "accepted",
            metadata: {
              context: "Project planning needs both stable ownership and cross-cutting references.",
              options: ["tree only", "graph only", "aspect graph plus tree"],
              decision: "Use nested aspects with bidirectional relationships.",
              rationale: "This keeps affected areas explicit while allowing navigation across dependencies.",
              consequences: ["Every aspect has a path.", "Relationships can cross hierarchy boundaries."]
            }
          }
        ]
      }
    ]
  }
];

function flattenNodes(inputs: SeedNodeInput[], parentPath: string | null = null, order = { value: 0 }): ProjectNode[] {
  const flattened: ProjectNode[] = [];
  for (const input of inputs) {
    const path = buildNodePath(parentPath, input.slug);
    flattened.push({
      id: input.id,
      projectId: project.id,
      parentId: input.parentId,
      type: input.type,
      slug: input.slug,
      path,
      title: input.title,
      summary: input.summary,
      body: input.body,
      status: input.status,
      sortOrder: order.value++,
      metadata: input.metadata
    });

    if (input.children) {
      flattened.push(...flattenNodes(input.children, path, order));
    }
  }

  return flattened;
}

const relations: ProjectRelation[] = [
  {
    id: "rel_decision_shapes_workspace",
    projectId: project.id,
    sourceNodeId: "node_decision_tree",
    targetNodeId: "node_workspace",
    type: "affects",
    label: "shapes workspace",
    metadata: {}
  },
  {
    id: "rel_graph_needs_addresses",
    projectId: project.id,
    sourceNodeId: "node_graph_view",
    targetNodeId: "node_addressable_nodes",
    type: "depends_on",
    label: "needs stable ids and paths",
    metadata: {}
  },
  {
    id: "rel_sidebar_switches_workspace",
    projectId: project.id,
    sourceNodeId: "node_sidebar_tabs",
    targetNodeId: "node_workspace",
    type: "affects",
    label: "switches main view",
    metadata: {}
  },
  {
    id: "rel_issues_affect_domain",
    projectId: project.id,
    sourceNodeId: "node_tab_issues",
    targetNodeId: "node_domain",
    type: "depends_on",
    label: "needs task-aspect links",
    metadata: {}
  },
  {
    id: "rel_kanban_depends_issues",
    projectId: project.id,
    sourceNodeId: "node_tab_kanban",
    targetNodeId: "node_tab_issues",
    type: "depends_on",
    label: "uses issue status",
    metadata: {}
  },
  {
    id: "rel_drafts_affect_domain",
    projectId: project.id,
    sourceNodeId: "node_draft_plans",
    targetNodeId: "node_domain",
    type: "affects",
    label: "requires change model",
    metadata: {}
  },
  {
    id: "rel_agent_orientation_depends_addresses",
    projectId: project.id,
    sourceNodeId: "node_agent_orientation",
    targetNodeId: "node_addressable_nodes",
    type: "depends_on",
    label: "needs stable ids for agent commands",
    metadata: {}
  }
];

const draftPlans: DraftPlan[] = [
  {
    id: "draft_conflict_demo",
    projectId: project.id,
    title: "Make issue tabs the primary navigation",
    scopeNodeId: "node_workspace",
    hypothesis: "The app might feel simpler if issues became the first thing users see.",
    status: "draft",
    metadata: {}
  }
];

const draftChanges: DraftChange[] = [
  {
    id: "draft_change_delete_graph",
    draftPlanId: "draft_conflict_demo",
    changeType: "delete",
    targetType: "node",
    targetId: "node_graph_view",
    payload: {}
  },
  {
    id: "draft_change_duplicate_sidebar",
    draftPlanId: "draft_conflict_demo",
    changeType: "create",
    targetType: "node",
    targetId: null,
    payload: {
      parentId: "node_workspace",
      title: "Should have Sidebar",
      type: "aspect"
    }
  }
];

const features: Feature[] = [
  {
    id: "feature_graph_navigation",
    projectId: project.id,
    parentFeatureId: null,
    key: "FEAT-1",
    slug: "graph-navigation",
    title: "Graph Navigation",
    summary: "Navigate planning through focused aspect graphs.",
    body: "Supports double-click scope navigation, breadcrumb recovery and draggable graph layout.",
    status: "in_work",
    acceptanceShape: "A user can move through aspects by graph, breadcrumb and search.",
    sortOrder: 0,
    metadata: {}
  },
  {
    id: "feature_project_sidebar",
    projectId: project.id,
    parentFeatureId: null,
    key: "FEAT-2",
    slug: "project-sidebar",
    title: "Project Sidebar",
    summary: "Operational sidebar for project views.",
    body: "Hosts project-level tabs while preserving aspect context.",
    status: "not_implemented",
    acceptanceShape: "Sidebar can switch operational views without replacing aspect navigation.",
    sortOrder: 1,
    metadata: {}
  },
  {
    id: "feature_project_tabs",
    projectId: project.id,
    parentFeatureId: "feature_project_sidebar",
    key: "FEAT-3",
    slug: "project-tabs",
    title: "Project Tabs",
    summary: "Dynamic tabs for issues, kanban and graph.",
    body: "Defines which main view is active for the current project.",
    status: "not_implemented",
    acceptanceShape: "Tabs switch main views while keeping selected aspect context.",
    sortOrder: 2,
    metadata: {}
  },
  {
    id: "feature_issue_list",
    projectId: project.id,
    parentFeatureId: "feature_project_tabs",
    key: "FEAT-4",
    slug: "issue-list",
    title: "Issue List",
    summary: "List tasks by affected aspect, status and tags.",
    body: "Shows which tasks are open and which aspect or feature each task affects.",
    status: "not_implemented",
    acceptanceShape: "Each shown task exposes its primary affected aspect or feature.",
    sortOrder: 3,
    metadata: {}
  },
  {
    id: "feature_kanban_board",
    projectId: project.id,
    parentFeatureId: "feature_project_tabs",
    key: "FEAT-5",
    slug: "kanban-board",
    title: "Kanban Board",
    summary: "Status board over aspect-linked tasks.",
    body: "Kanban is an operational task view, not the primary planning model.",
    status: "not_implemented",
    acceptanceShape: "Moving a card keeps its task-to-aspect orientation.",
    sortOrder: 4,
    metadata: {}
  },
  {
    id: "feature_agent_orientation",
    projectId: project.id,
    parentFeatureId: null,
    key: "FEAT-6",
    slug: "agent-orientation",
    title: "Agent Orientation",
    summary: "Terminal-friendly project navigation for Codex and future agents.",
    body: "Gives agents a quick way to inspect relevant aspects, features, open work and add new linked tasks before implementation details drift away from the graph.",
    status: "implemented",
    acceptanceShape: "An agent can run one command to orient and another to add a task linked to an Aspect or Feature.",
    sortOrder: 5,
    metadata: {}
  }
];

const featureAspectLinks: FeatureAspectLink[] = [
  { id: "fal_graph", featureId: "feature_graph_navigation", aspectId: "node_graph_view", type: "implements", isPrimary: true },
  { id: "fal_sidebar", featureId: "feature_project_sidebar", aspectId: "node_sidebar", type: "implements", isPrimary: true },
  { id: "fal_tabs", featureId: "feature_project_tabs", aspectId: "node_sidebar_tabs", type: "implements", isPrimary: true },
  { id: "fal_issues", featureId: "feature_issue_list", aspectId: "node_tab_issues", type: "implements", isPrimary: true },
  { id: "fal_kanban", featureId: "feature_kanban_board", aspectId: "node_tab_kanban", type: "implements", isPrimary: true },
  { id: "fal_agent_orientation", featureId: "feature_agent_orientation", aspectId: "node_agent_orientation", type: "implements", isPrimary: true }
];

const tasks: Task[] = [
  {
    id: "task_graph_drag",
    projectId: project.id,
    key: "PLAN-1",
    title: "Make graph nodes draggable in the current session",
    description: "Keep graph nodes movable during a planning session so the canvas feels alive.",
    status: "doing",
    priority: "high",
    acceptanceCriteria: ["Dragging a node updates its position immediately.", "Double-click still opens the node as scope."],
    sortOrder: 0,
    metadata: {}
  },
  {
    id: "task_sidebar_model",
    projectId: project.id,
    key: "PLAN-2",
    title: "Model sidebar as operational tabs, not primary planning navigation",
    description: "Keep sidebar useful for issues and boards without replacing aspect graph navigation.",
    status: "todo",
    priority: "medium",
    acceptanceCriteria: ["Sidebar aspect has tab subaspects.", "Issue/Kanban/Graph tabs are addressable aspects."],
    sortOrder: 1,
    metadata: {}
  },
  {
    id: "task_task_aspect_links",
    projectId: project.id,
    key: "PLAN-3",
    title: "Every issue should declare its affected aspect",
    description: "Make affected aspect or feature explicit on every task.",
    status: "todo",
    priority: "critical",
    acceptanceCriteria: ["Issue list can group by affected aspect.", "Opening an issue can navigate to its aspect graph."],
    sortOrder: 2,
    metadata: {}
  },
  {
    id: "task_draft_conflicts",
    projectId: project.id,
    key: "PLAN-4",
    title: "Show detected draft conflicts in the inspector",
    description: "Surface plan conflicts where draft plans are reviewed.",
    status: "todo",
    priority: "medium",
    acceptanceCriteria: ["Missing target conflicts are errors.", "Duplicate sibling titles are warnings."],
    sortOrder: 3,
    metadata: {}
  },
  {
    id: "task_misc_fallback",
    projectId: project.id,
    key: "PLAN-5",
    title: "Classify unplaced task planning notes",
    description: "Temporary fallback task demonstrating that every task still needs at least one aspect.",
    status: "todo",
    priority: "low",
    acceptanceCriteria: ["Task is visible under Misc.", "Task can later move to a real aspect or feature."],
    sortOrder: 4,
    metadata: {}
  },
  {
    id: "task_breadcrumb_navigation",
    projectId: project.id,
    key: "PLAN-6",
    title: "Add breadcrumb navigation for centered aspects",
    description: "Keep graph focus recoverable when the user drills into nested aspects.",
    status: "done",
    priority: "high",
    acceptanceCriteria: ["Breadcrumb truncates long paths.", "Clicking a breadcrumb centers that aspect."],
    sortOrder: 5,
    metadata: {}
  },
  {
    id: "task_kanban_status_filters",
    projectId: project.id,
    key: "PLAN-7",
    title: "Plan status filters for the Kanban tab",
    description: "Define how task status filters should work without replacing aspect planning.",
    status: "todo",
    priority: "low",
    acceptanceCriteria: ["Kanban can filter by status.", "Cards keep their primary aspect or feature link."],
    sortOrder: 6,
    metadata: {}
  },
  {
    id: "task_tag_filters",
    projectId: project.id,
    key: "PLAN-8",
    title: "Expose tag filters for task and aspect inspection",
    description: "Let orthogonal labels narrow work without becoming structural ownership.",
    status: "todo",
    priority: "medium",
    acceptanceCriteria: ["Tags filter task lists.", "Tags can apply to aspects, features and tasks."],
    sortOrder: 7,
    metadata: {}
  },
  {
    id: "task_agent_workflow_docs",
    projectId: project.id,
    key: "PLAN-9",
    title: "Document Projectplaner as the agent orientation workflow",
    description: "Tell Codex and future agents to inspect the Aspect Graph before work and record affected features or tasks after work.",
    status: "done",
    priority: "high",
    acceptanceCriteria: ["AGENTS.md names the planning commands.", "The workflow preserves the rule that every task links to an Aspect or Feature."],
    sortOrder: 8,
    metadata: {}
  },
  {
    id: "task_agent_plan_cli",
    projectId: project.id,
    key: "PLAN-10",
    title: "Provide terminal commands for agent graph orientation",
    description: "Add a repo-native command that lets agents summarize the project graph and create linked planning tasks.",
    status: "done",
    priority: "high",
    acceptanceCriteria: ["Agents can run an orientation command from the repo root.", "Agents can create a task only when it links to an Aspect or Feature."],
    sortOrder: 9,
    metadata: {}
  }
];

const taskLinks: TaskLink[] = [
  { id: "tl_graph_feature", taskId: "task_graph_drag", targetType: "feature", targetId: "feature_graph_navigation", type: "implements", isPrimary: true },
  { id: "tl_graph_aspect", taskId: "task_graph_drag", targetType: "aspect", targetId: "node_graph_view", type: "affects", isPrimary: false },
  { id: "tl_sidebar_feature", taskId: "task_sidebar_model", targetType: "feature", targetId: "feature_project_sidebar", type: "implements", isPrimary: true },
  { id: "tl_sidebar_aspect", taskId: "task_sidebar_model", targetType: "aspect", targetId: "node_sidebar", type: "affects", isPrimary: false },
  { id: "tl_issue_feature", taskId: "task_task_aspect_links", targetType: "feature", targetId: "feature_issue_list", type: "implements", isPrimary: true },
  { id: "tl_issue_aspect", taskId: "task_task_aspect_links", targetType: "aspect", targetId: "node_tab_issues", type: "affects", isPrimary: false },
  { id: "tl_draft_aspect", taskId: "task_draft_conflicts", targetType: "aspect", targetId: "node_draft_plans", type: "validates", isPrimary: true },
  { id: "tl_misc_aspect", taskId: "task_misc_fallback", targetType: "aspect", targetId: "node_misc", type: "investigates", isPrimary: true },
  { id: "tl_breadcrumb_graph", taskId: "task_breadcrumb_navigation", targetType: "feature", targetId: "feature_graph_navigation", type: "implements", isPrimary: true },
  { id: "tl_kanban_feature", taskId: "task_kanban_status_filters", targetType: "feature", targetId: "feature_kanban_board", type: "investigates", isPrimary: true },
  { id: "tl_tag_filters_issue", taskId: "task_tag_filters", targetType: "feature", targetId: "feature_issue_list", type: "implements", isPrimary: true },
  { id: "tl_tag_filters_domain", taskId: "task_tag_filters", targetType: "aspect", targetId: "node_domain", type: "affects", isPrimary: false },
  { id: "tl_agent_workflow_docs_feature", taskId: "task_agent_workflow_docs", targetType: "feature", targetId: "feature_agent_orientation", type: "implements", isPrimary: true },
  { id: "tl_agent_workflow_docs_aspect", taskId: "task_agent_workflow_docs", targetType: "aspect", targetId: "node_agent_orientation", type: "affects", isPrimary: false },
  { id: "tl_agent_plan_cli_feature", taskId: "task_agent_plan_cli", targetType: "feature", targetId: "feature_agent_orientation", type: "implements", isPrimary: true },
  { id: "tl_agent_plan_cli_aspect", taskId: "task_agent_plan_cli", targetType: "aspect", targetId: "node_agent_orientation", type: "affects", isPrimary: false }
];

const entityRelations: LegacyEntityRelation[] = [
  { id: "er_task_issue_depends_graph", projectId: project.id, sourceType: "task", sourceId: "task_task_aspect_links", targetType: "task", targetId: "task_graph_drag", type: "depends_on", label: "needs task links visible in graph context", metadata: {} },
  { id: "er_kanban_depends_issue_list", projectId: project.id, sourceType: "feature", sourceId: "feature_kanban_board", targetType: "feature", targetId: "feature_issue_list", type: "depends_on", label: "uses issue status data", metadata: {} },
  { id: "er_sidebar_supports_workspace", projectId: project.id, sourceType: "feature", sourceId: "feature_project_sidebar", targetType: "aspect", targetId: "node_workspace", type: "supports", label: "adds operational views", metadata: {} },
  { id: "er_tabs_affect_sidebar", projectId: project.id, sourceType: "feature", sourceId: "feature_project_tabs", targetType: "aspect", targetId: "node_sidebar_tabs", type: "affects", label: "implements dynamic tab section", metadata: {} },
  { id: "er_misc_conflicts_orientation", projectId: project.id, sourceType: "task", sourceId: "task_misc_fallback", targetType: "aspect", targetId: "node_addressable_nodes", type: "blocked_by", label: "needs proper classification", metadata: {} }
  ,
  { id: "er_tag_filters_depend_issue", projectId: project.id, sourceType: "task", sourceId: "task_tag_filters", targetType: "feature", targetId: "feature_issue_list", type: "depends_on", label: "needs issue list filters", metadata: {} },
  { id: "er_kanban_depend_tags", projectId: project.id, sourceType: "task", sourceId: "task_kanban_status_filters", targetType: "task", targetId: "task_tag_filters", type: "related_to", label: "shares filtering model", metadata: {} },
  { id: "er_agent_cli_depends_task_links", projectId: project.id, sourceType: "task", sourceId: "task_agent_plan_cli", targetType: "task", targetId: "task_task_aspect_links", type: "depends_on", label: "uses required task links", metadata: {} },
  { id: "er_agent_orientation_supports_domain", projectId: project.id, sourceType: "feature", sourceId: "feature_agent_orientation", targetType: "aspect", targetId: "node_domain", type: "supports", label: "keeps self-planning queryable", metadata: {} }
];

const tags: Tag[] = [
  { id: "tag_business_critical", projectId: project.id, slug: "business-critical", label: "business critical", kind: "priority" },
  { id: "tag_nice_to_have", projectId: project.id, slug: "nice-to-have", label: "nice to have", kind: "priority" },
  { id: "tag_frontend", projectId: project.id, slug: "frontend", label: "frontend", kind: "domain" },
  { id: "tag_planning_model", projectId: project.id, slug: "planning-model", label: "planning model", kind: "domain" },
  { id: "tag_ux", projectId: project.id, slug: "ux", label: "ux", kind: "domain" }
];

const tagAssignments: TagAssignment[] = [
  { id: "ta_graph_ux", tagId: "tag_ux", targetType: "aspect", targetId: "node_graph_view" },
  { id: "ta_sidebar_frontend", tagId: "tag_frontend", targetType: "aspect", targetId: "node_sidebar" },
  { id: "ta_issue_business", tagId: "tag_business_critical", targetType: "feature", targetId: "feature_issue_list" },
  { id: "ta_kanban_nice", tagId: "tag_nice_to_have", targetType: "feature", targetId: "feature_kanban_board" },
  { id: "ta_task_links_model", tagId: "tag_planning_model", targetType: "task", targetId: "task_task_aspect_links" },
  { id: "ta_graph_task_frontend", tagId: "tag_frontend", targetType: "task", targetId: "task_graph_drag" },
  { id: "ta_breadcrumb_ux", tagId: "tag_ux", targetType: "task", targetId: "task_breadcrumb_navigation" },
  { id: "ta_kanban_nice_task", tagId: "tag_nice_to_have", targetType: "task", targetId: "task_kanban_status_filters" },
  { id: "ta_tag_filters_model", tagId: "tag_planning_model", targetType: "task", targetId: "task_tag_filters" },
  { id: "ta_agent_orientation_model", tagId: "tag_planning_model", targetType: "aspect", targetId: "node_agent_orientation" },
  { id: "ta_agent_orientation_feature_model", tagId: "tag_planning_model", targetType: "feature", targetId: "feature_agent_orientation" },
  { id: "ta_agent_workflow_docs_model", tagId: "tag_planning_model", targetType: "task", targetId: "task_agent_workflow_docs" },
  { id: "ta_agent_plan_cli_model", tagId: "tag_planning_model", targetType: "task", targetId: "task_agent_plan_cli" }
];

export const selfPlanningSeed: ProjectPlanSnapshot = {
  project,
  nodes: flattenNodes(nodeInputs),
  relations,
  draftPlans,
  draftChanges,
  features,
  featureAspectLinks,
  tasks,
  taskLinks,
  entityRelations,
  tags,
  tagAssignments
};
