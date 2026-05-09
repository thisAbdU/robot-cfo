import type { LiFiStep, Route, Step } from '@lifi/types';

/** Deep stringify so Nest JSON responses never throw on BigInt. */
export function serializeForJson<T>(value: T): T {
  return JSON.parse(
    JSON.stringify(value, (_, v: unknown) =>
      typeof v === 'bigint' ? v.toString() : v,
    ),
  ) as T;
}

/** First actionable LI.FI step (unwrap nested `includedSteps`). */
export function getPrimaryExecutionStep(route: Route): LiFiStep | Step {
  const top = route.steps[0];
  if (!top) {
    throw new Error('Route has no steps');
  }
  if (top.type === 'lifi' && top.includedSteps?.length) {
    return top.includedSteps[0];
  }
  return top;
}

/** Bridge / tool key used by LI.FI status endpoint for cross-chain transfers. */
export function inferBridgeToolForStatus(route: Route): string {
  const leaves = route.steps.flatMap((s) =>
    s.includedSteps?.length ? s.includedSteps : [],
  );
  const cross = leaves.find((s) => s.type === 'cross');
  return cross?.tool ?? route.steps[0]?.tool ?? 'lifi';
}
