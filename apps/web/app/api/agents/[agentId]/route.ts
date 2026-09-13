import { NextResponse } from "next/server";
import { getDatabaseController } from "@projectplaner/db";
import { parseAgentProfile, REGISTERED_AGENT_CAPABILITIES } from "@projectplaner/core";

function isRecord(value: unknown): value is Record<string, unknown> {
    return value !== null && typeof value === "object" && !Array.isArray(value);
}

function stringList(value: unknown): string[] | null {
    if (!Array.isArray(value) || value.some(item => typeof item !== "string" || !item.trim())) return null;
    return [...new Set(value.map(item => (item as string).trim()))];
}

async function loadAgent(agentId: string, projectKey: string) {
    const db = getDatabaseController();
    const [entity, project] = await Promise.all([db.entities.get(agentId), db.projects.findByKey(projectKey)]);
    if (!entity || entity.type !== "agent" || entity.status === "archived" || !project || entity.projectId !== project.id) {
        return { db, entity: null };
    }
    return { db, entity };
}

export async function GET(request: Request, { params }: {
    params: Promise<{
        agentId: string;
    }>;
}) {
    const { agentId } = await params;
    const projectKey = new URL(request.url).searchParams.get("projectKey")?.trim() || "PLAN";
    const { db, entity } = await loadAgent(agentId, projectKey);
    if (!entity)
        return NextResponse.json({
            error: "Agent not found."
        }, {
            status: 404
        });
    const profile = parseAgentProfile(entity.metadata);
    const workflows = (await db.entities.list({ projectKey, type: "flow" })).map(flow => ({
        id: flow.id,
        key: typeof flow.metadata.presetKey === "string" ? flow.metadata.presetKey : null,
        title: flow.title
    }));
    return NextResponse.json({
        entity,
        profile,
        availableWorkflows: workflows,
        registeredCapabilities: [...REGISTERED_AGENT_CAPABILITIES]
    });
}

export async function PATCH(request: Request, { params }: {
    params: Promise<{ agentId: string }>;
}) {
    const { agentId } = await params;
    let body: unknown;
    try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON." }, { status: 400 }); }
    const input = isRecord(body) ? body : {};
    const projectKey = typeof input.projectKey === "string" && input.projectKey.trim() ? input.projectKey.trim() : "PLAN";
    const { db, entity } = await loadAgent(agentId, projectKey);
    if (!entity) return NextResponse.json({ error: "Agent not found in project." }, { status: 404 });

    const current = parseAgentProfile(entity.metadata);
    if (current.kind === "assistant") return NextResponse.json({ error: "The reserved Assistant profile cannot be configured here." }, { status: 400 });
    const document = isRecord(entity.metadata.document) ? entity.metadata.document : entity.metadata;
    const next = { ...document };

    if (input.assignedWorkflowIds !== undefined) {
        const ids = stringList(input.assignedWorkflowIds);
        if (!ids) return NextResponse.json({ error: "assignedWorkflowIds must be a list of non-empty strings." }, { status: 400 });
        for (const id of ids) {
            const direct = await db.entities.get(id);
            const preset = direct?.type === "flow" && direct.projectId === entity.projectId
                ? direct
                : await db.presets.find(id, projectKey);
            if (!preset) return NextResponse.json({ error: `Workflow '${id}' is not available in project '${projectKey}'.` }, { status: 400 });
        }
        next.assignedWorkflowIds = ids;
    }

    if (input.registeredCapabilities !== undefined) {
        const capabilities = stringList(input.registeredCapabilities);
        if (!capabilities) return NextResponse.json({ error: "registeredCapabilities must be a list of non-empty strings." }, { status: 400 });
        const unsupported = capabilities.filter(name => !(REGISTERED_AGENT_CAPABILITIES as readonly string[]).includes(name));
        if (unsupported.length) return NextResponse.json({ error: `Unsupported registered capability: ${unsupported.join(", ")}.` }, { status: 400 });
        next.registeredCapabilities = capabilities;
    }

    if (input.memoryPolicy !== undefined) {
        if (!isRecord(input.memoryPolicy)) return NextResponse.json({ error: "memoryPolicy must be an object." }, { status: 400 });
        const enabled = input.memoryPolicy.enabled;
        const scope = input.memoryPolicy.scope;
        if (typeof enabled !== "boolean" || !["global", "personal", "project", "agent", "session"].includes(String(scope))) {
            return NextResponse.json({ error: "memoryPolicy requires boolean enabled and a valid scope." }, { status: 400 });
        }
        next.memoryPolicy = { enabled, scope };
    }

    if (input.contextPolicy !== undefined) {
        if (!isRecord(input.contextPolicy) || typeof input.contextPolicy.memoryEnabled !== "boolean") {
            return NextResponse.json({ error: "contextPolicy requires boolean memoryEnabled." }, { status: 400 });
        }
        const existing = isRecord(next.contextPolicy) ? next.contextPolicy : {};
        next.contextPolicy = { ...existing, memoryEnabled: input.contextPolicy.memoryEnabled };
    }

    const metadata = { ...entity.metadata, document: next };
    const updated = await db.entities.update({ id: entity.id, patch: { metadata } });
    return NextResponse.json({ entity: updated, profile: parseAgentProfile(updated.metadata) });
}
