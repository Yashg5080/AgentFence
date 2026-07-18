import { NextRequest, NextResponse } from "next/server";
import { replyToSupportMessage } from "../../../lib/chat-agent";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({})) as { message?: unknown };
  const message = typeof body.message === "string" ? body.message.trim() : "";
  if (!message || message.length > 600) {
    return NextResponse.json({ error: "Enter a support message between 1 and 600 characters." }, { status: 400 });
  }
  return NextResponse.json(await replyToSupportMessage(message));
}
