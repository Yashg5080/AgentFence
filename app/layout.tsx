import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AgentFence — AI agent safety proof",
  description: "Attack, trace, fix, and verify an AI agent in one flow.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
