"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { getPublicApiBaseUrl } from "@/lib/api";

type DecisionLine = {
  kind: "decision";
  id: string;
  createdAt: string;
  treasuryName: string;
  reasoning: string;
  executionStatus: string | null;
  safeTxHash: string | null;
};

type FeedLine = {
  kind: "feed";
  id: string;
  createdAt: string;
  message: string;
  source: string;
};

type TransparencyEntry = DecisionLine | FeedLine;

type DisplayRow = { id: string; text: string };

const DEMO_ROWS: DisplayRow[] = [
  "Ghost is analyzing Ethereum balances…",
  "Optimization signal: +2.4% APY opportunity on Base",
  "Transaction proposed to Safe multisig — awaiting owner signature",
].map((text, i) => ({ id: `demo-${i}`, text }));

function formatLine(entry: TransparencyEntry): string {
  if (entry.kind === "feed") {
    return entry.message;
  }
  const sig =
    entry.executionStatus === "SIGNING" && entry.safeTxHash
      ? "Transaction proposed to Safe multisig."
      : entry.executionStatus === "BRIDGING"
        ? "Bridge transaction in flight."
        : entry.executionStatus === "COMPLETED"
          ? "Execution completed."
          : null;
  const base = `${entry.treasuryName}: ${entry.reasoning.slice(0, 160)}${entry.reasoning.length > 160 ? "…" : ""}`;
  return sig ? `${base} — ${sig}` : base;
}

export function ActivityFeed() {
  const apiBase = useMemo(() => getPublicApiBaseUrl(), []);
  const [rows, setRows] = useState<DisplayRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function pull() {
      try {
        const res = await fetch(`${apiBase}/transparency/logs?limit=24`, {
          cache: "no-store",
        });
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        const data = (await res.json()) as TransparencyEntry[];
        if (cancelled) return;
        const next: DisplayRow[] = data.map((entry) => ({
          id: entry.id,
          text: formatLine(entry),
        }));
        setRows(next.length ? next : [...DEMO_ROWS]);
        setError(null);
      } catch (e) {
        if (!cancelled) {
          setRows([...DEMO_ROWS]);
          setError(e instanceof Error ? e.message : "Feed unavailable");
        }
      }
    }

    void pull();
    const id = window.setInterval(() => void pull(), 12_000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [apiBase]);

  const display = rows.length ? rows : DEMO_ROWS;

  return (
    <section className="mt-16">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="font-mono text-sm font-semibold uppercase tracking-[0.2em] text-[var(--terminal-accent)]">
            Transparency · Activity
          </h2>
          <p className="mt-2 max-w-xl text-sm text-zinc-500">
            Live reasoning log and automation signals. Glass terminal overlay.
          </p>
        </div>
        {error ? (
          <p className="mono-data text-xs text-amber-500/90">{error}</p>
        ) : null}
      </div>

      <div
        className="relative mt-6 overflow-hidden rounded-2xl border border-white/10 bg-[color-mix(in_oklab,var(--terminal-panel)_85%,transparent)] p-6 shadow-[0_0_60px_-20px_rgba(120,200,255,0.25)] backdrop-blur-md"
        style={{
          background:
            "linear-gradient(135deg, rgba(15,23,42,0.75) 0%, rgba(9,9,11,0.55) 100%)",
        }}
      >
        <div className="pointer-events-none absolute inset-0 rounded-2xl border border-white/5" />
        <div className="mono-data relative max-h-[320px] space-y-3 overflow-y-auto pr-2 text-left text-sm leading-relaxed text-zinc-300">
          <AnimatePresence initial={false}>
            {display.map((row) => (
              <motion.div
                key={row.id}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                className="rounded-lg border border-[var(--terminal-border)]/60 bg-black/35 px-4 py-3 text-zinc-300"
              >
                <span className="text-[var(--terminal-accent)]">› </span>
                {row.text}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}
