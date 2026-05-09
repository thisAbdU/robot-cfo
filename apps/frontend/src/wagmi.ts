import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { arbitrum, base, mainnet } from "wagmi/chains";

/**
 * WalletConnect Cloud project ID (required for WalletConnect v2 / mobile wallets).
 * Create a free project at https://cloud.walletconnect.com and set:
 * `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` in `.env.local`
 *
 * Solana is not included here: RainbowKit + wagmi target EVM chains only.
 * A Solana flow would use `@solana/wallet-adapter-react` separately.
 */
const walletConnectProjectId =
  process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ?? "";

export const wagmiConfig = getDefaultConfig({
  appName: "Robot CFO",
  projectId:
    walletConnectProjectId ||
    "00000000000000000000000000000000",
  chains: [mainnet, base, arbitrum],
  ssr: true,
});
