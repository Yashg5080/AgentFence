import type { Guardrail, SecurityRun } from "./types";

type StoredRun = { run: SecurityRun; guardrail?: Guardrail };
const runs = new Map<string, StoredRun>();

export function saveRun(run: SecurityRun) { runs.set(run.runId, { run }); }
export function getRun(id: string) { return runs.get(id); }
export function saveGuardrail(id: string, guardrail: Guardrail) {
  const stored = runs.get(id);
  if (!stored) return undefined;
  stored.guardrail = guardrail;
  return stored;
}
