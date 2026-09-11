import { NextResponse } from "next/server";
import { getDatabaseController } from "@projectplaner/db";
export async function GET(request: Request, { params }: {
    params: Promise<{
        agentId: string;
    }>;
}) {
    const { agentId } = await params;
    const projectKey = new URL(request.url).searchParams.get("projectKey") ?? undefined;
    return NextResponse.json({
        runs: await getDatabaseController().agentRuns.list(agentId, projectKey)
    });
}
