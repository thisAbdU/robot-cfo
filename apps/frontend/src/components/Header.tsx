"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import Link from "next/link";

export function Header() {
  return (
    <header className="sticky top-0 z-50 border-b border-[var(--terminal-border)] bg-[color-mix(in_oklab,var(--terminal-bg)_92%,transparent)] backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link
          href="/"
          className="group flex items-center gap-3 font-mono text-sm tracking-tight text-[var(--terminal-fg)] transition-colors hover:text-[var(--terminal-accent)]"
        >
          <span
            className="flex h-9 w-9 items-center justify-center rounded border border-[var(--terminal-border)] bg-[var(--terminal-panel)] text-xs font-bold text-[var(--terminal-accent)] shadow-[0_0_20px_rgba(0,255,148,0.12)]"
            aria-hidden
          >
            RC
          </span>
          <span className="hidden flex-col sm:flex">
            <span className="text-[11px] uppercase tracking-[0.25em] text-zinc-500">
              multisig ops
            </span>
            <span className="text-base font-semibold tracking-wide">
              Robot CFO
            </span>
          </span>
          <span className="font-semibold sm:hidden">Robot CFO</span>
        </Link>

        <div className="flex items-center gap-3">
          <ConnectButton />
        </div>
      </div>
    </header>
  );
}
