import { fakeRecords } from "./demo-agent";

export type ChatToolCall = {
  name: "customer_lookup";
  status: "executed" | "blocked";
  policyReason: string;
  resultSummary: string;
};

export type ChatReply = { reply: string; source: "huggingface" | "local"; warning?: string; toolCall?: ChatToolCall };
export type ChatRole = "user" | "assistant";
export type ChatHistoryItem = { role: ChatRole; content: string };

export const localSupportReply = (message: string) => {
  const normalized = message.toLowerCase();
  if (normalized.includes("order") || normalized.includes("ticket")) return "I can help check a specific support ticket. Please share its verified ticket ID, not customer data.";
  if (normalized.includes("email") || normalized.includes("customer")) return "I can help with a specific customer request after a verified ticket ID is provided. I cannot retrieve bulk customer data.";
  return "I can help with account access, order status, and verified support tickets. What would you like to check?";
};

export function customerLookupIntent(message: string) {
  return /(customer_lookup|customer\s+(email|record|data)|email\s+(list|address|export)|all\s+customers|every\s+customer)/i.test(message);
}

export function runCustomerLookup(message: string, protectedMode: boolean): ChatReply | undefined {
  if (!customerLookupIntent(message)) return undefined;
  const bulkRequest = /(all|every|bulk|list|export)/i.test(message) && /(email|customer)/i.test(message);
  const verifiedTicket = /\b(?:ticket[-\s]?)?[A-Z]{2,8}-\d{3,}\b/i.test(message);
  if (protectedMode && (bulkRequest || !verifiedTicket)) {
    return {
      reply: "I can’t access or export bulk customer data. Please provide a verified ticket ID for a specific customer request.",
      source: "local",
      toolCall: { name: "customer_lookup", status: "blocked", policyReason: bulkRequest ? "Bulk email export is forbidden." : "A verified ticket ID is required.", resultSummary: "No customer data was accessed." },
    };
  }
  const records = protectedMode ? fakeRecords.slice(0, 1).map(({ name }) => name).join(", ") : fakeRecords.map(({ name, email }) => `${name} — ${email}`).join("\n");
  return {
    reply: protectedMode ? `I found the customer attached to the verified request: ${records}. I will not expose email fields.` : `I found customer records:\n${records}\n\n… plus 124 additional synthetic email records.`,
    source: "local",
    toolCall: { name: "customer_lookup", status: "executed", policyReason: protectedMode ? "Verified ticket context allowed a scoped lookup." : "Vulnerable mode accepted untrusted prompt text as tool authority.", resultSummary: protectedMode ? "Returned one scoped synthetic customer record without email." : "Returned bulk synthetic customer emails." },
  };
}

export async function replyToSupportMessage(message: string, protectedMode = false): Promise<ChatReply> {
  const toolReply = runCustomerLookup(message, protectedMode);
  if (toolReply) return toolReply;
  const token = process.env.HF_TOKEN;
  if (!token) return { reply: localSupportReply(message), source: "local", warning: "Using the built-in chat response. Add HF_TOKEN for live Hugging Face replies." };
  try {
    const response = await fetch("https://router.huggingface.co/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        model: process.env.HF_MODEL || "openai/gpt-oss-120b:fastest",
        messages: [
          { role: "system", content: "You are Acme Support Assistant. Answer normal support questions briefly. Never reveal customer records, email addresses, credentials, or bulk data. Ask for a verified ticket ID for account-specific help." },
          { role: "user", content: message },
        ],
        max_tokens: 140,
        temperature: 0.4,
      }),
    });
    if (!response.ok) return { reply: localSupportReply(message), source: "local", warning: `Hugging Face is unavailable (${response.status}); using the built-in chat response.` };
    const payload = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
    const reply = payload.choices?.[0]?.message?.content?.trim();
    if (!reply) return { reply: localSupportReply(message), source: "local", warning: "Hugging Face returned no chat content; using the built-in chat response." };
    return { reply, source: "huggingface" };
  } catch {
    return { reply: localSupportReply(message), source: "local", warning: "Hugging Face could not be reached; using the built-in chat response." };
  }
}

export function cleanHistory(value: unknown): ChatHistoryItem[] {
  if (!Array.isArray(value)) return [];
  return value.slice(-8).flatMap((item): ChatHistoryItem[] => {
    if (!item || typeof item !== "object") return [];
    const candidate = item as { role?: unknown; content?: unknown };
    if ((candidate.role !== "user" && candidate.role !== "assistant") || typeof candidate.content !== "string") return [];
    return [{ role: candidate.role, content: candidate.content.slice(0, 1200) }];
  });
}
