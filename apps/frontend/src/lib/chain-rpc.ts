import { arbitrum, base, mainnet } from "wagmi/chains";

/** Public default RPCs for chains enabled in `wagmi.ts` (Safe Protocol Kit expects an HTTP provider URL). */
export function defaultHttpRpc(chainId: number): string {
  const map: Record<number, string> = {
    [mainnet.id]: mainnet.rpcUrls.default.http[0],
    [base.id]: base.rpcUrls.default.http[0],
    [arbitrum.id]: arbitrum.rpcUrls.default.http[0],
  };
  const url = map[chainId];
  if (!url) {
    throw new Error(
      `Chain ${chainId} has no default RPC in Robot CFO — add it to chain-rpc.ts (must match your LI.FI route source chain).`,
    );
  }
  return url;
}
