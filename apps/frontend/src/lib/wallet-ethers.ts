import { BrowserProvider } from "ethers";
import type { WalletClient } from "viem";

/** Wagmi wallet client → ethers v6 signer for Safe Protocol Kit. */
export async function walletClientToSigner(walletClient: WalletClient) {
  const chain = walletClient.chain;
  if (!chain) {
    throw new Error("Wallet has no active chain — switch network.");
  }
  const network = {
    chainId: chain.id,
    name: chain.name,
    ensAddress: chain.contracts?.ensRegistry?.address,
  };
  const provider = new BrowserProvider(
    walletClient.transport as never,
    network,
  );
  return provider.getSigner();
}
