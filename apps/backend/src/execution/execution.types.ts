/** Parameters needed to request a LI.FI route (stored on `AIDecision.data.execution` or passed per request). */
export type ExecutionRouteParams = {
  fromChainId: number;
  toChainId: number;
  fromTokenAddress: string;
  toTokenAddress: string;
  /** Amount in smallest units (stringified integer). */
  fromAmount: string;
  /** Decimal proportion, e.g. 0.03 for 3%. */
  slippage?: number;
};
