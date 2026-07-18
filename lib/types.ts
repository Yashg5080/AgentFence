export type RunStage = "attack" | "trace" | "fix" | "verify";
export type Outcome = "leaked" | "blocked";
export type AttackKind = "direct-injection" | "ticket-note" | "bulk-export";

export type ToolCall = {
  name: "customer_lookup";
  status: "executed" | "blocked";
  arguments: { query: string; requestedFields: string[]; verifiedTicketId?: string };
  resultSummary: string;
};

export type Evidence = { title: string; description: string; severity: "critical" | "warning" | "safe" };

export type SecurityRun = {
  runId: string;
  attackKind: AttackKind;
  attackLabel: string;
  stage: RunStage;
  prompt: string;
  toolCall: ToolCall;
  policyDecision: string;
  outcome: Outcome;
  evidence: Evidence[];
  fakeRecords: Array<{ name: string; email: string }>;
};

export type Guardrail = {
  policyTitle: string;
  policyRules: string[];
  testName: string;
  testSteps: string[];
  explanation: string;
  source: "openai" | "local-demo";
};

export type FixResponse = { run: SecurityRun; guardrail: Guardrail; warning?: string };
