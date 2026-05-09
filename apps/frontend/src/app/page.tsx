import { Header } from "@/components/Header";
import { FeatureCard } from "@/components/FeatureCard";
import { TreasuryBrainPanel } from "@/components/TreasuryBrainPanel";
import { TreasuryExecutionPanel } from "@/components/TreasuryExecutionPanel";

export default function Home() {
  return (
    <div className="relative min-h-dvh overflow-hidden terminal-grid">
      <div
        className="pointer-events-none absolute inset-0 terminal-grid-glow"
        aria-hidden
      />
      <div className="terminal-scanlines" aria-hidden />

      <Header />

      <main className="relative z-10 mx-auto max-w-6xl px-4 pb-24 pt-12 sm:px-6 sm:pt-16">
        <section className="text-center sm:text-left">
          <p className="mono-data text-[11px] font-medium uppercase tracking-[0.35em] text-[var(--terminal-accent)]">
            treasury · governance · execution
          </p>
          <h1 className="mt-4 max-w-3xl font-mono text-3xl font-semibold leading-tight tracking-tight text-white sm:text-4xl md:text-5xl">
            Multisig-grade clarity for your{" "}
            <span className="text-[var(--terminal-accent)]">onchain</span>{" "}
            treasury
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-zinc-400 sm:mx-0">
            Robot CFO connects your wallet and prepares the surface for
            balances, Snapshot governance, and CFO-grade reporting.
          </p>

          <div className="mt-10 flex flex-wrap items-center justify-center gap-4 sm:justify-start">
            <span className="mono-data rounded-lg border border-[var(--terminal-border)] bg-[var(--terminal-panel)] px-4 py-2 text-xs text-zinc-400">
              Chains:{" "}
              <span className="text-[var(--terminal-accent)]">
                Ethereum · Base · Arbitrum
              </span>
            </span>
            <span className="mono-data rounded-lg border border-dashed border-zinc-700 px-4 py-2 text-xs text-zinc-500">
              Solana: use a dedicated Solana adapter (not wagmi)
            </span>
          </div>
        </section>

        <section className="mt-20 grid gap-6 md:grid-cols-2">
          <FeatureCard title="Treasury visibility" className="md:col-span-2">
            <p>
              Aggregate positions across EVM networks with terminal-precise
              typography — built for operators who live in Safe and wallet
              dashboards daily.
            </p>
          </FeatureCard>
          <FeatureCard title="Wallet connection">
            <p>
              RainbowKit + wagmi + viem power a polished connect flow with WalletConnect
              support. Set{" "}
              <code className="mono-data rounded bg-black/40 px-1.5 py-0.5 text-[var(--terminal-accent)]">
                NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID
              </code>{" "}
              from{" "}
              <a
                href="https://cloud.walletconnect.com/"
                className="text-zinc-200 underline underline-offset-2 hover:text-[var(--terminal-accent)]"
                target="_blank"
                rel="noopener noreferrer"
              >
                WalletConnect Cloud
              </a>
              .
            </p>
          </FeatureCard>
          <FeatureCard title="Governance hooks">
            <p>
              Your Nest API already syncs Snapshot proposals — this shell is
              ready to surface votes, scores, and deadlines as you wire data
              through.
            </p>
          </FeatureCard>
        </section>

        <TreasuryBrainPanel />

        <TreasuryExecutionPanel />

        <section className="mt-16 rounded-2xl border border-[var(--terminal-border)] bg-[color-mix(in_oklab,var(--terminal-panel)_100%,black)] p-8">
          <h2 className="font-mono text-sm font-semibold uppercase tracking-[0.2em] text-[var(--terminal-accent)]">
            Session status
          </h2>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-zinc-400">
            Connect a wallet using the control in the header. Session keys stay
            in your browser — Robot CFO never custody funds on this page.
          </p>
          <pre className="mono-data mt-6 overflow-x-auto rounded-xl border border-[var(--terminal-border)] bg-black/50 p-4 text-left text-xs leading-relaxed text-zinc-400">
            <span className="text-[var(--terminal-accent)]">robot-cfo</span>
            <span className="text-zinc-600"> ~ % </span>
            <span className="text-zinc-300">
              awaiting signer connection…
            </span>
          </pre>
        </section>
      </main>

      <footer className="relative z-10 border-t border-[var(--terminal-border)] py-8 text-center">
        <p className="mono-data text-[11px] uppercase tracking-[0.25em] text-zinc-600">
          Robot CFO · experimental interface · {new Date().getFullYear()}
        </p>
      </footer>
    </div>
  );
}
