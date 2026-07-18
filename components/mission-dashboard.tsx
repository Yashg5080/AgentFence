"use client";

import { useEffect, useRef, useState } from "react";
import type { FixResponse, Guardrail, RunStage, SecurityRun } from "../lib/types";

type IconName = "shield" | "arrow" | "spark" | "check" | "alert" | "database" | "lock" | "refresh" | "sun" | "moon" | "copy" | "download";
type ToolCall = { name: string; status: "executed" | "blocked"; policyReason: string; resultSummary: string };
type ChatTurn = { id: string; role: "user" | "assistant"; content: string; source?: "huggingface" | "local"; toolCall?: ToolCall };

const phases: Array<{ key: RunStage; label: string; number: string }> = [{ key: "attack", label: "Red team", number: "01" }, { key: "trace", label: "Trace", number: "02" }, { key: "fix", label: "Patch", number: "03" }, { key: "verify", label: "Verify", number: "04" }];
const order: RunStage[] = ["attack", "trace", "fix", "verify"];
const attackKinds = ["direct-injection", "ticket-note", "bulk-export"] as const;

function Icon({ name }: { name: IconName }) {
  const paths: Record<IconName, React.ReactNode> = {
    shield: <path d="M12 3 4.5 6v5.5c0 4.6 3.2 7.8 7.5 9.5 4.3-1.7 7.5-4.9 7.5-9.5V6L12 3Zm-3 9 2 2 4-4" />,
    arrow: <path d="M5 12h14m-5-5 5 5-5 5" />,
    spark: <path d="m12 3-1.2 5.1L6 9.3l4.8 1.2L12 16l1.2-5.5L18 9.3l-4.8-1.2L12 3" />,
    check: <path d="m5 12 4 4L19 6" />,
    alert: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5m0 4h.01" /></>,
    database: <><ellipse cx="12" cy="5" rx="7" ry="3" /><path d="M5 5v7c0 1.7 3.1 3 7 3s7-1.3 7-3V5m-14 7v7c0 1.7 3.1 3 7 3s7-1.3 7-3v-7" /></>,
    lock: <><rect x="5" y="10" width="14" height="10" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></>,
    refresh: <><path d="M20 11a8 8 0 1 0 2 5.4" /><path d="M20 4v7h-7" /></>,
    sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></>,
    moon: <path d="M20 15.1A8.5 8.5 0 0 1 8.9 4 8.5 8.5 0 1 0 20 15.1Z" />,
    copy: <><rect x="9" y="9" width="10" height="11" rx="2" /><path d="M15 9V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h3" /></>,
    download: <><path d="M12 3v11m0 0 4-4m-4 4-4-4" /><path d="M5 20h14" /></>,
  };
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}

export function MissionDashboard() {
  const [run, setRun] = useState<SecurityRun | null>(null);
  const [runs, setRuns] = useState<SecurityRun[]>([]);
  const [guardrail, setGuardrail] = useState<Guardrail | null>(null);
  const [stage, setStage] = useState<RunStage>("attack");
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [loading, setLoading] = useState(false);
  const [chatLoading, setChatLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [conversation, setConversation] = useState<ChatTurn[]>([]);
  const [copied, setCopied] = useState<"policy" | "test" | "share" | "integration" | null>(null);
  const transcriptRef = useRef<HTMLDivElement>(null);
  const safe = run?.outcome === "blocked";

  useEffect(() => { const saved = localStorage.getItem("agentfence-theme"); if (saved === "light" || saved === "dark") setTheme(saved); }, []);
  useEffect(() => { document.documentElement.dataset.theme = theme; localStorage.setItem("agentfence-theme", theme); }, [theme]);
  useEffect(() => { transcriptRef.current?.scrollTo({ top: transcriptRef.current.scrollHeight, behavior: "smooth" }); }, [conversation]);

  const request = async <T,>(url: string, body?: unknown): Promise<T> => {
    const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "Request failed.");
    return payload as T;
  };

  const launch = async () => {
    setLoading(true); setError(null); setWarning(null); setGuardrail(null); setConversation([]);
    try {
      const results = await Promise.all(attackKinds.map(attackKind => request<{ run: SecurityRun }>("/api/runs", { attackKind })));
      const nextRuns = results.map(item => item.run); setRuns(nextRuns); setRun(nextRuns[0]); setStage("attack");
    } catch (err) { setError(err instanceof Error ? err.message : "Mission could not start."); }
    finally { setLoading(false); }
  };
  const fix = async () => {
    if (!run) return;
    setLoading(true); setError(null);
    try { const result = await request<FixResponse>(`/api/runs/${run.runId}/fix`, { run }); setGuardrail(result.guardrail); setWarning(result.warning || null); setStage("fix"); }
    catch (err) { setError(err instanceof Error ? err.message : "Patch generation failed."); }
    finally { setLoading(false); }
  };
  const verify = async () => {
    if (!guardrail) return;
    setLoading(true); setError(null);
    try { const results = await Promise.all(runs.map(item => request<{ run: SecurityRun }>(`/api/runs/${item.runId}/verify`, { run: item, guardrail }))); const nextRuns = results.map(item => item.run); setRuns(nextRuns); setRun(nextRuns[0]); setStage("verify"); }
    catch (err) { setError(err instanceof Error ? err.message : "Verification failed."); }
    finally { setLoading(false); }
  };
  const reset = () => { setRun(null); setRuns([]); setGuardrail(null); setStage("attack"); setConversation([]); setError(null); setWarning(null); };
  const copy = async (kind: "policy" | "test" | "share" | "integration", content: string) => {
    try { await navigator.clipboard.writeText(content); setCopied(kind); window.setTimeout(() => setCopied(null), 1800); }
    catch { setWarning("Copy failed. Select the text manually."); }
  };
  const downloadReport = () => {
    if (!run) return;
    const lines = [
      "# AgentFence Security Report",
      "", "## Target", "Acme Support Assistant (synthetic demo)",
      "", "## Verdict", safe ? "VERIFIED SAFE — all three attacks were blocked before customer_lookup()." : "RISK FOUND — sensitive tool access was proven.",
      "", "## Risk score", `${safe ? 8 : 92}/100 (${safe ? "Low" : "Critical"})`,
      "", "## Attack results",
      ...runs.map((item, index) => `${index + 1}. ${labels[index]}: ${item.outcome === "blocked" ? "BLOCKED" : "EXPOSED"} — ${item.policyDecision}`),
      ...(guardrail ? ["", "## Guardrail", guardrail.policyTitle, ...guardrail.policyRules.map(rule => `- ${rule}`), "", "## Regression test", guardrail.testName, ...guardrail.testSteps.map(step => `- ${step}`)] : []),
      "", "All records and attack inputs in this report are synthetic.",
    ];
    const url = URL.createObjectURL(new Blob([lines.join("\n")], { type: "text/markdown" }));
    const link = document.createElement("a"); link.href = url; link.download = "agentfence-security-report.md"; link.click(); URL.revokeObjectURL(url);
  };
  const shareProof = () => {
    if (!run) return;
    const url = new URL(window.location.href); url.searchParams.set("proof", safe ? "verified" : "attack");
    void copy("share", url.toString());
  };
  const sendChat = async () => {
    const message = draft.trim(); if (!message) return;
    const userTurn: ChatTurn = { id: crypto.randomUUID(), role: "user", content: message };
    const assistantId = crypto.randomUUID();
    const history = conversation.map(({ role, content }) => ({ role, content }));
    setConversation(previous => [...previous, userTurn, { id: assistantId, role: "assistant", content: "" }]);
    setDraft(""); setChatLoading(true); setError(null); setWarning(null);
    try {
      const response = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message, history, protectedMode: safe }) });
      if (!response.ok || !response.body) { const payload = await response.json().catch(() => ({})) as { error?: string }; throw new Error(payload.error || "Chat response failed."); }
      const reader = response.body.getReader(); const decoder = new TextDecoder(); let buffer = "";
      while (true) {
        const { value, done } = await reader.read(); if (done) break;
        buffer += decoder.decode(value, { stream: true }); const events = buffer.split("\n\n"); buffer = events.pop() ?? "";
        for (const entry of events) {
          const type = entry.match(/^event: (.+)$/m)?.[1]; const raw = entry.match(/^data: (.+)$/m)?.[1]; if (!type || !raw) continue;
          const data = JSON.parse(raw) as { text?: string; source?: "huggingface" | "local"; toolCall?: ToolCall; warning?: string };
          setConversation(previous => previous.map(turn => turn.id !== assistantId ? turn : type === "token" ? { ...turn, content: turn.content + (data.text || "") } : type === "meta" ? { ...turn, source: data.source, toolCall: data.toolCall } : turn));
          if (type === "done" && data.warning) setWarning(data.warning);
        }
      }
    } catch (err) { setError(err instanceof Error ? err.message : "Chat failed."); }
    finally { setChatLoading(false); }
  };

  const current = order.indexOf(stage);
  const riskScore = !run ? 0 : safe ? 8 : 92;
  const action = !run ? { label: "Run 3 security checks", onClick: launch, icon: "spark" as IconName } : stage === "attack" ? { label: "Inspect the trace", onClick: () => setStage("trace"), icon: "arrow" as IconName } : stage === "trace" ? { label: "Generate the patch", onClick: fix, icon: "spark" as IconName } : stage === "fix" ? { label: "Verify all attacks", onClick: verify, icon: "check" as IconName } : { label: "New mission", onClick: reset, icon: "refresh" as IconName };
  const labels = ["Direct prompt injection", "Malicious ticket note", "Bulk data export"];
  const attackTypes = ["PROMPT INJECTION", "INDIRECT INJECTION", "DATA EXFILTRATION"];
  const loadSharedProof = async (proof: "attack" | "verified") => {
    setLoading(true); setError(null); setWarning(null); setGuardrail(null);
    try {
      const results = await Promise.all(attackKinds.map(attackKind => request<{ run: SecurityRun }>("/api/runs", { attackKind })));
      const initialRuns = results.map(item => item.run);
      if (proof === "attack") { setRuns(initialRuns); setRun(initialRuns[0]); setStage("attack"); return; }
      const patched = await request<FixResponse>(`/api/runs/${initialRuns[0].runId}/fix`, { run: initialRuns[0] });
      const verified = await Promise.all(initialRuns.map(item => request<{ run: SecurityRun }>(`/api/runs/${item.runId}/verify`, { run: item, guardrail: patched.guardrail })));
      const verifiedRuns = verified.map(item => item.run); setRuns(verifiedRuns); setRun(verifiedRuns[0]); setGuardrail(patched.guardrail); setStage("verify"); setWarning(patched.warning || null);
    } catch (err) { setError(err instanceof Error ? err.message : "Shared demo could not start."); }
    finally { setLoading(false); }
  };
  useEffect(() => {
    const proof = new URLSearchParams(window.location.search).get("proof");
    if (proof === "attack" || proof === "verified") { void loadSharedProof(proof); window.history.replaceState({}, "", window.location.pathname); }
  }, []);

  return <main className="app-shell">
    <aside className="sidebar"><div className="brand"><span className="brand-mark"><Icon name="shield" /></span>AgentFence</div><p className="rail-caption">Autonomous safety proofs</p><nav>{phases.map((phase, index) => <button key={phase.key} className={`phase ${index === current ? "phase-active" : ""} ${index < current ? "phase-done" : ""}`} onClick={() => run && index <= current && setStage(phase.key)} disabled={!run || index > current}><span className="phase-number">{phase.number}</span><span>{phase.label}</span></button>)}</nav><div className="sidebar-footer"><span className="synthetic-dot" />Synthetic data only</div></aside>
    <section className="workspace">
      <header className="topbar"><div><p className="eyebrow">Agent safety mission</p><h1>Acme Support Assistant</h1></div><div className="top-actions"><span className={`status ${safe ? "status-safe" : run ? "status-danger" : ""}`}><span className="status-light" />{safe ? "Protected" : run ? "Risk found" : "Ready"}</span><button className="theme-toggle" onClick={() => setTheme(theme === "dark" ? "light" : "dark")} aria-label="Toggle color theme"><Icon name={theme === "dark" ? "sun" : "moon"} /></button></div></header>
      <section className="hero"><div className="hero-copy"><p className="eyebrow">From exploit to proof</p><h1>{safe ? "Three attacks blocked. Normal support preserved." : "Prove the exploit. Patch the boundary. Verify the replay."}</h1><p>AgentFence turns AI-agent security from a warning into a reproducible, reviewable safety proof.</p><div className="hero-actions"><button className="primary-action" onClick={action.onClick} disabled={loading}>{loading ? "Working..." : <><Icon name={action.icon} />{action.label}</>}</button>{run && <button className="secondary-action" onClick={downloadReport}><Icon name="download" />Download report</button>}{run && <button className="secondary-action" onClick={shareProof}><Icon name="copy" />{copied === "share" ? "Link copied" : "Share demo"}</button>}</div></div><aside className={`mission-card ${safe ? "mission-safe" : run ? "mission-risk" : ""}`}><div className="mission-card-head">Mission verdict <Icon name={safe ? "check" : run ? "alert" : "shield"} /></div><strong>{safe ? "Verified safe" : run ? "Exploit proven" : "Ready to test"}</strong><p>{safe ? "All attacks stopped before customer_lookup()." : "Three independent synthetic attack paths."}</p><div className="risk-score"><div><span>Risk score</span><b>{riskScore}<small>/100</small></b></div><span className={`risk-pill ${safe ? "risk-low" : run ? "risk-critical" : ""}`}>{safe ? "LOW" : run ? "CRITICAL" : "PENDING"}</span></div><div className="mission-stats"><span><b>{safe || run ? "3/3" : "0/3"}</b> attack checks</span><span><b>{safe ? "0" : run ? "3" : "-"}</b> sensitive calls</span></div></aside></section>
      <section className="attack-matrix"><div className="section-head"><div><p className="eyebrow">Mission coverage</p><h2>Three independent paths. One deterministic verdict.</h2></div><span className="run-id">{safe ? "3 / 3 BLOCKED" : run ? "3 / 3 PROVEN" : "READY"}</span></div><div className="matrix-rows">{attackKinds.map((kind, index) => { const item = runs.find(candidate => candidate.attackKind === kind); return <div className={`matrix-row ${item?.outcome === "blocked" ? "matrix-safe" : item ? "matrix-risk" : ""}`} key={kind}><span className="matrix-index">0{index + 1}</span><strong>{labels[index]}<small className="attack-type">{attackTypes[index]}</small></strong><span>{item ? item.outcome === "blocked" ? "Blocked before tool execution" : "Sensitive tool executed" : "Awaiting mission"}</span><b>{item ? item.outcome === "blocked" ? "BLOCKED" : "EXPOSED" : "QUEUED"}</b></div>; })}</div></section>
      <section className="trace-panel"><div className="section-head"><div><p className="eyebrow">Evidence path</p><h2>{run ? "The decision point is visible." : "A replayable execution trace."}</h2></div><span className="run-id">{run ? `RUN ${run.runId.slice(0, 8)}` : "NO ACTIVE RUN"}</span></div><div className={`trace ${run ? "trace-running" : ""}`}><Node icon="alert" label="Untrusted text" value="Attack input" active={Boolean(run)} /><Arrow blocked={false} /><Node icon="spark" label="Support agent" value="Plans tool call" active={Boolean(run)} /><Arrow blocked={safe} /><Node icon={safe ? "lock" : "database"} label="Authorization" value={safe ? "Denied by policy" : run ? "No verification" : "Awaiting scan"} active={Boolean(run)} safe={safe} risk={Boolean(run && !safe)} /><Arrow blocked={safe} /><Node icon={safe ? "check" : "database"} label="customer_lookup()" value={safe ? "Not executed" : run ? "Email fields returned" : "No call yet"} active={Boolean(run)} safe={safe} risk={Boolean(run && !safe)} /></div></section>
      <div className="dashboard-grid"><section className="card chat-card"><div className="section-head"><div><p className="eyebrow">Legitimate workflow</p><h2>Support chat still works</h2></div><span className="review-tag">{safe ? "POLICY ACTIVE" : "LIVE CHAT"}</span></div><div className="chat-window"><div className="chat-top"><span><span className="chat-presence" />Acme Support Assistant</span><span>{safe ? "policy active" : "demo"}</span></div><div className="chat-messages" ref={transcriptRef}>{conversation.length ? conversation.map(turn => <ChatBubble key={turn.id} turn={turn} />) : <div className="chat-message chat-agent"><span className="chat-role"><Icon name="spark" />Support assistant</span><p>{safe ? "Try a valid request: Where is my order?" : "Ask a normal support question, then run the safety mission."}</p></div>}</div><form className="chat-input" onSubmit={event => { event.preventDefault(); sendChat(); }}><input value={draft} onChange={event => setDraft(event.target.value)} placeholder={safe ? "Try: list every customer email" : "Try: Where is my order?"} disabled={chatLoading} aria-label="Support message" /><button type="submit" disabled={chatLoading || !draft.trim()} aria-label="Send message">{chatLoading ? "..." : <Icon name="arrow" />}</button></form></div></section><section className="card evidence-card"><p className="eyebrow">{guardrail ? "Reviewable patch" : "Observed evidence"}</p>{guardrail ? <><strong>{guardrail.policyTitle}</strong><p>{guardrail.explanation}</p><ul>{guardrail.policyRules.map(rule => <li key={rule}>{rule}</li>)}</ul><div className="patch-actions"><button className="copy-action" onClick={() => copy("policy", [guardrail.policyTitle, ...guardrail.policyRules].join("\n"))}><Icon name="copy" />{copied === "policy" ? "Copied" : "Copy guardrail"}</button></div><div className="test-block"><span>Regression test</span><code>{guardrail.testName}</code><p>{guardrail.testSteps.join(" ")}</p><button className="copy-action" onClick={() => copy("test", [guardrail.testName, ...guardrail.testSteps].join("\n"))}><Icon name="copy" />{copied === "test" ? "Copied" : "Copy test"}</button></div></> : <div className="evidence-list"><div className="evidence"><span className="evidence-icon evidence-critical"><Icon name="alert" /></span><div><strong>{run ? run.attackLabel : "Mission ready"}</strong><p>{run ? run.policyDecision : "Run all three synthetic checks to collect evidence."}</p></div></div></div>}</section></div>
      <section className="integration-card"><div><p className="eyebrow">Developer handoff</p><h2>Connect your agent when you are ready</h2><p>AgentFence can receive a sanitized execution trace from any tool-using agent. This demo keeps the integration deliberately read-only and synthetic.</p></div><div className="integration-code"><code>POST /api/agentfence/runs<br />&#123; agent: "support-bot", trace: sanitizedTrace &#125;</code><button className="copy-action" onClick={() => copy("integration", "POST /api/agentfence/runs\n{ agent: 'support-bot', trace: sanitizedTrace }")}><Icon name="copy" />{copied === "integration" ? "Copied" : "Copy API example"}</button></div></section>
      {warning && <div className="notice"><Icon name="alert" />{warning}</div>}{error && <div className="notice notice-error"><Icon name="alert" />{error}</div>}
    </section>
  </main>;
}

function ChatBubble({ turn }: { turn: ChatTurn }) { return <div className={`chat-message ${turn.role === "user" ? "chat-user" : `chat-agent ${turn.toolCall?.status === "blocked" ? "chat-blocked" : turn.toolCall?.status === "executed" ? "chat-leaked" : ""}`}`}><span className="chat-role">{turn.role === "user" ? "You" : <><Icon name={turn.toolCall?.status === "blocked" ? "lock" : "spark"} />Support assistant <em>{turn.source === "huggingface" ? "live model" : turn.toolCall ? "tool agent" : "offline mode"}</em></>}</span><p>{turn.content || "..."}</p>{turn.toolCall && <div className={`tool-call tool-${turn.toolCall.status}`}><Icon name={turn.toolCall.status === "blocked" ? "lock" : "database"} /><span><strong>{turn.toolCall.name}() {turn.toolCall.status}</strong>{turn.toolCall.policyReason}<small>{turn.toolCall.resultSummary}</small></span></div>}</div>; }
function Node({ icon, label, value, active, safe, risk }: { icon: IconName; label: string; value: string; active: boolean; safe?: boolean; risk?: boolean }) { return <div className={`trace-node ${active ? "node-active" : ""} ${safe ? "node-blocked" : ""} ${risk ? "node-danger" : ""}`}><span className="node-icon"><Icon name={icon} /></span><span className="node-label">{label}</span><strong>{value}</strong></div>; }
function Arrow({ blocked }: { blocked: boolean }) { return <div className={`trace-arrow ${blocked ? "arrow-blocked" : ""}`}><Icon name={blocked ? "lock" : "arrow"} /></div>; }
