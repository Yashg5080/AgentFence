import { localGuardrail } from "./demo-agent";
import type { Guardrail, SecurityRun } from "./types";

const schema = {
  type: "object",
  additionalProperties: false,
  required: ["policyTitle", "policyRules", "testName", "testSteps", "explanation"],
  properties: {
    policyTitle: { type: "string" },
    policyRules: { type: "array", items: { type: "string" } },
    testName: { type: "string" },
    testSteps: { type: "array", items: { type: "string" } },
    explanation: { type: "string" },
  },
};

function validGuardrail(value: unknown): value is Omit<Guardrail, "source"> {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  return typeof item.policyTitle === "string" && Array.isArray(item.policyRules) && typeof item.testName === "string" && Array.isArray(item.testSteps) && typeof item.explanation === "string";
}

export async function generateGuardrail(run: SecurityRun): Promise<{ guardrail: Guardrail; warning?: string }> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return { guardrail: localGuardrail, warning: "Using the local demo guardrail. Add OPENAI_API_KEY to generate a live AI review." };

  const fallback = (reason: string) => ({ guardrail: localGuardrail, warning: `${reason} AgentFence is using its local demo guardrail instead.` });
  try {
    const context = JSON.stringify({ prompt: run.prompt, tool: run.toolCall, policyDecision: run.policyDecision, outcome: run.outcome });
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-5.6",
        input: [
          { role: "system", content: [{ type: "input_text", text: "You are an AI application security engineer. Return a compact guardrail and regression test for the synthetic trace. Do not include real data or instructions to attack real systems." }] },
          { role: "user", content: [{ type: "input_text", text: context }] },
        ],
        text: { format: { type: "json_schema", name: "agentfence_guardrail", strict: true, schema } },
      }),
    });
    if (!response.ok) return fallback(`OpenAI is unavailable (${response.status}).`);
    const payload = await response.json() as { output_text?: string };
    const parsed: unknown = JSON.parse(payload.output_text || "");
    if (!validGuardrail(parsed)) return fallback("OpenAI returned an incomplete guardrail.");
    return { guardrail: { ...parsed, source: "openai" } };
  } catch {
    return fallback("OpenAI could not generate a live guardrail.");
  }
}
