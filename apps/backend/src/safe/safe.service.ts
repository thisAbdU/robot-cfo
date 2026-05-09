import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Safe from '@safe-global/protocol-kit';
import SafeApiKit from '@safe-global/api-kit';
import { OperationType, type SafeTransactionData } from '@safe-global/types-kit';
import type { Route } from '@lifi/types';
import type { TransactionRequest } from '@lifi/types';
import { ethers } from 'ethers';

/** Pull populated LI.FI `transactionRequest` after `getStepTransaction`. */
function extractTransactionRequest(route: Route): TransactionRequest {
  const step = route.steps[0];
  if (!step) {
    throw new Error('Route has no execution step');
  }
  if (step.transactionRequest) {
    return step.transactionRequest;
  }
  if (step.type === 'lifi' && step.includedSteps?.length) {
    for (const sub of step.includedSteps) {
      if (sub.transactionRequest) {
        return sub.transactionRequest;
      }
    }
  }
  throw new Error(
    'Missing transactionRequest — populate the route with LI.FI getStepTransaction first',
  );
}

@Injectable()
export class SafeService {
  private readonly logger = new Logger(SafeService.name);

  constructor(private readonly config: ConfigService) {}

  /**
   * Builds a Safe tx from the first LI.FI step and proposes it to the Safe Transaction Service (queue only).
   */
  async proposeSafeTransaction(
    treasuryAddress: string,
    routeWithCalldata: Route,
  ): Promise<{ safeTxHash: string }> {
    /**
     * Non-custodial posture: server-side signing is **opt-in** via explicit env flag.
     * Funds still require Safe owner confirmations on-chain; this only queues via Transaction Service.
     * Production deployments should prefer owner/hardware-wallet signing flows without storing keys on API servers.
     */
    const allowServerSigner =
      this.config.get<string>('ALLOW_SERVER_SIDE_SAFE_PROPOSAL') === 'true';
    if (!allowServerSigner) {
      throw new ForbiddenException(
        'Server-side Safe proposer signing is disabled. Set ALLOW_SERVER_SIDE_SAFE_PROPOSAL=true only in controlled environments, or propose transactions from an owner-controlled signer.',
      );
    }

    const pk = this.config.get<string>('SAFE_PROPOSER_PRIVATE_KEY');
    if (!pk?.trim()) {
      throw new ServiceUnavailableException(
        'SAFE_PROPOSER_PRIVATE_KEY is not configured; cannot propose Safe transactions.',
      );
    }

    const chainId = routeWithCalldata.fromChainId;
    const rpcUrl = this.resolveRpcUrl(chainId);
    const txReq = extractTransactionRequest(routeWithCalldata);

    const protocolKit = await Safe.init({
      provider: rpcUrl,
      signer: pk,
      safeAddress: treasuryAddress,
    });

    const senderAddress = new ethers.Wallet(pk).address;

    const metaTx = {
      to: txReq.to!,
      value: txReq.value != null ? String(txReq.value) : '0',
      data: txReq.data ?? '0x',
      operation: OperationType.Call,
    };

    const safeTransaction = await protocolKit.createTransaction({
      transactions: [metaTx],
    });

    const safeTxHash = await protocolKit.getTransactionHash(safeTransaction);
    const signature = await protocolKit.signHash(safeTxHash);

    const apiKey =
      this.config.get<string>('SAFE_API_KEY') ??
      this.config.get<string>('SAFE_TRANSACTION_SERVICE_API_KEY');

    const apiKit = new SafeApiKit({
      chainId: BigInt(chainId),
      apiKey: apiKey || undefined,
    });

    await apiKit.proposeTransaction({
      safeAddress: treasuryAddress,
      safeTransactionData: safeTransaction.data,
      safeTxHash,
      senderAddress,
      senderSignature: signature.data,
      origin: 'robot-cfo',
    });

    this.logger.log(
      `Proposed Safe tx ${safeTxHash} for treasury ${treasuryAddress}`,
    );

    return { safeTxHash };
  }

  /**
   * Submits a client-signed proposal to Safe Transaction Service (no server private key).
   * Verifies {@link safeTxHash} matches the hash recomputed from the stored LI.FI route.
   */
  async relayWalletProposal(input: {
    treasuryAddress: string;
    populatedRoute: Route;
    safeTxHash: string;
    safeTransactionData: SafeTransactionData;
    senderAddress: string;
    senderSignature: string;
  }): Promise<{ safeTxHash: string }> {
    const chainId = input.populatedRoute.fromChainId;
    const rpcUrl = this.resolveRpcUrl(chainId);
    /** Ephemeral key only to satisfy Protocol Kit init for deterministic hash recomputation (not published). */
    const ephemeral = ethers.Wallet.createRandom();

    const protocolKit = await Safe.init({
      provider: rpcUrl,
      signer: ephemeral.privateKey,
      safeAddress: input.treasuryAddress,
    });

    const txReq = extractTransactionRequest(input.populatedRoute);
    const safeTransaction = await protocolKit.createTransaction({
      transactions: [
        {
          to: txReq.to!,
          value: txReq.value != null ? String(txReq.value) : '0',
          data: txReq.data ?? '0x',
          operation: OperationType.Call,
        },
      ],
    });

    const expectedHash = await protocolKit.getTransactionHash(safeTransaction);
    if (expectedHash.toLowerCase() !== input.safeTxHash.toLowerCase()) {
      throw new BadRequestException(
        `safeTxHash mismatch (expected ${expectedHash}, got ${input.safeTxHash})`,
      );
    }

    const apiKey =
      this.config.get<string>('SAFE_API_KEY') ??
      this.config.get<string>('SAFE_TRANSACTION_SERVICE_API_KEY');

    const apiKit = new SafeApiKit({
      chainId: BigInt(chainId),
      apiKey: apiKey || undefined,
    });

    await apiKit.proposeTransaction({
      safeAddress: input.treasuryAddress,
      safeTransactionData: input.safeTransactionData,
      safeTxHash: input.safeTxHash,
      senderAddress: input.senderAddress,
      senderSignature: input.senderSignature,
      origin: 'robot-cfo-wallet',
    });

    this.logger.log(
      `Relayed wallet Safe proposal ${input.safeTxHash} for treasury ${input.treasuryAddress}`,
    );

    return { safeTxHash: input.safeTxHash };
  }

  private resolveRpcUrl(chainId: number): string {
    const specific = this.config.get<string>(`CHAIN_${chainId}_RPC_URL`);
    if (specific?.trim()) {
      return specific.trim();
    }
    const fallback = this.config.get<string>('EXECUTION_RPC_URL');
    if (fallback?.trim()) {
      return fallback.trim();
    }
    throw new ServiceUnavailableException(
      `No RPC URL configured for chain ${chainId}. Set CHAIN_${chainId}_RPC_URL or EXECUTION_RPC_URL.`,
    );
  }
}
