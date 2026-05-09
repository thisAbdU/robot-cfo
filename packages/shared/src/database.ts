/**
 * Mirrors of backend Prisma models for API / frontend use.
 * Numeric precision: raw on-chain amounts as decimal strings; timestamps ISO 8601.
 */

export interface TreasuryDto {
  id: string;
  name: string;
  address: string;
  chainId: number;
  orgId: string;
  createdAt: string;
  updatedAt: string;
}

export interface TokenBalanceDto {
  id: string;
  treasuryId: string;
  /** LI.FI internal chain id (e.g. Solana uses `ChainId.SOL`, not the “native” chain id). */
  chainId: string;
  address: string;
  symbol: string;
  decimals: number;
  /** Raw token amount (base units) as a decimal integer string. */
  balance: string;
  balanceUSD: string;
  priceUSD: string;
  lastUpdated: string;
}

/** Snapshot `votes` field on-chain vote-count style payload stored as JSON. */
export interface GovernanceVotesPayload {
  count: number;
}

export interface GovernanceProposalDto {
  id: string;
  snapshotId: string;
  title: string;
  body: string;
  status: string;
  space: string;
  author: string;
  choices: unknown;
  scores: unknown;
  start: string;
  end: string;
  votes: GovernanceVotesPayload;
  /** Optional Gemini (or other LLM) summary; set server-side. */
  aiSummary: string | null;
  createdAt: string;
  updatedAt: string;
}
