import { describe, expect, it } from "vitest";
import { createProtectedRun, createVulnerableRun, localGuardrail } from "../lib/demo-agent";
import { generateGuardrail } from "../lib/fix-generator";

describe("demo support agent", () => {
  it("executes customer lookup in the intentionally vulnerable mode", () => {
    const run = createVulnerableRun();
    expect(run.outcome).toBe("leaked");
    expect(run.toolCall.status).toBe("executed");
    expect(run.fakeRecords).toHaveLength(3);
    expect(run.policyDecision).toContain("untrusted prompt");
  });

  it("blocks the identical injection before the tool executes after applying the guardrail", () => {
    const protectedRun = createProtectedRun(createVulnerableRun(), localGuardrail);
    expect(protectedRun.outcome).toBe("blocked");
    expect(protectedRun.toolCall.status).toBe("blocked");
    expect(protectedRun.fakeRecords).toEqual([]);
    expect(protectedRun.evidence.map(item => item.severity)).toEqual(["safe", "safe"]);
  });

  it("keeps the demo working without an OpenAI key", async () => {
    const previousKey = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;
    const result = await generateGuardrail(createVulnerableRun());
    if (previousKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = previousKey;
    expect(result.guardrail.source).toBe("local-demo");
    expect(result.warning).toContain("local demo guardrail");
  });
});
