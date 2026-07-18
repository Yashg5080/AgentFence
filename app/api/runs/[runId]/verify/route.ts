import { NextRequest, NextResponse } from "next/server";
import { createProtectedRun } from "../../../../../lib/demo-agent";
import { getRun } from "../../../../../lib/run-store";
import type { Guardrail, SecurityRun } from "../../../../../lib/types";

export async function POST(request: NextRequest, context: { params: Promise<{ runId: string }> }) {
  const { runId } = await context.params;
  const stored = getRun(runId);
  const body = await request.json().catch(() => ({})) as { run?: SecurityRun; guardrail?: Guardrail };
  const run = stored?.run ?? body.run;
  const guardrail = stored?.guardrail ?? body.guardrail;
  if (!run || !guardrail || run.runId !== runId || run.outcome !== "leaked") {
    return NextResponse.json({ error: "Generate a guardrail before verification." }, { status: 400 });
  }
  return NextResponse.json({ run: createProtectedRun(run, guardrail) });
}
