import type { Route, TransactionRequest } from "@lifi/types";

/** Aligns with backend SafeService — pulls populated LI.FI `transactionRequest`. */
export function extractTransactionRequest(route: Route): TransactionRequest {
  const step = route.steps[0];
  if (!step) {
    throw new Error("Route has no execution step");
  }
  if (step.transactionRequest) {
    return step.transactionRequest;
  }
  if (step.type === "lifi" && step.includedSteps?.length) {
    for (const sub of step.includedSteps) {
      if (sub.transactionRequest) {
        return sub.transactionRequest;
      }
    }
  }
  throw new Error(
    "Missing transactionRequest — run prepare so LI.FI step includes calldata",
  );
}
