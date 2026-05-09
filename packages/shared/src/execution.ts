/** Lifecycle of an AI-suggested execution after route preparation (shared with API clients). */
export const ExecutionStatuses = [
  "PENDING",
  "SIGNING",
  "BRIDGING",
  "COMPLETED",
  "FAILED",
] as const;

export type ExecutionStatus = (typeof ExecutionStatuses)[number];

export function isExecutionStatus(s: string): s is ExecutionStatus {
  return (ExecutionStatuses as readonly string[]).includes(s);
}
