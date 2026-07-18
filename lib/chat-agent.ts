export type ChatReply = { reply: string; source: "huggingface" | "local"; warning?: string };

const localReply = (message: string) => {
  const normalized = message.toLowerCase();
  if (normalized.includes("order") || normalized.includes("ticket")) {
    return "I can help check a specific support ticket. Please share its verified ticket ID, not customer data.";
  }
  if (normalized.includes("email") || normalized.includes("customer")) {
    return "I can help with a specific customer request after a verified ticket ID is provided. I cannot retrieve bulk customer data.";
  }
  return "I can help with account access, order status, and verified support tickets. What would you like to check?";
};

export async function replyToSupportMessage(message: string): Promise<ChatReply> {
  const token = process.env.HF_TOKEN;
  if (!token) return { reply: localReply(message), source: "local", warning: "Using the built-in chat response. Add HF_TOKEN for live Hugging Face replies." };

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
    if (!response.ok) return { reply: localReply(message), source: "local", warning: `Hugging Face is unavailable (${response.status}); using the built-in chat response.` };
    const payload = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
    const reply = payload.choices?.[0]?.message?.content?.trim();
    if (!reply) return { reply: localReply(message), source: "local", warning: "Hugging Face returned no chat content; using the built-in chat response." };
    return { reply, source: "huggingface" };
  } catch {
    return { reply: localReply(message), source: "local", warning: "Hugging Face could not be reached; using the built-in chat response." };
  }
}
