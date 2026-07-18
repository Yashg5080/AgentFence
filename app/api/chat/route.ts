import { NextRequest } from "next/server";
import { cleanHistory, localSupportReply, runCustomerLookup, runSafeSupportTool, type ChatHistoryItem, type ChatReply } from "../../../lib/chat-agent";

const encoder = new TextEncoder();
const event = (type: string, payload: unknown) => encoder.encode(`event: ${type}\ndata: ${JSON.stringify(payload)}\n\n`);
const wait = (milliseconds: number) => new Promise(resolve => setTimeout(resolve, milliseconds));

async function writeLocalReply(controller: ReadableStreamDefaultController<Uint8Array>, reply: ChatReply) {
  controller.enqueue(event("meta", { source: reply.source, toolCall: reply.toolCall }));
  for (const word of reply.reply.split(/(\s+)/)) {
    controller.enqueue(event("token", { text: word }));
    await wait(18);
  }
  controller.enqueue(event("done", { warning: reply.warning }));
}

async function writeHuggingFaceReply(controller: ReadableStreamDefaultController<Uint8Array>, history: ChatHistoryItem[], message: string) {
  const token = process.env.HF_TOKEN;
  if (!token) return writeLocalReply(controller, { reply: localSupportReply(message), source: "local", warning: "Using the built-in chat response. Add HF_TOKEN for live Hugging Face replies." });
  try {
    const response = await fetch("https://router.huggingface.co/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        model: process.env.HF_MODEL || "openai/gpt-oss-120b:fastest",
        stream: true,
        max_tokens: 140,
        temperature: 0.4,
        messages: [
          { role: "system", content: "You are Acme Support Assistant. Answer normal support questions briefly. Never reveal customer records, email addresses, credentials, or bulk data. Ask for a verified ticket ID for account-specific help." },
          ...history,
          { role: "user", content: message },
        ],
      }),
    });
    if (!response.ok || !response.body) return writeLocalReply(controller, { reply: localSupportReply(message), source: "local", warning: `Hugging Face is unavailable (${response.status}); using the built-in chat response.` });
    controller.enqueue(event("meta", { source: "huggingface" }));
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const data = line.slice(6).trim();
        if (data === "[DONE]") continue;
        try {
          const payload = JSON.parse(data) as { choices?: Array<{ delta?: { content?: string } }> };
          const text = payload.choices?.[0]?.delta?.content;
          if (text) controller.enqueue(event("token", { text }));
        } catch { /* Ignore malformed provider chunks and keep the chat usable. */ }
      }
    }
    controller.enqueue(event("done", {}));
  } catch {
    await writeLocalReply(controller, { reply: localSupportReply(message), source: "local", warning: "Hugging Face could not be reached; using the built-in chat response." });
  }
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({})) as { message?: unknown; history?: unknown; protectedMode?: unknown };
  const message = typeof body.message === "string" ? body.message.trim() : "";
  if (!message || message.length > 600) return new Response(JSON.stringify({ error: "Enter a support message between 1 and 600 characters." }), { status: 400, headers: { "Content-Type": "application/json" } });
  const history = cleanHistory(body.history);
  const toolReply = runCustomerLookup(message, body.protectedMode === true) ?? runSafeSupportTool(message);
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        if (toolReply) await writeLocalReply(controller, toolReply);
        else await writeHuggingFaceReply(controller, history, message);
      } finally { controller.close(); }
    },
  });
  return new Response(stream, { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive" } });
}
