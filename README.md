# AgentFence

AgentFence is a hackathon demo for proving that a tool-using AI agent is safe before deployment. It demonstrates a synthetic prompt injection, traces the sensitive tool path, generates a guardrail, and verifies that the exact same attack is blocked.

## Run locally

```bash
npm install
copy .env.example .env.local
npm run dev
```

Open `http://localhost:3000`. Without an API key, the demo uses a clearly labelled deterministic local guardrail. Add `OPENAI_API_KEY` and `OPENAI_MODEL` to `.env.local` for a live OpenAI-generated guardrail.

## Safety boundary

This project intentionally uses only hard-coded, synthetic customer records. It does not accept real agent URLs, credentials, or customer data.

## Verify

```bash
npm test
npm run build
```
