import { NextResponse } from "next/server";
import { getDatabaseController } from "@projectplaner/db";
import { parseAgentProfile } from "@projectplaner/core";
export async function GET(request: Request) {
    const projectKey = new URL(request.url).searchParams.get("projectKey")?.trim() || "PLAN";
    try {
        const entities = await getDatabaseController().entities.list({
            projectKey,
            type: "agent"
        });
        return NextResponse.json({
            agents: entities.map((entity) => {
                const profile = parseAgentProfile(entity.metadata);
                return {
                    id: entity.id,
                    name: entity.title,
                    role: profile.role,
                    capabilities: profile.capabilities,
                    registeredCapabilities: profile.registeredCapabilities
                };
            })
        });
    }
    catch (error) {
        return NextResponse.json({
            error: error instanceof Error ? error.message : "Could not load agents."
        }, {
            status: 500
        });
    }
}
