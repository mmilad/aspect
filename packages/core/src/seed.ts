import { buildNodePath } from "./paths";
import type { DraftChange, DraftPlan, NodeTask, ProjectNode, ProjectPlanSnapshot, ProjectRelation } from "./types";

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

const tasks: NodeTask[] = [
  {
    id: "task_graph_drag",
    nodeId: "node_graph_view",
    title: "Make graph nodes draggable in the current session",
    status: "doing",
    acceptanceCriteria: ["Dragging a node updates its position immediately.", "Double-click still opens the node as scope."],
    sortOrder: 0
  },
  {
    id: "task_sidebar_model",
    nodeId: "node_sidebar",
    title: "Model sidebar as operational tabs, not primary planning navigation",
    status: "todo",
    acceptanceCriteria: ["Sidebar aspect has tab subaspects.", "Issue/Kanban/Graph tabs are addressable aspects."],
    sortOrder: 1
  },
  {
    id: "task_task_aspect_links",
    nodeId: "node_tab_issues",
    title: "Every issue should declare its affected aspect",
    status: "todo",
    acceptanceCriteria: ["Issue list can group by affected aspect.", "Opening an issue can navigate to its aspect graph."],
    sortOrder: 2
  },
  {
    id: "task_draft_conflicts",
    nodeId: "node_draft_plans",
    title: "Show detected draft conflicts in the inspector",
    status: "todo",
    acceptanceCriteria: ["Missing target conflicts are errors.", "Duplicate sibling titles are warnings."],
    sortOrder: 3
  }
];

export const selfPlanningSeed: ProjectPlanSnapshot = {
  project,
  nodes: flattenNodes(nodeInputs),
  relations,
  draftPlans,
  draftChanges,
  tasks
};

