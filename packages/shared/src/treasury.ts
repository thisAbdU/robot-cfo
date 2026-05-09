/** Shared treasury-related contracts (balances, flows, etc.). */

export interface TreasuryBalance {
  asset: string;
  amount: string;
}

export interface TreasurySnapshot {
  asOf: string;
  balances: TreasuryBalance[];
}
