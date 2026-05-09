"use client";

import type { Route } from "@lifi/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useAccount, useChainId, useSwitchChain } from "wagmi";
import { getWalletClient } from "wagmi/actions";
import { getPublicApiBaseUrl } from "@/lib/api";
import { defaultHttpRpc } from "@/lib/chain-rpc";
import { buildSignedSafeProposal } from "@/lib/safe-wallet-proposal";
import { walletClientToSigner } from "@/lib/wallet-ethers";
import { wagmiConfig } from "@/wagmi";

type TreasuryRow = {
  id: string;
  name: string;
  address: string;
  _count: { balances: number; aiDecisions: number };
};

type AiDecisionRow = {
  id: string;
  type: string;
  reasoning: string;
  status: string;
  executionStatus: string | null;
  lifiRouteId: string | null;
  safeTxHash: string | null;
  txHash: string | null;
  createdAt: string;
};

type ExecutionBody = {
  fromChainId: number;
  toChainId: number;
  fromTokenAddress: string;
  toTokenAddress: string;
  fromAmount: string;
  slippage?: number;
};

type PrepareResponse = {
  aiDecisionId?: string;
  routeId?: string;
  populatedRoute?: Route;
  route?: unknown;
  simulation?: unknown;
};

async function fetchTreasuries(): Promise<TreasuryRow[]> {
  const base = getPublicApiBaseUrl();
  const res = await fetch(`${base}/treasuries`, { credentials: "omit" });
  if (!res.ok) throw new Error(`Treasuries ${res.status}`);
  return res.json();
}

async function fetchAiDecisions(treasuryId: string): Promise<AiDecisionRow[]> {
  const base = getPublicApiBaseUrl();
  const res = await fetch(
    `${base}/treasuries/${encodeURIComponent(treasuryId)}/ai-decisions`,
    { credentials: "omit" },
  );
  if (!res.ok) throw new Error(`Decisions ${res.status}`);
  return res.json();
}

async function postPrepare(body: {
  aiDecisionId: string;
  execution: ExecutionBody;
}) {
  const base = getPublicApiBaseUrl();
  const res = await fetch(`${base}/execution/prepare`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    credentials: "omit",
  });
  const text = await res.text();
  const parsed = text ? JSON.parse(text) : null;
  if (!res.ok) {
    throw new Error(
      typeof parsed?.message === "string"
        ? parsed.message
        : text || `Prepare ${res.status}`,
    );
  }
  return parsed as PrepareResponse;
}

async function postSubmitWalletProposal(body: {
  aiDecisionId: string;
  safeTxHash: string;
  safeTransactionData: unknown;
  senderAddress: string;
  senderSignature: string;
}) {
  const base = getPublicApiBaseUrl();
  const res = await fetch(`${base}/execution/submit-wallet-proposal`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "omit",
    body: JSON.stringify(body, (_, v) =>
      typeof v === "bigint" ? v.toString() : v,
    ),
  });
  const text = await res.text();
  const parsed = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const msg =
      typeof parsed?.message === "string"
        ? parsed.message
        : Array.isArray(parsed?.message)
          ? parsed.message.map((m: { message?: string }) => m.message).join("; ")
          : text || `Wallet propose ${res.status}`;
    throw new Error(msg);
  }
  return parsed;
}

async function postPropose(aiDecisionId: string) {
  const base = getPublicApiBaseUrl();
  const res = await fetch(`${base}/execution/propose`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ aiDecisionId }),
    credentials: "omit",
  });
  const text = await res.text();
  const parsed = text ? JSON.parse(text) : null;
  if (!res.ok) {
    throw new Error(
      typeof parsed?.message === "string"
        ? parsed.message
        : text || `Propose ${res.status}`,
    );
  }
  return parsed;
}

async function postRegisterBridge(aiDecisionId: string, txHash: string) {
  const base = getPublicApiBaseUrl();
  const res = await fetch(`${base}/execution/register-bridge-tx`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ aiDecisionId, txHash }),
    credentials: "omit",
  });
  const text = await res.text();
  const parsed = text ? JSON.parse(text) : null;
  if (!res.ok) {
    throw new Error(
      typeof parsed?.message === "string"
        ? parsed.message
        : text || `Register ${res.status}`,
    );
  }
  return parsed;
}

/** Demo defaults: USDC Ethereum → USDC Base (6 decimals). */
const DEFAULT_EXECUTION: ExecutionBody = {
  fromChainId: 1,
  toChainId: 8453,
  fromTokenAddress: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
  toTokenAddress: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  fromAmount: "1000000",
  slippage: 0.03,
};

export function TreasuryExecutionPanel() {
  const queryClient = useQueryClient();
  const baseUrl = useMemo(() => getPublicApiBaseUrl(), []);
  const { isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChainAsync, isPending: isSwitchingChain } = useSwitchChain();
  const [treasuryId, setTreasuryId] = useState("");
  const [decisionId, setDecisionId] = useState("");
  const [exec, setExec] = useState<ExecutionBody>(DEFAULT_EXECUTION);
  const [bridgeTxHash, setBridgeTxHash] = useState("");
  const [lastPrepare, setLastPrepare] = useState<PrepareResponse | null>(null);
  const [lastPropose, setLastPropose] = useState<unknown>(null);
  const [lastRegister, setLastRegister] = useState<unknown>(null);

  const treasuriesQuery = useQuery({
    queryKey: ["treasuries"],
    queryFn: fetchTreasuries,
  });

  const rows = treasuriesQuery.data ?? [];
  const effectiveTreasuryId = treasuryId || rows[0]?.id || "";
  const selectedTreasury = rows.find((t) => t.id === effectiveTreasuryId);

  const decisionsQuery = useQuery({
    queryKey: ["ai-decisions", effectiveTreasuryId],
    queryFn: () => fetchAiDecisions(effectiveTreasuryId),
    enabled: Boolean(effectiveTreasuryId),
  });

  const decisions = decisionsQuery.data ?? [];
  const effectiveDecisionId =
    decisionId || decisions[0]?.id || "";

  const prepareMut = useMutation({
    mutationFn: postPrepare,
    onSuccess: (data) => {
      setLastPrepare(data);
      queryClient.invalidateQueries({
        queryKey: ["ai-decisions", effectiveTreasuryId],
      });
    },
  });

  const proposeMut = useMutation({
    mutationFn: postPropose,
    onSuccess: (data) => {
      setLastPropose(data);
      queryClient.invalidateQueries({
        queryKey: ["ai-decisions", effectiveTreasuryId],
      });
    },
  });

  const proposeWalletMut = useMutation({
    mutationFn: async () => {
      if (!effectiveDecisionId) {
        throw new Error("Select an AI decision.");
      }
      if (!selectedTreasury) {
        throw new Error("Select a treasury.");
      }
      const populatedRoute = lastPrepare?.populatedRoute;
      if (!populatedRoute) {
        throw new Error('Run "Prepare route" first — populated LI.FI calldata is required.');
      }
      if (!isConnected) {
        throw new Error("Connect a wallet in the header (Safe owner or proposer).");
      }

      const routeChainId = populatedRoute.fromChainId;
      if (chainId !== routeChainId) {
        if (!switchChainAsync) {
          throw new Error(
            `Switch your wallet to chain id ${routeChainId} (route source chain).`,
          );
        }
        await switchChainAsync({ chainId: routeChainId });
      }

      const wc = await getWalletClient(wagmiConfig, {
        chainId: routeChainId,
      });
      if (!wc) {
        throw new Error("Wallet client unavailable after network switch.");
      }

      const signer = await walletClientToSigner(wc);
      const rpcUrl = defaultHttpRpc(routeChainId);
      const proposal = await buildSignedSafeProposal(
        signer,
        selectedTreasury.address,
        populatedRoute,
        rpcUrl,
      );

      return postSubmitWalletProposal({
        aiDecisionId: effectiveDecisionId,
        safeTxHash: proposal.safeTxHash,
        safeTransactionData: proposal.safeTransactionData,
        senderAddress: proposal.senderAddress,
        senderSignature: proposal.senderSignature,
      });
    },
    onSuccess: (data) => {
      setLastPropose(data);
      queryClient.invalidateQueries({
        queryKey: ["ai-decisions", effectiveTreasuryId],
      });
    },
  });

  const registerMut = useMutation({
    mutationFn: ({
      aiDecisionId,
      txHash,
    }: {
      aiDecisionId: string;
      txHash: string;
    }) => postRegisterBridge(aiDecisionId, txHash),
    onSuccess: (data) => {
      setLastRegister(data);
      queryClient.invalidateQueries({
        queryKey: ["ai-decisions", effectiveTreasuryId],
      });
    },
  });

  const selectedDecision = decisions.find((d) => d.id === effectiveDecisionId);

  return (
    <section
      id="execution"
      className="mt-16 rounded-2xl border border-[var(--terminal-border)] bg-[color-mix(in_oklab,var(--terminal-panel)_100%,black)] p-6 sm:p-8"
    >
      <div>
        <h2 className="font-mono text-sm font-semibold uppercase tracking-[0.2em] text-[var(--terminal-accent)]">
          Execution layer
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-400">
          Prepare a LI.FI route + simulation, then queue the first step on the Safe
          Transaction Service — preferably by signing with your connected wallet
          (non-custodial). Optionally use a server proposer key if enabled on the
          API. Register the source-chain tx hash for bridge tracking. API:{" "}
          <span className="mono-data text-[var(--terminal-accent)]">{baseUrl}</span>
        </p>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <div className="space-y-4">
          <label className="flex flex-col gap-2">
            <span className="mono-data text-[11px] uppercase tracking-[0.2em] text-zinc-500">
              Treasury
            </span>
            <select
              className="mono-data rounded-lg border border-[var(--terminal-border)] bg-black/40 px-3 py-2.5 text-sm text-zinc-200 outline-none ring-[var(--terminal-accent)] focus:ring-2"
              value={effectiveTreasuryId}
              onChange={(e) => {
                setTreasuryId(e.target.value);
                setDecisionId("");
              }}
              disabled={treasuriesQuery.isLoading || rows.length === 0}
            >
              {rows.length === 0 ? (
                <option value="">No treasuries</option>
              ) : null}
              {rows.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} · {shortAddr(t.address)}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-2">
            <span className="mono-data text-[11px] uppercase tracking-[0.2em] text-zinc-500">
              AI decision
            </span>
            <select
              className="mono-data rounded-lg border border-[var(--terminal-border)] bg-black/40 px-3 py-2.5 text-sm text-zinc-200 outline-none ring-[var(--terminal-accent)] focus:ring-2"
              value={effectiveDecisionId}
              onChange={(e) => setDecisionId(e.target.value)}
              disabled={decisionsQuery.isLoading || decisions.length === 0}
            >
              {decisions.length === 0 ? (
                <option value="">Run CFO analysis first</option>
              ) : null}
              {decisions.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.type} · {shortAddr(d.id)} ·{" "}
                  {d.executionStatus ?? "no exec"}
                </option>
              ))}
            </select>
          </label>

          {selectedDecision ? (
            <div className="rounded-lg border border-[var(--terminal-border)] bg-black/30 p-3 text-xs text-zinc-400">
              <p className="mono-data text-[var(--terminal-accent)]">
                {selectedDecision.executionStatus ?? "—"} ·{" "}
                {selectedDecision.lifiRouteId ? "route ✓" : "no route"}
              </p>
              {selectedDecision.safeTxHash ? (
                <p className="mono-data mt-1 truncate text-zinc-500">
                  safeTx {shortAddr(selectedDecision.safeTxHash)}
                </p>
              ) : null}
              {selectedDecision.txHash ? (
                <p className="mono-data mt-1 truncate text-zinc-500">
                  bridge tx {shortAddr(selectedDecision.txHash)}
                </p>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="space-y-3">
          <p className="mono-data text-[11px] uppercase tracking-[0.2em] text-zinc-500">
            Route params (LI.FI)
          </p>
          <div className="grid grid-cols-2 gap-2">
            <Field
              label="From chain"
              value={String(exec.fromChainId)}
              onChange={(v) =>
                setExec((e) => ({ ...e, fromChainId: Number(v) || 1 }))
              }
            />
            <Field
              label="To chain"
              value={String(exec.toChainId)}
              onChange={(v) =>
                setExec((e) => ({ ...e, toChainId: Number(v) || 8453 }))
              }
            />
          </div>
          <label className="flex flex-col gap-1">
            <span className="mono-data text-[10px] text-zinc-500">
              From token
            </span>
            <input
              className="mono-data rounded border border-[var(--terminal-border)] bg-black/40 px-2 py-2 text-xs text-zinc-200"
              value={exec.fromTokenAddress}
              onChange={(e) =>
                setExec((x) => ({ ...x, fromTokenAddress: e.target.value }))
              }
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="mono-data text-[10px] text-zinc-500">
              To token
            </span>
            <input
              className="mono-data rounded border border-[var(--terminal-border)] bg-black/40 px-2 py-2 text-xs text-zinc-200"
              value={exec.toTokenAddress}
              onChange={(e) =>
                setExec((x) => ({ ...x, toTokenAddress: e.target.value }))
              }
            />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="flex flex-col gap-1">
              <span className="mono-data text-[10px] text-zinc-500">
                From amount (wei)
              </span>
              <input
                className="mono-data rounded border border-[var(--terminal-border)] bg-black/40 px-2 py-2 text-xs text-zinc-200"
                value={exec.fromAmount}
                onChange={(e) =>
                  setExec((x) => ({ ...x, fromAmount: e.target.value }))
                }
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="mono-data text-[10px] text-zinc-500">
                Slippage
              </span>
              <input
                className="mono-data rounded border border-[var(--terminal-border)] bg-black/40 px-2 py-2 text-xs text-zinc-200"
                value={exec.slippage ?? ""}
                onChange={(e) =>
                  setExec((x) => ({
                    ...x,
                    slippage: Number.parseFloat(e.target.value) || undefined,
                  }))
                }
              />
            </label>
          </div>
        </div>
      </div>

      <div className="mt-8 flex flex-wrap gap-3">
        <button
          type="button"
          disabled={
            !effectiveDecisionId ||
            prepareMut.isPending ||
            decisionsQuery.isLoading
          }
          onClick={() => {
            if (!effectiveDecisionId) return;
            setDecisionId(effectiveDecisionId);
            prepareMut.mutate({
              aiDecisionId: effectiveDecisionId,
              execution: exec,
            });
          }}
          className="mono-data rounded-lg border border-[var(--terminal-accent)] bg-[color-mix(in_oklab,var(--terminal-accent)_12%,transparent)] px-4 py-2 text-sm font-medium text-[var(--terminal-accent)] disabled:opacity-40"
        >
          {prepareMut.isPending ? "Preparing…" : "1. Prepare route"}
        </button>
        <button
          type="button"
          disabled={
            !effectiveDecisionId ||
            proposeWalletMut.isPending ||
            isSwitchingChain ||
            !selectedDecision?.lifiRouteId ||
            !lastPrepare?.populatedRoute
          }
          onClick={() => proposeWalletMut.mutate()}
          className="mono-data rounded-lg border border-[var(--terminal-accent)] px-4 py-2 text-sm font-medium text-[var(--terminal-accent)] disabled:opacity-40"
          title="Sign with connected wallet and relay to Safe Transaction Service"
        >
          {proposeWalletMut.isPending || isSwitchingChain
            ? "Wallet signing…"
            : "2. Queue on Safe (wallet)"}
        </button>
        <button
          type="button"
          disabled={
            !effectiveDecisionId ||
            proposeMut.isPending ||
            !selectedDecision?.lifiRouteId
          }
          onClick={() =>
            effectiveDecisionId && proposeMut.mutate(effectiveDecisionId)
          }
          className="mono-data rounded-lg border border-zinc-600 px-4 py-2 text-sm text-zinc-200 disabled:opacity-40"
          title="Requires ALLOW_SERVER_SIDE_SAFE_PROPOSAL and SAFE_PROPOSER_PRIVATE_KEY on API"
        >
          {proposeMut.isPending ? "Proposing…" : "3. Queue on Safe (server key)"}
        </button>
      </div>

      {!isConnected ? (
        <p className="mono-data mt-3 text-xs text-zinc-500">
          Connect a wallet to use the non-custodial Safe queue flow.
        </p>
      ) : null}

      <div className="mt-6 rounded-xl border border-[var(--terminal-border)] bg-black/25 p-4">
        <p className="mono-data text-[11px] uppercase tracking-[0.2em] text-zinc-500">
          3. Register bridge source tx
        </p>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end">
          <label className="min-w-0 flex-1">
            <span className="mono-data text-[10px] text-zinc-500">
              Tx hash (0x…)
            </span>
            <input
              className="mono-data mt-1 w-full rounded border border-[var(--terminal-border)] bg-black/40 px-3 py-2 text-xs text-zinc-200"
              value={bridgeTxHash}
              onChange={(e) => setBridgeTxHash(e.target.value.trim())}
              placeholder="0x…"
            />
          </label>
          <button
            type="button"
            disabled={
              !effectiveDecisionId ||
              !bridgeTxHash.startsWith("0x") ||
              registerMut.isPending
            }
            onClick={() =>
              registerMut.mutate({
                aiDecisionId: effectiveDecisionId,
                txHash: bridgeTxHash,
              })
            }
            className="mono-data shrink-0 rounded-lg border border-zinc-600 px-4 py-2 text-sm text-zinc-200 disabled:opacity-40"
          >
            {registerMut.isPending ? "Saving…" : "Register"}
          </button>
        </div>
      </div>

      {treasuriesQuery.isError || decisionsQuery.isError ? (
        <p className="mt-4 text-sm text-red-300">
          {treasuriesQuery.error instanceof Error
            ? treasuriesQuery.error.message
            : decisionsQuery.error instanceof Error
              ? decisionsQuery.error.message
              : "Request failed"}
        </p>
      ) : null}

      {prepareMut.isError ? (
        <p className="mt-4 text-sm text-red-300">
          {prepareMut.error instanceof Error
            ? prepareMut.error.message
            : "Prepare failed"}
        </p>
      ) : null}
      {proposeMut.isError ? (
        <p className="mt-4 text-sm text-red-300">
          {proposeMut.error instanceof Error
            ? proposeMut.error.message
            : "Propose failed"}
        </p>
      ) : null}
      {proposeWalletMut.isError ? (
        <p className="mt-4 text-sm text-red-300">
          {proposeWalletMut.error instanceof Error
            ? proposeWalletMut.error.message
            : "Wallet propose failed"}
        </p>
      ) : null}
      {registerMut.isError ? (
        <p className="mt-4 text-sm text-red-300">
          {registerMut.error instanceof Error
            ? registerMut.error.message
            : "Register failed"}
        </p>
      ) : null}

      {lastPrepare ? (
        <details className="mt-6 rounded-xl border border-dashed border-zinc-700 bg-black/20 p-4 text-xs open:border-[var(--terminal-accent)]/40">
          <summary className="cursor-pointer mono-data text-zinc-400">
            Last prepare response
          </summary>
          <pre className="mono-data mt-4 max-h-[min(360px,45vh)] overflow-auto whitespace-pre-wrap break-all text-[11px] text-zinc-500">
            {JSON.stringify(lastPrepare, null, 2)}
          </pre>
        </details>
      ) : null}
      {lastPropose ? (
        <details className="mt-4 rounded-xl border border-dashed border-zinc-700 bg-black/20 p-4 text-xs">
          <summary className="cursor-pointer mono-data text-zinc-400">
            Last propose response
          </summary>
          <pre className="mono-data mt-4 max-h-[min(240px,35vh)] overflow-auto whitespace-pre-wrap break-all text-[11px] text-zinc-500">
            {JSON.stringify(lastPropose, null, 2)}
          </pre>
        </details>
      ) : null}
      {lastRegister ? (
        <details className="mt-4 rounded-xl border border-dashed border-zinc-700 bg-black/20 p-4 text-xs">
          <summary className="cursor-pointer mono-data text-zinc-400">
            Last register response
          </summary>
          <pre className="mono-data mt-4 whitespace-pre-wrap text-[11px] text-zinc-500">
            {JSON.stringify(lastRegister, null, 2)}
          </pre>
        </details>
      ) : null}
    </section>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="mono-data text-[10px] text-zinc-500">{label}</span>
      <input
        className="mono-data rounded border border-[var(--terminal-border)] bg-black/40 px-2 py-2 text-xs text-zinc-200"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

function shortAddr(a: string): string {
  if (a.length <= 14) return a;
  return `${a.slice(0, 8)}…${a.slice(-4)}`;
}
