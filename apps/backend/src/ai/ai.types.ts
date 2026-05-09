import type { AIDecisionType } from '@prisma/client';

export const VIRTUALS_ACTIONS = [
  'PROPOSE_REBALANCE',
  'PROPOSE_YIELD_MOVE',
  'NOTIFY_GOVERNANCE_SITUATION',
] as const;

export type VirtualsTreasuryAction = (typeof VIRTUALS_ACTIONS)[number];

export type TreasuryStrategyPayload = {
  action: VirtualsTreasuryAction;
  reasoning: string;
  data: Record<string, unknown>;
};

export function mapVirtualsActionToDecisionType(
  action: VirtualsTreasuryAction,
): AIDecisionType {
  switch (action) {
    case 'PROPOSE_REBALANCE':
      return 'REBALANCE';
    case 'PROPOSE_YIELD_MOVE':
      return 'YIELD';
    case 'NOTIFY_GOVERNANCE_SITUATION':
      return 'GOVERNANCE';
  }
}
