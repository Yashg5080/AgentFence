# AgentFence

AgentFence is a pre-deployment security proof for tool-using AI agents. It demonstrates a clear, repeatable story with only synthetic data:

1. Three attacks make a vulnerable support agent invoke `customer_lookup()`.
2. AgentFence records the decision trace and marks the missing authorization boundary.
3. It creates a reviewable guardrail and regression test.
4. The identical attacks are replayed locally and blocked before the sensitive tool runs.

## What the demo includes

- Direct prompt injection, indirect ticket-note injection, and bulk data-export attacks.
- Deterministic attack verification, so the final safety result does not depend on a model judgement.
- A risk score that moves from Critical (92/100) to Low (8/100).
- A reviewable least-privilege code diff, guardrail, and regression-test output.
- A streaming support chat with safe `order_status()` and `create_support_ticket()` actions.
- Audit timeline, downloadable Markdown report, shareable proof links, and mock PR/CI handoff.
- A copyable sanitized-trace integration example for future agent integrations.

## Architecture

```text
Support chat / security mission
             |
             v
Synthetic tool-using support agent
             |
             v
Structured execution trace -> guardrail generator -> reviewable patch
             |                                      |
             +------ deterministic policy replay ---+
                              |
                              v
                     blocked / regression passed
```

## Run locally

```bash
npm install
copy .env.example .env.local
npm run dev
```

Open `http://localhost:3000`. Without an API key, the demo uses a clearly labelled deterministic local guardrail. Add `OPENAI_API_KEY` and `OPENAI_MODEL` to `.env.local` for a live OpenAI-generated guardrail.

To use optional Hugging Face chat streaming, add `HF_TOKEN` and optionally `HF_MODEL` to `.env.local`. The product remains fully demoable without either API key.

## Safety boundary

This project intentionally uses only hard-coded, synthetic customer records. It does not accept real agent URLs, credentials, or customer data.

## Hackathon demo sequence

1. Run the three security checks and show the Critical risk score.
2. Inspect the animated trace to show why `customer_lookup()` was unsafe.
3. Generate the guardrail and copyable regression test.
4. Verify all attacks; show the blocked tool path, Low risk score, CI preview, and audit timeline.
5. Use the support chat with `ORD-1042` to show that normal, least-privilege support still works.

## Future integration shape

```ts
await fetch("/api/agentfence/runs", {
  method: "POST",
  body: JSON.stringify({ agent: "support-bot", trace: sanitizedTrace }),
});
```

The in-product endpoint shown above is an integration preview, not a production data-ingestion endpoint. A production version should authenticate callers, validate schemas, minimize trace fields, retain data for a defined period, and never ingest raw customer content by default.

## Verify

```bash
npm test
npm run build
```
