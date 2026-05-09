import type { Route } from "@lifi/types";
import Safe from "@safe-global/protocol-kit";
import { OperationType } from "@safe-global/types-kit";
import type { JsonRpcSigner } from "ethers";
import { extractTransactionRequest } from "./extract-lifi-tx";

/**
 * @param rpcUrl HTTP RPC for the route source chain (must match {@link populatedRoute.fromChainId}).
 */
export async function buildSignedSafeProposal(
  signer: JsonRpcSigner,
  treasuryAddress: string,
  populatedRoute: Route,
  rpcUrl: string,
) {
  // Protocol Kit typings target pk/passkey; runtime accepts ethers `Signer` for browser wallets.
  const protocolKit = await Safe.init({
    provider: rpcUrl,
    signer: signer as never,
    safeAddress: treasuryAddress,
  });

  const txReq = extractTransactionRequest(populatedRoute);
  const safeTransaction = await protocolKit.createTransaction({
    transactions: [
      {
        to: txReq.to!,
        value: txReq.value != null ? String(txReq.value) : "0",
        data: txReq.data ?? "0x",
        operation: OperationType.Call,
      },
    ],
  });

  const safeTxHash = await protocolKit.getTransactionHash(safeTransaction);
  const signature = await protocolKit.signHash(safeTxHash);

  return {
    safeTxHash,
    safeTransactionData: safeTransaction.data,
    senderAddress: await signer.getAddress(),
    senderSignature: signature.data,
  };
}
