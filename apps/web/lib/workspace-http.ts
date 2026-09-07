import { NextResponse } from "next/server";
import { workspaceFailure } from "@projectplaner/workspace";

export function workspaceHttpError(error: unknown) {
  const failure = workspaceFailure(error);
  const status = failure.code === "not_found" ? 404 : ["conflict", "archived"].includes(failure.code) ? 409 : 400;
  return NextResponse.json({ error: failure }, { status });
}
