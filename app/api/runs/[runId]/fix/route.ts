import { NextRequest, NextResponse } from "next/server";
import { generateGuardrail } from "../../../../../lib/fix-generator";
import { getRun, saveGuardrail, saveRun } from "../../../../../lib/run-store";
import type { SecurityRun } from "../../../../../lib/types";

export async function POST(request: NextRequest, context: { params: Promise<{ runId: string }> }) {
  const { runId } = await context.params;
  const stored = getRun(runId);
  const body = await request.json().catch(() => ({})) as { run?: SecurityRun };
  const run = stored?.run ?? body.run;
  if (!run || run.runId !== runId || run.outcome !== "leaked") {
    return NextResponse.json({ error: "Security run is invalid. Start a new run." }, { status: 400 });
  }
  try {
    const { guardrail, warning } = await generateGuardrail(run);
    if (!stored) saveRun(run);
    saveGuardrail(runId, guardrail);
    return NextResponse.json({ run: { ...run, stage: "fix" }, guardrail, warning });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not generate guardrail." }, { status: 502 });
  }
}
