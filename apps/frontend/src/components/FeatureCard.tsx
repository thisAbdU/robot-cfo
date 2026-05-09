import type { ReactNode } from "react";

type FeatureCardProps = {
  title: string;
  children: ReactNode;
  className?: string;
};

export function FeatureCard({ title, children, className = "" }: FeatureCardProps) {
  return (
    <article
      className={`group relative overflow-hidden rounded-2xl border border-[var(--terminal-border)] bg-[var(--terminal-panel)] p-6 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)] transition-colors hover:border-[color-mix(in_oklab,var(--terminal-accent)_35%,var(--terminal-border))] ${className}`}
    >
      <div
        className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-[var(--terminal-accent)] opacity-[0.06] blur-3xl transition-opacity group-hover:opacity-[0.12]"
        aria-hidden
      />
      <h3 className="relative font-mono text-sm font-semibold uppercase tracking-[0.15em] text-[var(--terminal-accent)]">
        {title}
      </h3>
      <div className="relative mt-4 text-sm leading-relaxed text-zinc-400">
        {children}
      </div>
    </article>
  );
}
