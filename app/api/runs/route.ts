import { NextResponse } from "next/server";
import { createVulnerableRun } from "../../../lib/demo-agent";
import { saveRun } from "../../../lib/run-store";

export async function POST() {
  const run = createVulnerableRun();
  saveRun(run);
  return NextResponse.json({ run });
}
