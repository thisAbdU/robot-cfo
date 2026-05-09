import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import {
  ExecutableGameFunctionResponse,
  ExecutableGameFunctionStatus,
  GameFunction,
  GameWorker,
} from '@virtuals-protocol/game';
import type { TreasuryStrategyPayload } from './ai.types';

/**
 * Virtuals GAME SDK shell: defines CFO actions as {@link GameFunction}s and dispatches
 * the AI-selected action locally (no Virtuals cloud step loop required for Nest integration).
 *
 * Note: npm package `@virtuals-protocol/game-sdk` does not exist; we use `@virtuals-protocol/game`.
 */
@Injectable()
export class VirtualsTreasuryAgentService implements OnModuleInit {
  private readonly logger = new Logger(VirtualsTreasuryAgentService.name);
  private worker!: GameWorker;

  onModuleInit(): void {
    const proposeRebalance = new GameFunction({
      name: 'PROPOSE_REBALANCE',
      description:
        'Record a conservative cross-chain or wallet rebalance to reduce gas costs or concentration risk.',
      args: [
        {
          name: 'reasoning_summary',
          description: 'Short echo of the CFO reasoning for the execution log.',
          type: 'string',
        },
      ],
      executable: (args, log) => {
        const summary = args.reasoning_summary ?? '';
        log(`PROPOSE_REBALANCE recorded: ${summary}`);
        return Promise.resolve(
          new ExecutableGameFunctionResponse(
            ExecutableGameFunctionStatus.Done,
            summary || 'Rebalance proposal recorded.',
          ),
        );
      },
    });

    const proposeYieldMove = new GameFunction({
      name: 'PROPOSE_YIELD_MOVE',
      description:
        'Record moving idle treasury liquidity to a modestly higher-yield, low-risk venue.',
      args: [
        {
          name: 'reasoning_summary',
          description: 'Short echo of the CFO reasoning for the execution log.',
          type: 'string',
        },
      ],
      executable: (args, log) => {
        const summary = args.reasoning_summary ?? '';
        log(`PROPOSE_YIELD_MOVE recorded: ${summary}`);
        return Promise.resolve(
          new ExecutableGameFunctionResponse(
            ExecutableGameFunctionStatus.Done,
            summary || 'Yield move proposal recorded.',
          ),
        );
      },
    });

    const notifySocialDigest = new GameFunction({
      name: 'NOTIFY_SOCIAL_DIGEST',
      description:
        'Audit trail when a daily Robot CFO summary is published to external social channels.',
      args: [
        {
          name: 'digest_preview',
          description: 'Short preview of the social post for Virtuals logs.',
          type: 'string',
        },
      ],
      executable: (args, log) => {
        const preview = args.digest_preview ?? '';
        log(`NOTIFY_SOCIAL_DIGEST recorded: ${preview}`);
        return Promise.resolve(
          new ExecutableGameFunctionResponse(
            ExecutableGameFunctionStatus.Done,
            preview || 'Social digest recorded.',
          ),
        );
      },
    });

    const notifyGovernance = new GameFunction({
      name: 'NOTIFY_GOVERNANCE_SITUATION',
      description:
        'Record governance / runway context tied to active Snapshot proposals.',
      args: [
        {
          name: 'reasoning_summary',
          description: 'Short echo of the CFO reasoning for the execution log.',
          type: 'string',
        },
      ],
      executable: (args, log) => {
        const summary = args.reasoning_summary ?? '';
        log(`NOTIFY_GOVERNANCE_SITUATION recorded: ${summary}`);
        return Promise.resolve(
          new ExecutableGameFunctionResponse(
            ExecutableGameFunctionStatus.Done,
            summary || 'Governance situation noted.',
          ),
        );
      },
    });

    this.worker = new GameWorker({
      id: 'robot-cfo-treasury-worker',
      name: 'Robot CFOTreasuryWorker',
      description:
        'Executes Virtuals-action wrappers for Robot CFO treasury recommendations.',
      functions: [
        proposeRebalance,
        proposeYieldMove,
        notifyGovernance,
        notifySocialDigest,
      ],
      getEnvironment: () =>
        Promise.resolve({
          framework: '@virtuals-protocol/game',
          agentRole: 'treasury_shell',
        }),
    });
  }

  /**
   * Agent state surfaced to API clients: latest balances and proposals plus worker metadata.
   */
  buildAgentState(treasuryBalances: unknown[], activeProposals: unknown[]) {
    return {
      treasuryBalances,
      activeSnapshotProposals: activeProposals,
      virtualsWorkerId: this.worker.id,
      virtualsWorkerName: this.worker.name,
    };
  }

  /**
   * Runs the GameFunction executable that matches the AI strategy (audit trail / Virtuals hook).
   */
  async dispatchStrategyAction(
    strategy: TreasuryStrategyPayload,
  ): Promise<string> {
    const fn = this.worker.functions.find((f) => f.name === strategy.action);
    if (!fn) {
      this.logger.warn(`No GameFunction for action ${strategy.action}`);
      return '';
    }

    const args = {
      reasoning_summary: { value: strategy.reasoning.slice(0, 4000) },
    };

    const response = await fn.execute(args, (msg) => this.logger.debug(msg));

    return response.feedback;
  }

  /** Virtuals GAME SDK hook before posting a daily digest to X (audit trail). */
  async dispatchSocialDigest(digestPreview: string): Promise<string> {
    const fn = this.worker.functions.find(
      (f) => f.name === 'NOTIFY_SOCIAL_DIGEST',
    );
    if (!fn) {
      return '';
    }
    const args = {
      digest_preview: { value: digestPreview.slice(0, 4000) },
    };
    const response = await fn.execute(args, (msg) => this.logger.debug(msg));
    return response.feedback;
  }
}
