import { getInfo, getWalletAddress } from "../lib/client.js";

export const positionsCommand = {
  description: "List open positions",
  async run() {
    const state = await getInfo().clearinghouseState({ user: getWalletAddress() });

    const positions = state.assetPositions
      .filter((p) => parseFloat(p.position.szi) !== 0)
      .map((p) => ({
        coin: p.position.coin,
        size: p.position.szi,
        side: parseFloat(p.position.szi) > 0 ? "LONG" : "SHORT",
        entryPrice: p.position.entryPx,
        positionValue: p.position.positionValue,
        unrealizedPnl: p.position.unrealizedPnl,
        returnOnEquity: p.position.returnOnEquity,
        liquidationPrice: p.position.liquidationPx,
        leverage: p.position.leverage,
        marginUsed: p.position.marginUsed,
      }));

    return {
      count: positions.length,
      positions,
    };
  },
};
