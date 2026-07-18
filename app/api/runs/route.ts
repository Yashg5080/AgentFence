import { NextResponse } from "next/server";
import { createVulnerableRun } from "../../../lib/demo-agent";
import { saveRun } from "../../../lib/run-store";
import type { AttackKind } from "../../../lib/types";

const attackKinds = new Set<AttackKind>(["direct-injection", "ticket-note", "bulk-export"]);

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({})) as { attackKind?: unknown };
  const attackKind = typeof body.attackKind === "string" && attackKinds.has(body.attackKind as AttackKind) ? body.attackKind as AttackKind : "direct-injection";
  const run = createVulnerableRun(attackKind);
  saveRun(run);
  return NextResponse.json({ run });
}
