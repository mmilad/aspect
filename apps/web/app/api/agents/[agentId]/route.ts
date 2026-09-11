import { NextResponse } from "next/server";
import { getDatabaseController } from "@projectplaner/db";
import { parseAgentProfile } from "@projectplaner/core";
export async function GET(_: Request, { params }: {
    params: Promise<{
        agentId: string;
    }>;
}) {
    const { agentId } = await params;
    const entity = await getDatabaseController().entities.get(agentId);
    if (!entity || entity.type !== "agent")
        return NextResponse.json({
            error: "Agent not found."
        }, {
            status: 404
        });
    return NextResponse.json({
        entity,
        profile: parseAgentProfile(entity.metadata)
    });
}
