export const MARKET_SLIPPAGE = 0.03;
export const LOW_PRICE_THRESHOLD = 0.01;
export const SIGFIGS_LOW = 4;
export const SIGFIGS_DEFAULT = 5;

export function marketSlippagePrice(midPrice: number, isBuy: boolean): string {
  const sigFigs = midPrice < LOW_PRICE_THRESHOLD ? SIGFIGS_LOW : SIGFIGS_DEFAULT;
  const slippage = isBuy ? 1 + MARKET_SLIPPAGE : 1 - MARKET_SLIPPAGE;
  return parseFloat((midPrice * slippage).toPrecision(sigFigs)).toString();
}
