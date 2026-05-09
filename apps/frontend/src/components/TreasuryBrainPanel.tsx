"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { getPublicApiBaseUrl } from "@/lib/api";

type TreasuryRow = {
  id: string;
  name: string;
  address: string;
  chainId: number;
  orgId: string;
  updatedAt: string;
  _count: { balances: number; aiDecisions: number };
};

type AnalyzeResponse = {
  agentState?: {
    treasuryBalances?: unknown[];
    activeSnapshotProposals?: unknown[];
    virtualsWorkerId?: string;
    virtualsWorkerName?: string;
  };
  strategy?: {
    action: string;
    reasoning: string;
    data?: Record<string, unknown>;
  };
  virtualsFeedback?: string;
  decision?: {
    id: string;
    treasuryId: string;
    type: string;
    reasoning: string;
    status: string;
    createdAt: string;
    data?: unknown;
  };
};

async function fetchTreasuries(): Promise<TreasuryRow[]> {
  const base = getPublicApiBaseUrl();
  const res = await fetch(`${base}/treasuries`, { credentials: "omit" });
  if (!res.ok) {
    throw new Error(`Treasuries ${res.status}: ${await res.text()}`);
  }
  return res.json() as Promise<TreasuryRow[]>;
}

async function postAnalyze(treasuryId: string): Promise<AnalyzeResponse> {
  const base = getPublicApiBaseUrl();
  const res = await fetch(`${base}/ai/analyze/${treasuryId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "omit",
  });
  const text = await res.text();
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = { raw: text };
  }
  if (!res.ok) {
    const msg =
      typeof body === "object" && body !== null && "message" in body
        ? String((body as { message?: string }).message)
        : text;
    throw new Error(msg || `Analyze failed (${res.status})`);
  }
  return body as AnalyzeResponse;
}

export function TreasuryBrainPanel() {
  const baseUrl = useMemo(() => getPublicApiBaseUrl(), []);
  const [treasuryId, setTreasuryId] = useState<string>("");

  const treasuriesQuery = useQuery({
    queryKey: ["treasuries"],
    queryFn: fetchTreasuries,
  });

  const analyzeMutation = useMutation({
    mutationFn: postAnalyze,
  });

  const rows = treasuriesQuery.data ?? [];
  const effectiveId =
    treasuryId ||
    rows[0]?.id ||
    "";

  return (
    <section
      id="cfo-brain"
      className="mt-16 rounded-2xl border border-[var(--terminal-border)] bg-[color-mix(in_oklab,var(--terminal-panel)_100%,black)] p-6 sm:p-8"
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="font-mono text-sm font-semibold uppercase tracking-[0.2em] text-[var(--terminal-accent)]">
            Robot CFO brain
          </h2>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-zinc-400">
            Loads treasuries from the API, runs Gemini analysis, and persists an{" "}
            <span className="mono-data text-zinc-300">AIDecision</span> row.
            API:{" "}
            <span className="mono-data text-[var(--terminal-accent)]">{baseUrl}</span>
          </p>
        </div>
      </div>

      <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center">
        <label className="flex min-w-[240px] flex-1 flex-col gap-2">
          <span className="mono-data text-[11px] uppercase tracking-[0.2em] text-zinc-500">
            Treasury
          </span>
          <select
            className="mono-data rounded-lg border border-[var(--terminal-border)] bg-black/40 px-3 py-2.5 text-sm text-zinc-200 outline-none ring-[var(--terminal-accent)] focus:ring-2"
            value={effectiveId}
            onChange={(e) => setTreasuryId(e.target.value)}
            disabled={treasuriesQuery.isLoading || rows.length === 0}
          >
            {rows.length === 0 && !treasuriesQuery.isLoading ? (
              <option value="">No treasuries — run DB seed</option>
            ) : null}
            {rows.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} · {t._count.balances} balances · {shortAddr(t.address)}
              </option>
            ))}
          </select>
        </label>

        <button
          type="button"
          disabled={
            !effectiveId ||
            analyzeMutation.isPending ||
            treasuriesQuery.isLoading
          }
          onClick={() => {
            if (!effectiveId) return;
            setTreasuryId(effectiveId);
            analyzeMutation.mutate(effectiveId);
          }}
          className="mono-data inline-flex items-center justify-center rounded-lg border border-[var(--terminal-accent)] bg-[color-mix(in_oklab,var(--terminal-accent)_12%,transparent)] px-5 py-2.5 text-sm font-medium text-[var(--terminal-accent)] transition hover:bg-[color-mix(in_oklab,var(--terminal-accent)_20%,transparent)] disabled:cursor-not-allowed disabled:opacity-40"
        >
          {analyzeMutation.isPending ? "Analyzing…" : "Run CFO analysis"}
        </button>
      </div>

      {treasuriesQuery.isError ? (
        <p className="mt-6 rounded-lg border border-red-900/50 bg-red-950/30 px-4 py-3 text-sm text-red-200">
          {treasuriesQuery.error instanceof Error
            ? treasuriesQuery.error.message
            : "Failed to load treasuries"}
        </p>
      ) : null}

      {analyzeMutation.isError ? (
        <p className="mt-6 rounded-lg border border-red-900/50 bg-red-950/30 px-4 py-3 text-sm text-red-200">
          {analyzeMutation.error instanceof Error
            ? analyzeMutation.error.message
            : "Analysis failed"}
        </p>
      ) : null}

      {analyzeMutation.data ? (
        <AnalysisResultView data={analyzeMutation.data} />
      ) : null}
    </section>
  );
}

function shortAddr(a: string): string {
  if (a.length <= 12) return a;
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

function AnalysisResultView({ data }: { data: AnalyzeResponse }) {
  const s = data.strategy;
  const d = data.decision;
  const balancesLen = data.agentState?.treasuryBalances?.length ?? 0;
  const proposalsLen =
    data.agentState?.activeSnapshotProposals?.length ?? 0;

  return (
    <div className="mt-8 space-y-6 border-t border-[var(--terminal-border)] pt-8">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-[var(--terminal-border)] bg-black/30 p-4">
          <p className="mono-data text-[11px] uppercase tracking-[0.2em] text-zinc-500">
            Strategy action
          </p>
          <p className="mt-2 font-mono text-lg text-[var(--terminal-accent)]">
            {s?.action ?? "—"}
          </p>
        </div>
        <div className="rounded-xl border border-[var(--terminal-border)] bg-black/30 p-4">
          <p className="mono-data text-[11px] uppercase tracking-[0.2em] text-zinc-500">
            Saved decision
          </p>
          <p className="mt-2 text-sm text-zinc-300">
            <span className="font-mono text-[var(--terminal-accent)]">
              {d?.type ?? "—"}
            </span>
            <span className="mx-2 text-zinc-600">·</span>
            <span className="mono-data text-zinc-400">{d?.status ?? ""}</span>
          </p>
          {d?.id ? (
            <p className="mono-data mt-2 truncate text-[11px] text-zinc-600">
              id {d.id}
            </p>
          ) : null}
        </div>
      </div>

      <div className="rounded-xl border border-[var(--terminal-border)] bg-black/30 p-4">
        <p className="mono-data text-[11px] uppercase tracking-[0.2em] text-zinc-500">
          Reasoning
        </p>
        <p className="mt-3 text-sm leading-relaxed text-zinc-300">
          {s?.reasoning ?? d?.reasoning ?? "—"}
        </p>
      </div>

      <div className="flex flex-wrap gap-3 text-xs text-zinc-500">
        <span className="mono-data rounded border border-[var(--terminal-border)] px-2 py-1">
          Context: {balancesLen} balance row(s), {proposalsLen} active proposal(s)
        </span>
        {data.agentState?.virtualsWorkerName ? (
          <span className="mono-data rounded border border-[var(--terminal-border)] px-2 py-1">
            Shell: {data.agentState.virtualsWorkerName}
          </span>
        ) : null}
      </div>

      <details className="rounded-xl border border-dashed border-zinc-700 bg-black/20 p-4 text-xs">
        <summary className="cursor-pointer mono-data text-zinc-500">
          Raw JSON response
        </summary>
        <pre className="mono-data mt-4 max-h-[min(420px,50vh)] overflow-auto whitespace-pre-wrap break-all text-[11px] leading-relaxed text-zinc-500">
          {JSON.stringify(data, null, 2)}
        </pre>
      </details>
    </div>
  );
}
